import { ConditionOperator, ConditionOptions, GuantrAnyRuleCondition, GuantrAnyRuleConditionExpression, GuantrAnyRule } from "./types"

/**
 * Checks if the given path is a string and starts with either '$ctx.' or 'ctx.'.
 *
 * @param {unknown} path - The path to check.
 * @return {boolean} - Returns true if the path is a string and starts with either '$ctx.' or 'ctx.', otherwise returns false.
 */
export const isContextualOperand = (path: unknown): path is string =>
  typeof path === 'string' && (path.startsWith('$ctx.') || path.startsWith('ctx.'))

/**
 * Type guard for checking if a value is a string
 *
 * @param {unknown} value - The value to check.
 * @return {boolean} - Returns true if the value is a string, otherwise returns false.
 */
const isString = (value: unknown): value is string => typeof value === 'string';

/**
 * Type guard for checking if a value is a number
 *
 * @param {unknown} value - The value to check.
 * @return {boolean} - Returns true if the value is a number, otherwise returns false.
 */
const isNumber = (value: unknown): value is number => typeof value === 'number';

/**
 * Type guard for checking if a value is a plain object.
 *
 * @param {unknown} value - The value to check.
 * @return {boolean} - Returns true if the value is a plain object, otherwise returns false.
 *
 * A plain object is an object that is not null, is an object, and is not an array.
 */
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Type guard for checking if a value is an array of strings or numbers.
 *
 * @param {unknown} value - The value to check.
 * @return {boolean} - Returns true if the value is an array where every item is either a string or a number, otherwise returns false.
 */
const isStringOrNumberArray = (value: unknown): value is (string | number)[] =>
  Array.isArray(value) && value.every(item => isString(item) || isNumber(item));

/**
 * Type guard for checking if a value is an array of plain objects.
 *
 * @param {unknown} value - The value to check.
 * @return {boolean} - Returns true if the value is an array where every item is a plain object, otherwise returns false.
 *
 * A plain object is an object that is not null, is an object, and is not an array.
 */
const isObjectArray = (value: unknown): value is Record<string, unknown>[] =>
  Array.isArray(value) && value.every(item => isPlainObject(item));

/**
 * Type guard for checking if a value is a valid condition expression.
 *
 * A condition expression is an array with at least two elements. The first element is a string that represents the condition
 * operator. The second element is the operand, which may be a string, number, boolean, or an array of strings or numbers.
 * The third element is an optional object that contains additional options for the condition expression.
 *
 * @param {unknown} maybeExpression - The value to check.
 * @return {maybeExpression is GuantrAnyRuleConditionExpression} - Returns true if the value is a valid condition expression, otherwise returns false.
 */
export const isValidConditionExpression = (maybeExpression: unknown): maybeExpression is GuantrAnyRuleConditionExpression =>
  Array.isArray(maybeExpression) && maybeExpression.length >= 2 && typeof maybeExpression[0] === 'string'

/**
 * Retrieves a value from a context object using a dot-notation path
 *
 * @template T - The type of the context object.
 * @template U - The type of the value to retrieve.
 * @param {T} context - The context object to search in.
 * @param {string} path - The dot-separated path to the value.
 * @return {U | undefined} The value at the specified path, or undefined if not found.
 */
export const getContextValue = <T extends Record<string, unknown>, U>(context: T, path: string): U => {
  if (!context) {
    return undefined as U
  };

  const normalizedPath = path
    .replace(/^(\$?ctx\.)/, '')
    .replaceAll('?.', '.');

  let current: any = context;
  for (const part of normalizedPath.split('.')) {
    if (current == null) return current;
    current = current[part];
  }

  return current as U;
};

/**
 * Validates if a given value matches the given allowed types and custom validator.
 * If value is null or undefined, it will always pass validation.
 *
 * @param {unknown} value - The value to validate.
 * @param {Array<'string' | 'number' | 'boolean' | 'array' | 'object' | 'null' | 'undefined'>} allowedTypes - The allowed types for the value.
 * @param {string} operator - The operator that is being validated.
 * @param {(value: unknown) => boolean} [customValidator] - An optional custom validator that will be called with the value as an argument.
 * @throws {TypeError} If the value does not match the allowed types or the custom validator returns false.
 */
export function validateValueType(
  value: unknown,
  allowedTypes: Array<'string' | 'number' | 'boolean' | 'array' | 'object' | 'null' | 'undefined'>,
  operator: string,
  customValidator?: (value: unknown) => boolean
) {
  // Always allow null and undefined
  if (value === null || value === undefined) return;

  // Check if type is allowed
  const typeMatches = allowedTypes.some(type => {
    switch (type) {
      case 'string': {
        return isString(value)
      }
      case 'number': {
        return isNumber(value)
      }
      case 'boolean': {
        return typeof value === 'boolean'
      }
      case 'array': {
        return Array.isArray(value)
      }
      case 'object': {
        return isPlainObject(value)
      }
      case 'null': {
        return value === null
      }
      case 'undefined': {
        return value === undefined
      }
      default: {
        return false
      }
    }
  });

  // Check custom validator if provided
  const customValidation = customValidator ? customValidator(value) : true;
  if (!typeMatches || !customValidation) {
    throw new TypeError(`Unexpected value type for ${operator} operator. Expected: ${allowedTypes.join(' | ')}`);
  }
}

// Define specialized handlers for each operator
const conditionHandlers: Record<ConditionOperator, (value: unknown, operand: unknown, options?: ConditionOptions) => boolean> = {
  // Equals operator: checks if value equals operand
  eq: (value, operand, options) => {
    validateValueType(value, ['string', 'number', 'boolean', 'null', 'undefined'], 'eq');
    validateValueType(operand, ['string', 'number', 'boolean', 'null', 'undefined'], 'eq');

    // Handle case-insensitive string comparison
    if (options?.caseInsensitive && isString(operand) && isString(value)) {
      return value.toLowerCase() === operand.toLowerCase();
    }
    return value === operand;
  },

  // In operator: checks if value is in operand array
  in: (value, operand, options) => {
    validateValueType(value, ['string', 'number', 'null', 'undefined'], 'in');
    if (!isStringOrNumberArray(operand)) {
      throw new TypeError(`The operand for condition with in operator must be an array of strings or numbers.`);
    }

    if (value === null || value === undefined) {
      return false
    };

    // Handle case-insensitive comparison
    if (options?.caseInsensitive && isString(value)) {
      return operand.some(item => isString(item) && item.toLowerCase() === value.toLowerCase());
    }
    return operand.includes(value as string | number);
  },

  // Contains operator: checks if string value contains string operand
  contains: (value, operand, options) => {
    validateValueType(value, ['string', 'null', 'undefined'], 'contains');
    if (!isString(operand)) {
      throw new TypeError(`The operand for condition with contains operator must be a string.`);
    }

    if (value === null || value === undefined) {
      return false
    };

    // Handle case-insensitive comparison
    if (options?.caseInsensitive) {
      return (value as string).toLowerCase().includes(operand.toLowerCase());
    }
    return (value as string).includes(operand);
  },

  // StartsWith operator: checks if string value starts with string operand
  startsWith: (value, operand, options) => {
    validateValueType(value, ['string', 'null', 'undefined'], 'startsWith');
    if (!isString(operand)) {
      throw new TypeError(`The operand for condition with startsWith operator must be a string.`);
    }

    if (value === null || value === undefined) {
      return false
    };

    // Handle case-insensitive comparison
    if (options?.caseInsensitive) {
      return (value as string).toLowerCase().startsWith(operand.toLowerCase());
    }
    return (value as string).startsWith(operand);
  },

  // EndsWith operator: checks if string value ends with string operand
  endsWith: (value, operand, options) => {
    validateValueType(value, ['string', 'null', 'undefined'], 'endsWith');
    if (!isString(operand)) {
      throw new TypeError(`The operand for condition with endsWith operator must be a string.`);
    }

    if (value === null || value === undefined) {
      return false
    };

    // Handle case-insensitive comparison
    if (options?.caseInsensitive) {
      return (value as string).toLowerCase().endsWith(operand.toLowerCase());
    }
    return (value as string).endsWith(operand);
  },

  // Greater than operator: checks if number value is greater than number operand
  gt: (value, operand) => {
    validateValueType(value, ['number', 'null', 'undefined'], 'gt');
    if (!isNumber(operand)) {
      throw new TypeError(`The operand for condition with gt operator must be a number.`);
    }

    if (value === null || value === undefined) {
      return false
    };

    return (value as number) > operand;
  },

  // Greater than or equal operator: checks if number value is greater than or equal to number operand
  gte: (value, operand) => {
    validateValueType(value, ['number', 'null', 'undefined'], 'gte');
    if (!isNumber(operand)) {
      throw new TypeError(`The operand for condition with gte operator must be a number.`);
    }

    if (value === null || value === undefined) {
      return false
    };

    return (value as number) >= operand;
  },

  // Has operator: checks if array value has operand
  has: (value, operand, options) => {
    validateValueType(value, ['array', 'null', 'undefined'], 'has', item => isStringOrNumberArray(item));
    if (!isString(operand) && !isNumber(operand)) {
      throw new TypeError(`The operand for condition with has operator must be a string or number.`);
    }

    if (value === null || value === undefined) {
      return false
    };

    // Handle case-insensitive comparison
    if (options?.caseInsensitive && isString(operand)) {
      return (value as (string | number)[]).some(item => isString(item) && item.toLowerCase() === operand.toLowerCase());
    }
    return (value as (string | number)[]).includes(operand);
  },

  // HasSome operator: checks if array value has some of operand array
  hasSome: (value, operand, options) => {
    validateValueType(value, ['array', 'null', 'undefined'], 'hasSome', item => isStringOrNumberArray(item));
    if (!isStringOrNumberArray(operand)) {
      throw new TypeError(`The operand for condition with hasSome operator must be an array of strings or numbers.`);
    }

    if (value === null || value === undefined) {
      return false
    };

    // Handle case-insensitive comparison
    if (options?.caseInsensitive) {
      return operand.some(op => (value as (string | number)[])
        .some(val => (isString(op) && isString(val) && op.toLowerCase() === val.toLowerCase()) || op === val)
      );
    }
    return operand.some(op => (value as (string | number)[]).includes(op));
  },

  // HasEvery operator: checks if array value has every operand array item
  hasEvery: (value, operand, options) => {
    validateValueType(value, ['array', 'null', 'undefined'], 'hasEvery', item => isStringOrNumberArray(item));
    if (!isStringOrNumberArray(operand)) {
      throw new TypeError(`The operand for condition with hasEvery operator must be an array of strings or numbers.`);
    }

    if (value === null || value === undefined) {
      return false
    };

    // Handle case-insensitive comparison
    if (options?.caseInsensitive) {
      return operand.every(op => (value as (string | number)[])
        .some(val => (isString(op) && isString(val) && op.toLowerCase() === val.toLowerCase()) || op === val)
      );
    }
    return operand.every(op => (value as (string | number)[]).includes(op));
  },

  // Some operator: checks if some array items match condition
  some: (value, operand) => {
    validateValueType(value, ['array', 'null', 'undefined'], 'some', item => isObjectArray(item));
    if (!isPlainObject(operand)) {
      throw new TypeError(`The operand for condition with some operator must be an object.`);
    }

    if (value === null || value === undefined) {
      return false
    };
    return (value as Record<string, unknown>[]).some(item => checkComplexCondition(item, operand));
  },

  // Every operator: checks if every array item matches condition
  every: (value, operand) => {
    validateValueType(value, ['array', 'null', 'undefined'], 'every', item => isObjectArray(item));
    if (!isPlainObject(operand)) {
      throw new TypeError(`The operand for condition with every operator must be an object.`);
    }

    if (value === null || value === undefined || (value as any[]).length === 0) {
      return false
    };
    return (value as Record<string, unknown>[]).every(item => checkComplexCondition(item, operand));
  },

  // None operator: checks if no array items match condition
  none: (value, operand) => {
    validateValueType(value, ['array', 'null', 'undefined'], 'none', item => isObjectArray(item));
    if (!isPlainObject(operand)) {
      throw new TypeError(`The operand for condition with none operator must be an object.`);
    }

    if (value === null || value === undefined || (value as any[]).length === 0) {
      return true
    };
    return (value as Record<string, unknown>[]).every(item => !checkComplexCondition(item, operand));
  }
};

/**
 * Helper function to check complex conditions for object array items
 */
function checkComplexCondition(item: Record<string, unknown>, operand: Record<string, unknown>): boolean {
  return Object.entries(operand).every(([key, expressionOrNestedCondition]) => {
    if (isValidConditionExpression(expressionOrNestedCondition)) {
      return matchConditionExpression({
        value: item[key],
        expression: expressionOrNestedCondition,
      });
    }
    else if (isPlainObject(expressionOrNestedCondition)) {
      if (!isPlainObject(item[key])) {
        return false
      };

      return matchRuleCondition(
        item[key] as Record<string, unknown>,
        expressionOrNestedCondition as GuantrAnyRuleCondition,
      );
    }
    else {
      throw new TypeError(`Unexpected expression value type: ${typeof expressionOrNestedCondition}`);
    }
  });
}

/**
 * Checks if the given model matches the rule condition.
 *
 * @param {Model} model - The model to check against the rule condition.
 * @param {GuantrAnyRule & { condition: NonNullable<GuantrAnyRule['condition']> }} condition - The condition to match.
 * @returns {boolean} Returns true if the model matches the rule condition, false otherwise.
 */
export const matchRuleCondition = <
  Model extends Record<string, unknown>,
>(
  model: Model,
  condition: NonNullable<GuantrAnyRule['condition']>,
): boolean => {
  if (!model) {
    return false
  };

  return Object.entries(condition).every(([key, expressionOrNestedCondition]) => {
    const modelValue = model[key];

    if (isValidConditionExpression(expressionOrNestedCondition)) {
      return matchConditionExpression({
        value: modelValue,
        expression: expressionOrNestedCondition,
      });
    }
    else if (isPlainObject(expressionOrNestedCondition)) {
      if (!isPlainObject(modelValue) && !Array.isArray(modelValue)) {
        return false;
      }

      const { $expr, ...nestedCondition } = expressionOrNestedCondition;
      const exprResult = $expr ? (
        isValidConditionExpression($expr)
            ? matchConditionExpression({ value: modelValue, expression: $expr })
            : false
      ) : true;

      return exprResult && matchRuleCondition(modelValue as Record<string, unknown>, nestedCondition);
    }
    else {
      throw new TypeError(`Unexpected expression value type: ${typeof expressionOrNestedCondition}`);
    }
  });
}

/**
 * Evaluates a condition expression against a given value and ctx.
 *
 * @param {Object} data - The data object containing the value, expression, and optional ctx.
 * @param {unknown} data.value - The value to evaluate the condition against.
 * @param {NonNullable<GuantrAnyRule['condition']>[keyof NonNullable<GuantrAnyRule['condition']>]} data.expression - The condition expression to evaluate.
 * @return {boolean} The result of evaluating the condition expression against the value and ctx.
 * @throws {TypeError} If the model value type is unexpected or the operand type is invalid.
 */
export const matchConditionExpression = (data: {
  value: unknown
  expression: Extract<NonNullable<GuantrAnyRule['condition']>[keyof NonNullable<GuantrAnyRule['condition']>], Array<any>>
}): boolean => {
  const { value, expression } = data;
  if (!expression || expression.length < 2) {
    return false
  };

  const [operator, operand, options] = expression;
  const handler = conditionHandlers[operator as ConditionOperator];

  return handler ? handler(value, operand, options) : false;
}
