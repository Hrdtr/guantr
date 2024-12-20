import { GuantrAnyConditionExpression, GuantrAnyPermission } from "./types"

/**
 * Checks if the given path is a string and starts with either '$context.' or 'context.'.
 *
 * @param {unknown} path - The path to check.
 * @return {boolean} - Returns true if the path is a string and starts with either '$context.' or 'context.', otherwise returns false.
 */
export const isContextualOperand = (path: unknown): path is string => typeof path === 'string' && (path.startsWith('$context.') || path.startsWith('context.'))

/**
 * Retrieves the value at the specified path from the given context object.
 *
 * @template T - The type of the context object.
 * @template U - The type of the value to retrieve.
 * @param {T} context - The context object to search in.
 * @param {string} path - The dot-separated path to the value.
 * @return {U | undefined} The value at the specified path, or undefined if not found.
 */
export const getContextValue = <T extends Record<string, unknown>, U>(context: T, path: string): U | undefined => {
  return (path.replace(path.startsWith('$') ? '$context.' : 'context.', ''))
    .replaceAll('?.', '.')
    .split('.')
    // eslint-disable-next-line unicorn/no-array-reduce
    .reduce((o, k) => (o || {})[k], (context ?? {}) as Record<string, any>) as U | undefined
}

export const isValidConditionExpression = (maybeExpression: unknown): maybeExpression is GuantrAnyConditionExpression => {
  if (!Array.isArray(maybeExpression) || maybeExpression.length < 2 || typeof maybeExpression[0] !== 'string') return false
  return true
}

/**
 * Checks if the given model matches the permission condition.
 *
 * @param {Model} model - The model to check against the permission condition.
 * @param {GuantrAnyPermission & { condition: NonNullable<GuantrAnyPermission['condition']> }} condition - The condition to match.
 * @returns {boolean} Returns true if the model matches the permission condition, false otherwise.
 */
export const matchPermissionCondition = <
  Model extends Record<string, unknown>,
>(
  model: Model,
  condition: NonNullable<GuantrAnyPermission['condition']>,
): boolean => {
  return Object.entries(condition).every(([key, expressionOrNestedCondition]) => {
    if (Array.isArray(expressionOrNestedCondition)) {
      return matchConditionExpression({
        value: model[key],
        expression: expressionOrNestedCondition,
      })
    }
    else if (typeof expressionOrNestedCondition === 'object') {
      const { $expr, ...condition } = expressionOrNestedCondition

      const nestedModel = model[key]
      if (!nestedModel || typeof nestedModel !== 'object') {
        return false
      }

      if ($expr) {
        return (isValidConditionExpression($expr) ? matchConditionExpression({ value: model[key], expression: $expr }) : false)
          && matchPermissionCondition(nestedModel as Record<string, unknown>, condition)
      }
      return matchPermissionCondition(nestedModel as Record<string, unknown>, condition)
    }
    else {
      throw new TypeError(`Unexpected expression value type: ${typeof expressionOrNestedCondition}`)
    }
  })
}

/**
 * Evaluates a condition expression against a given value and context.
 *
 * @param {Object} data - The data object containing the value, expression, and optional context.
 * @param {unknown} data.value - The value to evaluate the condition against.
 * @param {NonNullable<GuantrAnyPermission['condition']>[keyof NonNullable<GuantrAnyPermission['condition']>]} data.expression - The condition expression to evaluate.
 * @return {boolean} The result of evaluating the condition expression against the value and context.
 * @throws {TypeError} If the model value type is unexpected or the operand type is invalid.
 */
export const matchConditionExpression = (data: {
  value: unknown
  expression: Extract<NonNullable<GuantrAnyPermission['condition']>[keyof NonNullable<GuantrAnyPermission['condition']>], Array<any>>
}): boolean => {
  const {
    value,
    expression,
  } = data
  const [operator, operand, options] = expression ?? []

  switch (operator) {
    case 'equals': {
      // possible value types: null, undefined, string, number, boolean
      if (
        value !== null &&
        typeof value !== 'undefined' &&
        typeof value !== 'string' &&
        typeof value !== 'number' &&
        typeof value !== 'boolean'
      ) {
        throw new TypeError(`Unexpected model value type while evaluating condition with equals operator. (received: ${typeof value})`)
      }
      // possible operand types: null, undefined, string, number, boolean
      if (
        operand !== null &&
        typeof operand !== 'undefined' &&
        typeof operand !== 'string' &&
        typeof operand !== 'number' &&
        typeof operand !== 'boolean'
      ) {
        throw new TypeError(`The operand for condition with equals operator must be one of the following types: null, undefined, string, number, boolean. (received: ${typeof operand})`)
      }

      if (
        operand === null ||
        typeof operand === 'undefined' ||
        typeof operand === 'number' ||
        typeof operand === 'boolean'
      ) {
        return value === operand
      }
      // string
      if (options?.caseInsensitive) {
        return (typeof value === 'string' ? value.toLowerCase() : value) === operand.toLowerCase()
      }
      return value === operand
    }

    case 'in': {
      // possible value types: null, undefined, string, number
      if (
        value !== null &&
        typeof value !== 'undefined' &&
        typeof value !== 'string' &&
        typeof value !== 'number'
      ) {
        throw new TypeError(`Unexpected model value type while evaluating condition with in operator. (received: ${typeof value})`)
      }
      // possible operand types: (string | number)[]
      if (!Array.isArray(operand) || operand.some(i => typeof i !== 'string' && typeof i !== 'number')) {
        throw new TypeError(`The operand for condition with in operator must be one of the following types: (string | number)[]. (received: ${typeof operand})`)
      }

      if (value === null || typeof value === 'undefined') {
        return false
      }

      const opd = operand as (string | number)[]

      if (options?.caseInsensitive) {
        return opd.map(i => 
          (typeof i === 'string' ? i.toLowerCase() : i))
            .includes((typeof value === 'string' ? value.toLowerCase() : value)
        )
      }

      return opd.includes(value)
    }

    case 'contains': {
      // possible value types: null, undefined, string
      if (
        value !== null &&
        typeof value !== 'undefined' &&
        typeof value !== 'string'
      ) {
        throw new TypeError(`Unexpected model value type while evaluating condition with contains operator. (received: ${typeof value})`)
      }
      // possible operand types: string
      if (typeof operand !== 'string') {
        throw new TypeError(`The operand for condition with contains operator must be one of the following types: string. (received: ${typeof operand})`)
      }

      if (value === null || typeof value === 'undefined') {
        return false
      }

      if (options?.caseInsensitive) {
        return value.toLowerCase().includes(operand.toLowerCase())
      }

      return value.includes(operand)
    }

    case 'startsWith': {
      // possible value types: null, undefined, string
      if (
        value !== null &&
        typeof value !== 'undefined' &&
        typeof value !== 'string'
      ) {
        throw new TypeError(`Unexpected model value type while evaluating condition with startsWith operator. (received: ${typeof value})`)
      }
      // possible operand types: string
      if (typeof operand !== 'string') {
        throw new TypeError(`The operand for condition with startsWith operator must be one of the following types: string. (received: ${typeof operand})`)
      }

      if (value === null || typeof value === 'undefined') {
        return false
      }

      if (options?.caseInsensitive) {
        return value.toLowerCase().startsWith(operand.toLowerCase())
      }

      return value.startsWith(operand)
    }

    case 'endsWith': {
      // possible value types: null, undefined, string
      if (
        value !== null &&
        typeof value !== 'undefined' &&
        typeof value !== 'string'
      ) {
        throw new TypeError(`Unexpected model value type while evaluating condition with endsWith operator. (received: ${typeof value})`)
      }
      // possible operand types: string
      if (typeof operand !== 'string') {
        throw new TypeError(`The operand for condition with endsWith operator must be one of the following types: string. (received: ${typeof operand})`)
      }

      if (value === null || typeof value === 'undefined') {
        return false
      }

      if (options?.caseInsensitive) {
        return value.toLowerCase().endsWith(operand.toLowerCase())
      }

      return value.endsWith(operand)
    }

    case 'gt': {
      // possible value types: null, undefined, number
      if (
        value !== null &&
        typeof value !== 'undefined' &&
        typeof value !== 'number'
      ) {
        throw new TypeError(`Unexpected model value type while evaluating condition with gt operator. (received: ${typeof value})`)
      }
      // possible operand types: number
      if (typeof operand !== 'number') {
        throw new TypeError(`The operand for condition with gt operator must be one of the following types: number. (received: ${typeof operand})`)
      }

      if (value === null || typeof value === 'undefined') {
        return false
      }

      return value > operand
    }

    case 'gte': {
      // possible value types: null, undefined, number
      if (
        value !== null &&
        typeof value !== 'undefined' &&
        typeof value !== 'number'
      ) {
        throw new TypeError(`Unexpected model value type while evaluating condition with gte operator. (received: ${typeof value})`)
      }
      // possible operand types: number
      if (typeof operand !== 'number') {
        throw new TypeError(`The operand for condition with gte operator must be one of the following types: number. (received: ${typeof operand})`)
      }

      if (value === null || typeof value === 'undefined') {
        return false
      }

      return value >= operand
    }

    case 'has': {
      // possible value types: null, undefined, (string | number)[]
      if (
        value !== null &&
        typeof value !== 'undefined' &&
        (!Array.isArray(value) || value.some(i => typeof i !== 'string' && typeof i !== 'number'))
      ) {
        throw new TypeError(`Unexpected model value type while evaluating condition with has operator. (received: ${typeof value})`)
      }
      // possible operand types: string, number
      if (
        typeof operand !== 'string' &&
        typeof operand !== 'number'
      ) {
        throw new TypeError(`The operand for condition with has operator must be one of the following types: string, number. (received: ${typeof operand})`)
      }

      if (value === null || typeof value === 'undefined') {
        return false
      }

      if (options && options?.caseInsensitive) {
        return value.map(i => (typeof i === 'string' ? i.toLowerCase() : i)).includes((typeof operand === 'string' ? operand.toLowerCase() : operand))
      }

      return value.includes(operand)
    }

    case 'hasSome': {
      // possible value types: null, undefined, (string | number)[]
      if (
        value !== null &&
        typeof value !== 'undefined' &&
        (!Array.isArray(value) || value.some(i => typeof i !== 'string' && typeof i !== 'number'))
      ) {
        throw new TypeError(`Unexpected model value type while evaluating condition with hasSome operator. (received: ${typeof value})`)
      }
      // possible operand types: (string | number)[]
      if (!Array.isArray(operand) || operand.some(i => typeof i !== 'string' && typeof i !== 'number')) {
        throw new TypeError(`The operand for condition with hasSome operator must be one of the following types: (string | number)[]. (received: ${typeof operand})`)
      }

      if (value === null || typeof value === 'undefined') {
        return false
      }

      if (options && options?.caseInsensitive) {
        return operand.some(item =>
          value.map(i => typeof i === 'string' ? i.toLowerCase() : i)
            .includes((typeof item === 'string' ? item.toLowerCase() : item))
        )
      }

      return operand.some(i => value.includes(i))
    }

    case 'hasEvery': {
      // possible value types: null, undefined, (string | number)[]
      if (
        value !== null &&
        typeof value !== 'undefined' &&
        (!Array.isArray(value) || value.some(i => typeof i !== 'string' && typeof i !== 'number'))
      ) {
        throw new TypeError(`Unexpected model value type while evaluating condition with hasEvery operator. (received: ${typeof value})`)
      }
      // possible operand types: (string | number)[]
      if (!Array.isArray(operand) || operand.some(i => typeof i !== 'string' && typeof i !== 'number')) {
        throw new TypeError(`The operand for condition with hasEvery operator must be one of the following types: (string | number)[]. (received: ${typeof operand})`)
      }

      if (value === null || typeof value === 'undefined') {
        return false
      }

      if (options && options?.caseInsensitive) {
        return operand.every(item =>
          value.map(i => typeof i === 'string' ? i.toLowerCase() : i)
            .includes((typeof item === 'string' ? item.toLowerCase() : item))
        )
      }

      return operand.every(i => value.includes(i))
    }

    case 'some': {
      // possible value types: null, undefined, Record<string, unknown>[]
      if (
        value !== null &&
        typeof value !== 'undefined' &&
        // Ensure value is array of non-null plain object
        (!Array.isArray(value) || value.some(i => i === null || typeof i !== 'object' || Array.isArray(i)))
      ) {
        throw new TypeError(`Unexpected model value type while evaluating condition with some operator. (received: ${typeof value})`)
      }
      // possible operand types: Record<string, object | ConditionExpression>
      if (
        operand === null ||
        typeof operand !== 'object' ||
        Object.values(operand).some(i => {
          if (typeof i !== 'object') return true
          if (Array.isArray(i)) {
            if (i.length < 2) return true
            if (typeof i[0] !== 'string') return true
          }
          return false
        })
      ) {
        throw new TypeError(`The operand for condition with every operator must be one of the following types: Record<string, object | ConditionExpression>. (received: ${typeof operand})`)
      }

      if (value === null || typeof value === 'undefined') {
        return false
      }

      const match = (i: any) => Object.entries(operand).every(([key, expressionOrNestedCondition]) => {
        if (Array.isArray(expressionOrNestedCondition)) {
          return matchConditionExpression({
            value: i[key],
            expression: expressionOrNestedCondition as any,
          })
        }
        else if (typeof expressionOrNestedCondition === 'object') {
          return matchPermissionCondition(
            i[key] as Record<string, any>,
            expressionOrNestedCondition,
          )
        }
        else {
          throw new TypeError(`Unexpected expression value type: ${typeof expressionOrNestedCondition}`)
        }
      })

      return value.some(i => match(i))
    }

    case 'every': {
      // possible value types: null, undefined, Record<string, unknown>[]
      if (
        value !== null &&
        typeof value !== 'undefined' &&
        // Ensure value is array of non-null plain object
        (!Array.isArray(value) || value.some(i => i === null || typeof i !== 'object' || Array.isArray(i)))
      ) {
        throw new TypeError(`Unexpected model value type while evaluating condition with every operator. (received: ${typeof value})`)
      }
      // possible operand types: Record<string, object | ConditionExpression>
      if (
        operand === null ||
        typeof operand !== 'object' ||
        Object.values(operand).some(i => {
          if (typeof i !== 'object') return true
          if (Array.isArray(i)) {
            if (i.length < 2) return true
            if (typeof i[0] !== 'string') return true
          }
          return false
        })
      ) {
        throw new TypeError(`The operand for condition with every operator must be one of the following types: Record<string, object | ConditionExpression>. (received: ${typeof operand})`)
      }

      if (value === null || typeof value === 'undefined') {
        return false
      }

      const match = (i: any) => Object.entries(operand).every(([key, expressionOrNestedCondition]) => {
        if (Array.isArray(expressionOrNestedCondition)) {
          return matchConditionExpression({
            value: i[key],
            expression: expressionOrNestedCondition as any,
          })
        }
        else if (typeof expressionOrNestedCondition === 'object') {
          return matchPermissionCondition(
            i[key] as Record<string, any>,
            expressionOrNestedCondition,
          )
        }
        else {
          throw new TypeError(`Unexpected expression value type: ${typeof expressionOrNestedCondition}`)
        }
      })

      return value.every(i => match(i))
    }

    default: {
      return false
    }
  }
}
