import {
  GuantrInvalidConditionError,
  GuantrInvalidConditionKeyError,
  GuantrInvalidConditionOperatorError,
} from './errors';
import {
  ConditionOperator,
  ConditionOptions,
  GuantrRuleCondition,
  GuantrRuleConditionExpression,
  GuantrRule,
} from './types';

/**
 * Checks if the given path is a string and starts with '$ctx.'.
 *
 * @param {unknown} path - The path to check.
 * @return {boolean} - Returns true if the path is a string and starts with '$ctx.', otherwise returns false.
 */
export const isContextualOperand = (path: unknown): path is string =>
  typeof path === 'string' && path.startsWith('$ctx.');

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
  Array.isArray(value) && value.every((item) => isString(item) || isNumber(item));

/**
 * Type guard for checking if a value is an array of plain objects.
 *
 * @param {unknown} value - The value to check.
 * @return {boolean} - Returns true if the value is an array where every item is a plain object, otherwise returns false.
 *
 * A plain object is an object that is not null, is an object, and is not an array.
 */
const isObjectArray = (value: unknown): value is Record<string, unknown>[] =>
  Array.isArray(value) && value.every((item) => isPlainObject(item));

/**
 * The set of all recognized `ConditionOperator` values.
 * Used to validate operator strings at rule-definition time and during evaluation.
 */
export const KNOWN_OPERATORS: ReadonlySet<string> = new Set<ConditionOperator>([
  'eq',
  'in',
  'contains',
  'startsWith',
  'endsWith',
  'gt',
  'gte',
  'has',
  'hasSome',
  'hasEvery',
  'some',
  'every',
  'none',
]);

/**
 * Type guard for checking if a value is a structurally valid condition expression.
 *
 * A condition expression is an array with at least two elements. The first element is a string that represents the condition
 * operator. The second element is the operand, which may be a string, number, boolean, or an array of strings or numbers.
 * The third element is an optional object that contains additional options for the condition expression.
 *
 * This is a structural check only — the operator is NOT validated against `KNOWN_OPERATORS` here.
 * Operator validation is performed by `validateCondition` (at definition time) and
 * `matchConditionExpression` (at evaluation time).
 *
 * @param {unknown} maybeExpression - The value to check.
 * @return {maybeExpression is GuantrRuleConditionExpression} - Returns true if the value is a structurally valid condition expression, otherwise returns false.
 */
export const isConditionExpressionLike = (
  maybeExpression: unknown,
): maybeExpression is GuantrRuleConditionExpression => {
  if (
    !Array.isArray(maybeExpression) ||
    maybeExpression.length < 2 ||
    typeof maybeExpression[0] !== 'string'
  ) {
    return false;
  }
  return true;
};

/**
 * Recursively validates a condition object (or expression).
 * Throws `GuantrInvalidConditionError` if any expression has malformed structure
 * or uses an operator that is not a recognized `ConditionOperator`.
 *
 * This is called by `setRules` to catch problems at definition time rather than
 * throwing at evaluation time.
 *
 * @param {GuantrRule['condition']} condition - The condition to validate.
 * @param {string} [_path] - Dot-notation path used for error messages (populated by recursion).
 * @throws {GuantrInvalidConditionError}
 */
export function validateCondition(condition: GuantrRule['condition'], _path: string = ''): void {
  if (condition === null || condition === undefined) return;
  if (!isPlainObject(condition)) {
    throw new GuantrInvalidConditionError(
      condition,
      `Invalid condition at "${_path || '<root>'}": expected a condition object`,
    );
  }

  for (const [key, value] of Object.entries(condition)) {
    const path = _path ? `${_path}.${key}` : key;
    _validateConditionValue(value, path);
  }
}

function _validateConditionValue(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    // Must be a well-formed condition expression: [operator, operand, ?options]
    if (value.length < 2 || typeof value[0] !== 'string') {
      throw new GuantrInvalidConditionError(
        value,
        `Malformed condition expression at "${path}": must be [operator, operand, ?options] where operator is a string`,
      );
    }
    const operator = value[0] as string;
    if (!KNOWN_OPERATORS.has(operator)) {
      throw new GuantrInvalidConditionError(
        value,
        `Unknown operator "${operator}" at "${path}". Valid operators: ${[...KNOWN_OPERATORS].join(', ')}`,
      );
    }
    // For some/every/none the operand is itself a nested condition object — validate it too
    if (
      (operator === 'some' || operator === 'every' || operator === 'none') &&
      isPlainObject(value[1])
    ) {
      validateCondition(value[1] as GuantrRuleCondition, path);
    }
  } else if (isPlainObject(value)) {
    // Could be a nested condition object (possibly with a $expr sibling key)
    const { $expr, ...nested } = value as Record<string, unknown>;
    if ($expr !== undefined) {
      _validateConditionValue($expr, `${path}.$expr`);
    }
    validateCondition(nested as GuantrRuleCondition, path);
  } else {
    throw new GuantrInvalidConditionError(
      value,
      `Invalid condition value at "${path}": expected a condition expression array or a nested condition object, got ${typeof value}`,
    );
  }
}

/**
 * Retrieves a value from a context object using a dot-notation path
 *
 * @template T - The type of the context object.
 * @template U - The type of the value to retrieve.
 * @param {T} context - The context object to search in.
 * @param {string} path - The dot-separated path to the value.
 * @return {U | undefined} The value at the specified path, or undefined if not found.
 */
export const getContextValue = <T extends Record<string, unknown>, U>(
  context: T,
  path: string,
): U => {
  if (!context) {
    return undefined as U;
  }

  const normalizedPath = path.replace(/^\$ctx\./, '').replaceAll('?.', '.');

  // oxlint-disable-next-line typescript/no-explicit-any
  let current: Record<string, any> = context;
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
 * @param {string} label - A label describing what is being validated (e.g., 'value' or 'operand').
 * @param {(value: unknown) => boolean} [customValidator] - An optional custom validator that will be called with the value as an argument.
 * @throws {TypeError} If the value does not match the allowed types or the custom validator returns false.
 */
export function validateValueType(
  value: unknown,
  allowedTypes: Array<'string' | 'number' | 'boolean' | 'array' | 'object' | 'null' | 'undefined'>,
  operator: string,
  label: string,
  customValidator?: (value: unknown) => boolean,
) {
  // Always allow null and undefined
  if (value === null || value === undefined) return;

  // Check if type is allowed
  const typeMatches = allowedTypes.some((type) => {
    switch (type) {
      case 'string': {
        return isString(value);
      }
      case 'number': {
        return isNumber(value);
      }
      case 'boolean': {
        return typeof value === 'boolean';
      }
      case 'array': {
        return Array.isArray(value);
      }
      case 'object': {
        return isPlainObject(value);
      }
      case 'null': {
        return value === null;
      }
      case 'undefined': {
        return value === undefined;
      }
      default: {
        return false;
      }
    }
  });

  // Check custom validator if provided
  const customValidation = customValidator ? customValidator(value) : true;
  if (!typeMatches || !customValidation) {
    throw new TypeError(
      `Unexpected ${label} type for ${operator} operator. Expected: ${allowedTypes.join(' | ')}`,
    );
  }
}

// Define specialized handlers for each operator
export const conditionHandlers: Record<
  ConditionOperator,
  (value: unknown, operand: unknown, options?: ConditionOptions) => boolean
> = {
  // Equals operator: checks if value equals operand
  eq: (value, operand, options) => {
    validateValueType(value, ['string', 'number', 'boolean', 'null', 'undefined'], 'eq', 'value');
    validateValueType(
      operand,
      ['string', 'number', 'boolean', 'null', 'undefined'],
      'eq',
      'operand',
    );

    // Handle case-insensitive string comparison
    if (options?.caseInsensitive && isString(operand) && isString(value)) {
      return value.toLowerCase() === operand.toLowerCase();
    }
    return value === operand;
  },

  // In operator: checks if value is in operand array
  in: (value, operand, options) => {
    validateValueType(value, ['string', 'number', 'null', 'undefined'], 'in', 'value');
    if (!isStringOrNumberArray(operand)) {
      throw new TypeError(
        `The operand for condition with in operator must be an array of strings or numbers.`,
      );
    }

    if (value === null || value === undefined) {
      return false;
    }

    // Handle case-insensitive comparison
    if (options?.caseInsensitive && isString(value)) {
      return operand.some((item) => isString(item) && item.toLowerCase() === value.toLowerCase());
    }
    return operand.includes(value as string | number);
  },

  // Contains operator: checks if string value contains string operand
  contains: (value, operand, options) => {
    validateValueType(value, ['string', 'null', 'undefined'], 'contains', 'value');
    if (!isString(operand)) {
      throw new TypeError(`The operand for condition with contains operator must be a string.`);
    }

    if (value === null || value === undefined) {
      return false;
    }

    // Handle case-insensitive comparison
    if (options?.caseInsensitive) {
      return (value as string).toLowerCase().includes(operand.toLowerCase());
    }
    return (value as string).includes(operand);
  },

  // StartsWith operator: checks if string value starts with string operand
  startsWith: (value, operand, options) => {
    validateValueType(value, ['string', 'null', 'undefined'], 'startsWith', 'value');
    if (!isString(operand)) {
      throw new TypeError(`The operand for condition with startsWith operator must be a string.`);
    }

    if (value === null || value === undefined) {
      return false;
    }

    // Handle case-insensitive comparison
    if (options?.caseInsensitive) {
      return (value as string).toLowerCase().startsWith(operand.toLowerCase());
    }
    return (value as string).startsWith(operand);
  },

  // EndsWith operator: checks if string value ends with string operand
  endsWith: (value, operand, options) => {
    validateValueType(value, ['string', 'null', 'undefined'], 'endsWith', 'value');
    if (!isString(operand)) {
      throw new TypeError(`The operand for condition with endsWith operator must be a string.`);
    }

    if (value === null || value === undefined) {
      return false;
    }

    // Handle case-insensitive comparison
    if (options?.caseInsensitive) {
      return (value as string).toLowerCase().endsWith(operand.toLowerCase());
    }
    return (value as string).endsWith(operand);
  },

  // Greater than operator: checks if number value is greater than number operand
  gt: (value, operand) => {
    validateValueType(value, ['number', 'null', 'undefined'], 'gt', 'value');
    if (!isNumber(operand)) {
      throw new TypeError(`The operand for condition with gt operator must be a number.`);
    }

    if (value === null || value === undefined) {
      return false;
    }

    return (value as number) > operand;
  },

  // Greater than or equal operator: checks if number value is greater than or equal to number operand
  gte: (value, operand) => {
    validateValueType(value, ['number', 'null', 'undefined'], 'gte', 'value');
    if (!isNumber(operand)) {
      throw new TypeError(`The operand for condition with gte operator must be a number.`);
    }

    if (value === null || value === undefined) {
      return false;
    }

    return (value as number) >= operand;
  },

  // Has operator: checks if array value has operand
  has: (value, operand, options) => {
    validateValueType(value, ['array', 'null', 'undefined'], 'has', 'value', (item) =>
      isStringOrNumberArray(item),
    );
    if (!isString(operand) && !isNumber(operand)) {
      throw new TypeError(
        `The operand for condition with has operator must be a string or number.`,
      );
    }

    if (value === null || value === undefined) {
      return false;
    }

    // Handle case-insensitive comparison
    if (options?.caseInsensitive && isString(operand)) {
      return (value as (string | number)[]).some(
        (item) => isString(item) && item.toLowerCase() === operand.toLowerCase(),
      );
    }
    return (value as (string | number)[]).includes(operand);
  },

  // HasSome operator: checks if array value has some of operand array
  hasSome: (value, operand, options) => {
    validateValueType(value, ['array', 'null', 'undefined'], 'hasSome', 'value', (item) =>
      isStringOrNumberArray(item),
    );
    if (!isStringOrNumberArray(operand)) {
      throw new TypeError(
        `The operand for condition with hasSome operator must be an array of strings or numbers.`,
      );
    }

    if (value === null || value === undefined) {
      return false;
    }

    // Handle case-insensitive comparison
    if (options?.caseInsensitive) {
      return operand.some((op) =>
        (value as (string | number)[]).some(
          (val) =>
            (isString(op) && isString(val) && op.toLowerCase() === val.toLowerCase()) || op === val,
        ),
      );
    }
    return operand.some((op) => (value as (string | number)[]).includes(op));
  },

  // HasEvery operator: checks if array value has every operand array item
  hasEvery: (value, operand, options) => {
    validateValueType(value, ['array', 'null', 'undefined'], 'hasEvery', 'value', (item) =>
      isStringOrNumberArray(item),
    );
    if (!isStringOrNumberArray(operand)) {
      throw new TypeError(
        `The operand for condition with hasEvery operator must be an array of strings or numbers.`,
      );
    }

    if (value === null || value === undefined) {
      return false;
    }

    // Handle case-insensitive comparison
    if (options?.caseInsensitive) {
      return operand.every((op) =>
        (value as (string | number)[]).some(
          (val) =>
            (isString(op) && isString(val) && op.toLowerCase() === val.toLowerCase()) || op === val,
        ),
      );
    }
    return operand.every((op) => (value as (string | number)[]).includes(op));
  },

  // Some operator: checks if some array items match condition
  some: (value, operand) => {
    validateValueType(value, ['array', 'null', 'undefined'], 'some', 'value', (item) =>
      isObjectArray(item),
    );
    if (!isPlainObject(operand)) {
      throw new TypeError(`The operand for condition with some operator must be an object.`);
    }

    if (value === null || value === undefined) {
      return false;
    }
    return (value as Record<string, unknown>[]).some((item) =>
      checkComplexCondition(item, operand),
    );
  },

  // Every operator: checks if every array item matches condition
  every: (value, operand) => {
    validateValueType(value, ['array', 'null', 'undefined'], 'every', 'value', (item) =>
      isObjectArray(item),
    );
    if (!isPlainObject(operand)) {
      throw new TypeError(`The operand for condition with every operator must be an object.`);
    }

    // oxlint-disable-next-line typescript/no-explicit-any
    if (value === null || value === undefined || (value as any[]).length === 0) {
      return false;
    }
    return (value as Record<string, unknown>[]).every((item) =>
      checkComplexCondition(item, operand),
    );
  },

  // None operator: checks if no array items match condition
  none: (value, operand) => {
    validateValueType(value, ['array', 'null', 'undefined'], 'none', 'value', (item) =>
      isObjectArray(item),
    );
    if (!isPlainObject(operand)) {
      throw new TypeError(`The operand for condition with none operator must be an object.`);
    }

    // oxlint-disable-next-line typescript/no-explicit-any
    if (value === null || value === undefined || (value as any[]).length === 0) {
      return true;
    }
    return (value as Record<string, unknown>[]).every(
      (item) => !checkComplexCondition(item, operand),
    );
  },
};

/**
 * Evaluates `some`, `every`, or `none` operators with recursive condition matching.
 */
function _evaluateComplexOperator(
  operator: 'some' | 'every' | 'none',
  value: unknown,
  operand: unknown,
): boolean {
  validateValueType(value, ['array', 'null', 'undefined'], operator, 'value', (item) =>
    isObjectArray(item),
  );
  if (!isPlainObject(operand)) {
    throw new TypeError(`The operand for condition with ${operator} operator must be an object.`);
  }

  // oxlint-disable-next-line typescript/no-explicit-any
  if (value === null || value === undefined || (value as any[]).length === 0) {
    return operator === 'none';
  }

  const arr = value as Record<string, unknown>[];
  if (operator === 'some') return arr.some((item) => checkComplexCondition(item, operand));
  if (operator === 'every') return arr.every((item) => checkComplexCondition(item, operand));
  return arr.every((item) => !checkComplexCondition(item, operand));
}

/**
 * Helper function to check complex conditions for object array items.
 *
 * **New in v2.0:** Throws `GuantrInvalidConditionKeyError` when a condition
 * key does not exist on the array item, unless the expression uses an
 * explicit nullish operand to opt out.
 */
function checkComplexCondition(
  item: Record<string, unknown>,
  operand: Record<string, unknown>,
): boolean {
  return Object.entries(operand).every(([key, expressionOrNestedCondition]) => {
    const keyExists = Object.hasOwn(item, key);

    if (!keyExists && !isExplicitNullishCheck(expressionOrNestedCondition)) {
      throw new GuantrInvalidConditionKeyError(key);
    }

    if (isConditionExpressionLike(expressionOrNestedCondition)) {
      return matchConditionExpression({
        value: item[key],
        expression: expressionOrNestedCondition,
      });
    } else if (isPlainObject(expressionOrNestedCondition)) {
      if (!isPlainObject(item[key])) {
        return false;
      }

      return matchRuleCondition(
        item[key] as Record<string, unknown>,
        expressionOrNestedCondition as GuantrRuleCondition,
      );
    } else {
      throw new TypeError(
        `Unexpected expression value type: ${typeof expressionOrNestedCondition}`,
      );
    }
  });
}

/**
 * Checks whether a condition expression is an explicit nullish check —
 * i.e. its operand is `null` or `undefined`. This signals that the
 * developer intentionally handles sparse objects where the key may be
 * absent, and the key-existence check should be skipped.
 */
function isExplicitNullishCheck(expr: unknown): boolean {
  if (isConditionExpressionLike(expr)) {
    const operand = (expr as unknown[])[1];
    return operand === null || operand === undefined;
  }
  return false;
}

/**
 * Checks if the given model matches the rule condition.
 *
 * **New in v2.0:** Throws `GuantrInvalidConditionKeyError` when a condition
 * references a key that does not exist on the model, unless the condition
 * uses an explicit nullish operand (`null` or `undefined`) to opt out.
 *
 * @param {Model} model - The model to check against the rule condition.
 * @param {GuantrRule & { condition: NonNullable<GuantrRule['condition']> }} condition - The condition to match.
 * @returns {boolean} Returns true if the model matches the rule condition, false otherwise.
 * @throws {GuantrInvalidConditionKeyError} When a condition key does not exist on the model and the operand is not nullish.
 */
export const matchRuleCondition = <Model extends Record<string, unknown>>(
  model: Model,
  condition: NonNullable<GuantrRule['condition']>,
): boolean => {
  if (!model) {
    return false;
  }

  return Object.entries(condition).every(([key, expressionOrNestedCondition]) => {
    const keyExists = Object.hasOwn(model, key);

    // Throw if key does not exist and this is not an explicit nullish check
    if (!keyExists && !isExplicitNullishCheck(expressionOrNestedCondition)) {
      throw new GuantrInvalidConditionKeyError(key);
    }

    const modelValue = model[key];

    if (isConditionExpressionLike(expressionOrNestedCondition)) {
      return matchConditionExpression({
        value: modelValue,
        expression: expressionOrNestedCondition,
      });
    } else if (isPlainObject(expressionOrNestedCondition)) {
      if (!isPlainObject(modelValue) && !Array.isArray(modelValue)) {
        return false;
      }

      const { $expr, ...nestedCondition } = expressionOrNestedCondition;
      const exprResult = $expr
        ? isConditionExpressionLike($expr)
          ? matchConditionExpression({ value: modelValue, expression: $expr })
          : false
        : true;

      return (
        exprResult && matchRuleCondition(modelValue as Record<string, unknown>, nestedCondition)
      );
    } else {
      throw new TypeError(
        `Unexpected expression value type: ${typeof expressionOrNestedCondition}`,
      );
    }
  });
};

/**
 * Evaluates a condition expression against a given value.
 *
 * @param {Object} data - The data object containing the value and expression.
 * @param {unknown} data.value - The value to evaluate the condition against.
 * @param {NonNullable<GuantrRule['condition']>[keyof NonNullable<GuantrRule['condition']>]} data.expression - The condition expression to evaluate.
 * @return {boolean} The result of evaluating the condition expression against the value.
 * @throws {GuantrInvalidConditionOperatorError} If the operator is not a known ConditionOperator.
 * @throws {TypeError} If the model value type is unexpected or the operand type is invalid.
 */
export const matchConditionExpression = (data: {
  value: unknown;
  expression: Extract<
    NonNullable<GuantrRule['condition']>[keyof NonNullable<GuantrRule['condition']>],
    // oxlint-disable-next-line typescript/no-explicit-any
    Array<any>
  >;
}): boolean => {
  const { value, expression } = data;
  if (!expression || expression.length < 2) {
    return false;
  }

  const [operator, operand, options] = expression;

  // some/every/none need recursive nested evaluation
  if (operator === 'some' || operator === 'every' || operator === 'none') {
    return _evaluateComplexOperator(operator, value, operand);
  }

  const handler = conditionHandlers[operator as ConditionOperator];

  if (!handler) {
    throw new GuantrInvalidConditionOperatorError(operator);
  }

  return handler(value, operand, options);
};
