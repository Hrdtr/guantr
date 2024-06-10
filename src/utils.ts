import { GuantrAnyPermission } from "./types"

export const matchPermissionCondition = <
  Resource extends Record<string, unknown>,
  Context extends Record<string, unknown> | undefined = undefined,
  >(
  resource: Resource,
  permission: GuantrAnyPermission & { condition: NonNullable<GuantrAnyPermission['condition']> },
  context?: Context,
) => {
  return Object.entries(permission.condition).every(([path, expression]) => matchConditionExpression({
    value: getResourceValue(resource, path),
    expression,
    context,
  }))
}

const getResourceValue = <T extends Record<string, unknown>, U>(resource: T, path: string): U | undefined => {
  return path
    .split('.')
    // eslint-disable-next-line unicorn/no-array-reduce
    .reduce((o, k) => (o || {})[k], resource as Record<string, any>) as U | undefined
}

const isContextualOperand = (path: unknown): path is string => typeof path === 'string' && (path.startsWith('$context.') || path.startsWith('context.'))
const getContextValue = <T extends Record<string, unknown>, U>(context: T, path: string): U | undefined => {
  return (path.replace(path.startsWith('$') ? '$context.' : 'context.', ''))
    .split('.')
    // eslint-disable-next-line unicorn/no-array-reduce
    .reduce((o, k) => (o || {})[k], (context ?? {}) as Record<string, any>) as U | undefined
}

export const matchConditionExpression = ({
  value,
  expression,
  context,
}: {
  value: unknown
  expression: NonNullable<GuantrAnyPermission['condition']>[keyof NonNullable<GuantrAnyPermission['condition']>]
  context?: Record<string, unknown>
}): boolean => {
  const [operator, maybeContextualOperand, options] = expression ?? []
  let operand = maybeContextualOperand
  if (isContextualOperand(operand)) operand = getContextValue(context ?? {}, operand)

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
        throw new TypeError(`Unexpected resource value type while evaluating condition with equals operator. (received: ${typeof value})`)
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
        throw new TypeError(`Unexpected resource value type while evaluating condition with in operator. (received: ${typeof value})`)
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
        throw new TypeError(`Unexpected resource value type while evaluating condition with contains operator. (received: ${typeof value})`)
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
        throw new TypeError(`Unexpected resource value type while evaluating condition with startsWith operator. (received: ${typeof value})`)
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
        throw new TypeError(`Unexpected resource value type while evaluating condition with endsWith operator. (received: ${typeof value})`)
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
        throw new TypeError(`Unexpected resource value type while evaluating condition with gt operator. (received: ${typeof value})`)
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
        throw new TypeError(`Unexpected resource value type while evaluating condition with gte operator. (received: ${typeof value})`)
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
        throw new TypeError(`Unexpected resource value type while evaluating condition with has operator. (received: ${typeof value})`)
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
        throw new TypeError(`Unexpected resource value type while evaluating condition with hasSome operator. (received: ${typeof value})`)
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
        throw new TypeError(`Unexpected resource value type while evaluating condition with hasEvery operator. (received: ${typeof value})`)
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
        throw new TypeError(`Unexpected resource value type while evaluating condition with some operator. (received: ${typeof value})`)
      }
      // possible operand types: Record<string, ConditionExpression>
      if (
        operand === null ||
        typeof operand !== 'object' ||
        // Ensure the operand is valid condition
        Object.values(operand).some(i => !Array.isArray(i) || i.length < 2 || typeof i[0] !== 'string')
      ) {
        throw new TypeError(`The operand for condition with some operator must be one of the following types: Record<string, ConditionExpression>. (received: ${typeof operand})`)
      }

      if (value === null || typeof value === 'undefined') {
        return false
      }

      const match = (i: any) => Object.entries(operand).every(([path, expression]) => matchConditionExpression({
        value: getResourceValue(i, path),
        expression,
        context
      }))

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
        throw new TypeError(`Unexpected resource value type while evaluating condition with every operator. (received: ${typeof value})`)
      }
      // possible operand types: Record<string, ConditionExpression>
      if (
        operand === null ||
        typeof operand !== 'object' ||
        // Ensure the operand is valid condition
        Object.values(operand).some(i => !Array.isArray(i) || i.length < 2 || typeof i[0] !== 'string')
      ) {
        throw new TypeError(`The operand for condition with every operator must be one of the following types: Record<string, ConditionExpression>. (received: ${typeof operand})`)
      }

      if (value === null || typeof value === 'undefined') {
        return false
      }

      const match = (i: any) => Object.entries(operand).every(([path, expression]) => matchConditionExpression({
        value: getResourceValue(i, path),
        expression,
        context
      }))

      return value.every(i => match(i))
    }

    default: {
      return false
    }
  }
}
