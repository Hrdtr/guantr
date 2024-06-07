import { GuantrAnyPermission } from "./types"

export const matchPermissionCondition = <
  Resource extends Record<string, unknown>,
  Context extends Record<string, unknown> | undefined = undefined,
  >(
  resource: Resource,
  permission: GuantrAnyPermission & { condition: NonNullable<GuantrAnyPermission['condition']> },
  context?: Context
  ) => {
  const getResourceValue = <T>(path: string): T | undefined => {
    return path
      .split('.')
      // eslint-disable-next-line unicorn/no-array-reduce
      .reduce((o, k) => (o || {})[k], resource as Record<string, any>) as T | undefined
  }

  const isContext = (path: unknown): path is string => typeof path === 'string' && (path.startsWith('$context.') || path.startsWith('context.'))
  const getContextValue = <T>(path: string): T | undefined => {
    return (path.replace(path.startsWith('$') ? '$context.' : 'context.', ''))
      .split('.')
      // eslint-disable-next-line unicorn/no-array-reduce
      .reduce((o, k) => (o || {})[k], (context ?? {}) as Record<string, any>) as T | undefined
  }

  return Object.entries(permission.condition).every(([path, expression]) => {
    const [operator, _operand, options] = expression ?? []
    let operand = _operand
    if (isContext(operand)) operand = getContextValue(operand)

    const value = getResourceValue(path)

    switch (operator) {
      case 'equals': {
        // possible value types: null, undefined, string, number, boolean, symbol
        if (
          value !== null &&
          typeof value !== 'undefined' &&
          typeof value !== 'string' &&
          typeof value !== 'number' &&
          typeof value !== 'boolean' &&
          typeof value !== 'symbol'
        ) {
          throw new Error(`Unexpected resource value type while evaluating condition with equals operator. (received: ${typeof value})`)
        }
        // possible operand types: null, undefined, string, number, boolean, symbol
        if (
          operand !== null &&
          typeof operand !== 'undefined' &&
          typeof operand !== 'string' &&
          typeof operand !== 'number' &&
          typeof operand !== 'boolean' &&
          typeof operand !== 'symbol'
        ) {
          throw new Error(`The operand for condition with equals operator must be one of the following types: null, undefined, string, number, boolean, symbol. (received: ${typeof operand})`)
        }

        if (
          operand === null ||
          typeof operand === 'undefined' ||
          typeof operand === 'number' ||
          typeof operand === 'boolean' ||
          typeof operand === 'symbol'
        ) {
          return permission.inverted
            ? value !== operand
            : value === operand
        }
        // string
        if (options?.caseInsensitive) {
          return permission.inverted
            ? (typeof value === 'string' ? value.toLowerCase() : value) !== operand.toLowerCase()
            : (typeof value === 'string' ? value.toLowerCase() : value) === operand.toLowerCase()
        }

        return permission.inverted
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
          throw new Error(`Unexpected resource value type while evaluating condition with in operator. (received: ${typeof value})`)
        }
        // possible operand types: (string | number | symbol)[]
        if (!Array.isArray(operand) || operand.some(i => typeof i !== 'string' && typeof i !== 'number' && typeof i !== 'symbol')) {
          throw new Error(`The operand for condition with in operator must be one of the following types: (string | number | symbol)[]. (received: ${typeof operand})`)
        }

        if (value === null || typeof value === 'undefined') {
          return permission.inverted
            ? true
            : false
        }

        const opd = operand as (string | number | symbol)[]

        if (options?.caseInsensitive) {
          return permission.inverted
            ? !opd.map(i => (typeof i === 'string' ? i.toLowerCase() : i)).includes((typeof value === 'string' ? value.toLowerCase() : value))
            : opd.map(i => (typeof i === 'string' ? i.toLowerCase() : i)).includes((typeof value === 'string' ? value.toLowerCase() : value))
        }

        return permission.inverted
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
          return permission.inverted
            ? true
            : false
        }

        if (options?.caseInsensitive) {
          return permission.inverted
            ? !value.toLowerCase().includes(operand.toLowerCase())
            : value.toLowerCase().includes(operand.toLowerCase())
        }

        return permission.inverted
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
          return permission.inverted
            ? true
            : false
        }

        if (options?.caseInsensitive) {
          return permission.inverted
            ? !value.toLowerCase().startsWith(operand.toLowerCase())
            : value.toLowerCase().startsWith(operand.toLowerCase())
        }

        return permission.inverted
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
          return permission.inverted
            ? true
            : false
        }

        if (options?.caseInsensitive) {
          return permission.inverted
            ? !value.toLowerCase().endsWith(operand.toLowerCase())
            : value.toLowerCase().endsWith(operand.toLowerCase())
        }

        return permission.inverted
          ? !value.endsWith(operand)
          : value.endsWith(operand)
      }

      case 'gt': {
        // possible value types: null, undefined, string, number, date
        if (
          value !== null &&
          typeof value !== 'undefined' &&
          typeof value !== 'string' &&
          typeof value !== 'number' &&
          !(value instanceof Date)
        ) {
          throw new TypeError(`Unexpected resource value type while evaluating condition with gt operator. (received: ${typeof value})`)
        }
        // possible operand types: number, date
        if (
          typeof operand !== 'number' &&
          !(operand instanceof Date)
        ) {
          throw new TypeError(`The operand for condition with gt operator must be one of the following types: number, date. (received: ${typeof operand})`)
        }

        if (value === null || typeof value === 'undefined') {
          return permission.inverted
            ? true
            : false
        }

        // Coerce resource value to number
        let gtNumberValue = value instanceof Date ? value.getTime() : undefined
        if (typeof value === 'string') {
          try {
            gtNumberValue = new Date(value).getTime()
          } catch {
            gtNumberValue = undefined
          }
        }

        if (!gtNumberValue) {
          return permission.inverted
            ? true
            : false
        }

        return permission.inverted
          ? gtNumberValue < (operand instanceof Date ? operand.getTime() : operand)
          : gtNumberValue > (operand instanceof Date ? operand.getTime() : operand)
      }

      case 'gte': {
        // possible value types: null, undefined, string, number, date
        if (
          value !== null &&
          typeof value !== 'undefined' &&
          typeof value !== 'string' &&
          typeof value !== 'number' &&
          !(value instanceof Date)
        ) {
          throw new TypeError(`Unexpected resource value type while evaluating condition with gte operator. (received: ${typeof value})`)
        }
        // possible operand types: number, date
        if (
          typeof operand !== 'number' &&
          !(operand instanceof Date)
        ) {
          throw new TypeError(`The operand for condition with gte operator must be one of the following types: number, date. (received: ${typeof operand})`)
        }

        if (value === null || typeof value === 'undefined') {
          return permission.inverted
            ? true
            : false
        }

        // Coerce resource value to number
        let gteNumberValue = value instanceof Date ? value.getTime() : undefined
        if (typeof value === 'string') {
          try {
            gteNumberValue = new Date(value).getTime()
          } catch {
            gteNumberValue = undefined
          }
        }

        if (!gteNumberValue) {
          return permission.inverted
            ? true
            : false
        }

        return permission.inverted
          ? gteNumberValue <= (operand instanceof Date ? operand.getTime() : operand)
          : gteNumberValue >= (operand instanceof Date ? operand.getTime() : operand)
      }

      default: {
        return false
      }
    }
  })
}
