import { GuantrAnyPermission } from "./types"

export const matchPermissionCondition = <
  Resource extends Record<string, unknown>,
  Context extends Record<string, unknown> | undefined = undefined,
  >(
  resource: Resource,
  permission: GuantrAnyPermission & { condition: NonNullable<GuantrAnyPermission['condition']> },
  context?: Context
  ) => {
  return Object.entries(permission.condition).every(([path, expression]) => matchConditionExpression({
    value: getResourceValue(resource, path),
    expression,
    inverted: permission.inverted,
    context
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

const matchConditionExpression = ({
  value,
  expression,
  inverted,
  context,
}: {
  value: unknown
  expression: NonNullable<GuantrAnyPermission['condition']>[keyof NonNullable<GuantrAnyPermission['condition']>]
  inverted: boolean
  context?: Record<string, unknown>
}): boolean => {
  const [operator, maybeContextualOperand, options] = expression ?? []
  let operand = maybeContextualOperand
  if (isContextualOperand(operand)) operand = getContextValue(context ?? {}, operand)

  switch (operator) {
    case 'equals': {
      // possible value types: null, undefined, string, number, boolean, symbol, Date
      if (
        value !== null &&
        typeof value !== 'undefined' &&
        typeof value !== 'string' &&
        typeof value !== 'number' &&
        typeof value !== 'boolean' &&
        typeof value !== 'symbol' &&
        !(value instanceof Date)
      ) {
        throw new TypeError(`Unexpected resource value type while evaluating condition with equals operator. (received: ${typeof value})`)
      }
      // possible operand types: null, undefined, string, number, boolean, symbol, Date
      if (
        operand !== null &&
        typeof operand !== 'undefined' &&
        typeof operand !== 'string' &&
        typeof operand !== 'number' &&
        typeof operand !== 'boolean' &&
        typeof operand !== 'symbol' &&
        !(operand instanceof Date)
      ) {
        throw new TypeError(`The operand for condition with equals operator must be one of the following types: null, undefined, string, number, boolean, symbol, Date. (received: ${typeof operand})`)
      }

      if (
        operand === null ||
        typeof operand === 'undefined' ||
        typeof operand === 'number' ||
        typeof operand === 'boolean' ||
        typeof operand === 'symbol'
      ) {
        return inverted
          ? value !== operand
          : value === operand
      }
      // Date
      // TODO: Whats the better way to check if operand or value is date(time) string or timestamp number?
      if (value instanceof Date || operand instanceof Date) {
        // Coerce resource value to number
        let equalNumberValue = value instanceof Date ? value.getTime() : undefined
        if (!equalNumberValue && typeof value === 'string') {
          try {
            equalNumberValue = new Date(value).getTime()
          } catch {
            equalNumberValue = undefined
          }
        }
        // Coerce operand to number
        let equalNumberOperand = operand instanceof Date ? operand.getTime() : undefined
        if (!equalNumberOperand && typeof operand === 'string') {
          try {
            equalNumberOperand = new Date(operand).getTime()
          } catch {
            equalNumberOperand = undefined
          }
        }

        if (!equalNumberValue || !equalNumberOperand) {
          return inverted
            ? true
            : false
        }

        return inverted
          ? value !== operand
          : value === operand
      }
      // string
      if (options?.caseInsensitive) {
        return inverted
          ? (typeof value === 'string' ? value.toLowerCase() : value) !== operand.toLowerCase()
          : (typeof value === 'string' ? value.toLowerCase() : value) === operand.toLowerCase()
      }

      return inverted
        ? value !== operand
        : value === operand
    }

    case 'in': {
      // possible value types: null, undefined, string, number, symbol
      if (
        value !== null &&
        typeof value !== 'undefined' &&
        typeof value !== 'string' &&
        typeof value !== 'number' &&
        typeof value !== 'symbol'
      ) {
        throw new TypeError(`Unexpected resource value type while evaluating condition with in operator. (received: ${typeof value})`)
      }
      // possible operand types: (string | number | symbol)[]
      if (!Array.isArray(operand) || operand.some(i => typeof i !== 'string' && typeof i !== 'number' && typeof i !== 'symbol')) {
        throw new TypeError(`The operand for condition with in operator must be one of the following types: (string | number | symbol)[]. (received: ${typeof operand})`)
      }

      if (value === null || typeof value === 'undefined') {
        return inverted
          ? true
          : false
      }

      const opd = operand as (string | number | symbol)[]

      if (options?.caseInsensitive) {
        return inverted
          ? !opd.map(i => (typeof i === 'string' ? i.toLowerCase() : i)).includes((typeof value === 'string' ? value.toLowerCase() : value))
          : opd.map(i => (typeof i === 'string' ? i.toLowerCase() : i)).includes((typeof value === 'string' ? value.toLowerCase() : value))
      }

      return inverted
        ? !opd.includes(value)
        : opd.includes(value)
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
        return inverted
          ? true
          : false
      }

      if (options?.caseInsensitive) {
        return inverted
          ? !value.toLowerCase().includes(operand.toLowerCase())
          : value.toLowerCase().includes(operand.toLowerCase())
      }

      return inverted
        ? !value.includes(operand)
        : value.includes(operand)
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
        return inverted
          ? true
          : false
      }

      if (options?.caseInsensitive) {
        return inverted
          ? !value.toLowerCase().startsWith(operand.toLowerCase())
          : value.toLowerCase().startsWith(operand.toLowerCase())
      }

      return inverted
        ? !value.startsWith(operand)
        : value.startsWith(operand)
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
        return inverted
          ? true
          : false
      }

      if (options?.caseInsensitive) {
        return inverted
          ? !value.toLowerCase().endsWith(operand.toLowerCase())
          : value.toLowerCase().endsWith(operand.toLowerCase())
      }

      return inverted
        ? !value.endsWith(operand)
        : value.endsWith(operand)
    }

    case 'gt': {
      // possible value types: null, undefined, string, number, Date
      if (
        value !== null &&
        typeof value !== 'undefined' &&
        typeof value !== 'string' &&
        typeof value !== 'number' &&
        !(value instanceof Date)
      ) {
        throw new TypeError(`Unexpected resource value type while evaluating condition with gt operator. (received: ${typeof value})`)
      }
      // possible operand types: number, Date
      if (
        typeof operand !== 'number' &&
        !(operand instanceof Date)
      ) {
        throw new TypeError(`The operand for condition with gt operator must be one of the following types: number, Date. (received: ${typeof operand})`)
      }

      if (value === null || typeof value === 'undefined') {
        return inverted
          ? true
          : false
      }

      // Coerce resource value to number
      let gtNumberValue = value instanceof Date ? value.getTime() : undefined
      if (!gtNumberValue && typeof value === 'string') {
        try {
          gtNumberValue = new Date(value).getTime()
        } catch {
          gtNumberValue = undefined
        }
      }

      if (!gtNumberValue) {
        return inverted
          ? true
          : false
      }

      return inverted
        ? gtNumberValue < (operand instanceof Date ? operand.getTime() : operand)
        : gtNumberValue > (operand instanceof Date ? operand.getTime() : operand)
    }

    case 'gte': {
      // possible value types: null, undefined, string, number, Date
      if (
        value !== null &&
        typeof value !== 'undefined' &&
        typeof value !== 'string' &&
        typeof value !== 'number' &&
        !(value instanceof Date)
      ) {
        throw new TypeError(`Unexpected resource value type while evaluating condition with gte operator. (received: ${typeof value})`)
      }
      // possible operand types: number, Date
      if (
        typeof operand !== 'number' &&
        !(operand instanceof Date)
      ) {
        throw new TypeError(`The operand for condition with gte operator must be one of the following types: number, Date. (received: ${typeof operand})`)
      }

      if (value === null || typeof value === 'undefined') {
        return inverted
          ? true
          : false
      }

      // Coerce resource value to number
      let gteNumberValue = value instanceof Date ? value.getTime() : undefined
      if (!gteNumberValue && typeof value === 'string') {
        try {
          gteNumberValue = new Date(value).getTime()
        } catch {
          gteNumberValue = undefined
        }
      }

      if (!gteNumberValue) {
        return inverted
          ? true
          : false
      }

      return inverted
        ? gteNumberValue <= (operand instanceof Date ? operand.getTime() : operand)
        : gteNumberValue >= (operand instanceof Date ? operand.getTime() : operand)
    }

    case 'has': {
      // possible value types: null, undefined, (string | number | symbol)[]
      if (
        value !== null &&
        typeof value !== 'undefined' &&
        (!Array.isArray(value) || value.some(i => typeof i !== 'string' && typeof i !== 'number' && typeof i !== 'symbol'))
      ) {
        throw new TypeError(`Unexpected resource value type while evaluating condition with has operator. (received: ${typeof value})`)
      }
      // possible operand types: string, number, symbol
      if (
        typeof operand !== 'string' &&
        typeof operand !== 'number' &&
        typeof operand !== 'symbol'
      ) {
        throw new TypeError(`The operand for condition with has operator must be one of the following types: string, number, symbol. (received: ${typeof operand})`)
      }

      if (value === null || typeof value === 'undefined') {
        return inverted
          ? true
          : false
      }

      if (options && options?.caseInsensitive) {
        return inverted
          ? !value.map(i => (typeof i === 'string' ? i.toLowerCase() : i)).includes((typeof operand === 'string' ? operand.toLowerCase() : operand))
          : value.map(i => (typeof i === 'string' ? i.toLowerCase() : i)).includes((typeof operand === 'string' ? operand.toLowerCase() : operand))
      }

      return inverted
        ? !value.includes(operand)
        : value.includes(operand)
    }

    case 'hasSome': {
      // possible value types: null, undefined, (string | number | symbol)[]
      if (
        value !== null &&
        typeof value !== 'undefined' &&
        (!Array.isArray(value) || value.some(i => typeof i !== 'string' && typeof i !== 'number' && typeof i !== 'symbol'))
      ) {
        throw new TypeError(`Unexpected resource value type while evaluating condition with hasSome operator. (received: ${typeof value})`)
      }
      // possible operand types: (string | number | symbol)[]
      if (!Array.isArray(operand) || operand.some(i => typeof i !== 'string' && typeof i !== 'number' && typeof i !== 'symbol')) {
        throw new TypeError(`The operand for condition with hasSome operator must be one of the following types: (string | number | symbol)[]. (received: ${typeof operand})`)
      }

      if (value === null || typeof value === 'undefined') {
        return inverted
          ? true
          : false
      }

      if (options && options?.caseInsensitive) {
        return inverted
          ? !value.some(i => (typeof i === 'string' ? i.toLowerCase() : i) === (typeof operand === 'string' ? operand.toLowerCase() : operand))
          : value.some(i => (typeof i === 'string' ? i.toLowerCase() : i) === (typeof operand === 'string' ? operand.toLowerCase() : operand))
      }

      return inverted
        ? !value.includes(operand)
        : value.includes(operand)
    }

    case 'hasEvery': {
      // possible value types: null, undefined, (string | number | symbol)[]
      if (
        value !== null &&
        typeof value !== 'undefined' &&
        (!Array.isArray(value) || value.some(i => typeof i !== 'string' && typeof i !== 'number' && typeof i !== 'symbol'))
      ) {
        throw new TypeError(`Unexpected resource value type while evaluating condition with hasEvery operator. (received: ${typeof value})`)
      }
      // possible operand types: (string | number | symbol)[]
      if (!Array.isArray(operand) || operand.some(i => typeof i !== 'string' && typeof i !== 'number' && typeof i !== 'symbol')) {
        throw new TypeError(`The operand for condition with hasEvery operator must be one of the following types: (string | number | symbol)[]. (received: ${typeof operand})`)
      }

      if (value === null || typeof value === 'undefined') {
        return inverted
          ? true
          : false
      }

      if (options && options?.caseInsensitive) {
        return inverted
          ? !value.every(i => (typeof i === 'string' ? i.toLowerCase() : i) === (typeof operand === 'string' ? operand.toLowerCase() : operand))
          : value.every(i => (typeof i === 'string' ? i.toLowerCase() : i) === (typeof operand === 'string' ? operand.toLowerCase() : operand))
      }

      return inverted
        ? !value.every(i => i === operand)
        : value.every(i => i === operand)
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
        return inverted
          ? true
          : false
      }

      const match = (i: any) => Object.entries(operand).every(([path, expression]) => matchConditionExpression({
        value: getResourceValue(i, path),
        expression,
        inverted: inverted,
        context
      }))

      return inverted
        ? !value.some(i => match(i))
        : value.some(i => match(i))
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
        return inverted
          ? true
          : false
      }

      const match = (i: any) => Object.entries(operand).every(([path, expression]) => matchConditionExpression({
        value: getResourceValue(i, path),
        expression,
        inverted: inverted,
        context
      }))

      return inverted
        ? !value.every(i => match(i))
        : value.every(i => match(i))
    }

    default: {
      return false
    }
  }
}
