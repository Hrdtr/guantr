/**
 * Error thrown when the circuit breaker trips due to excessive rule iterations.
 * Indicates that the number of rules evaluated for a single permission check
 * exceeded the configured `maxRuleIterations` limit.
 *
 * @example
 * ```ts
 * try {
 *   await guantr.can('read', ['post', { id: 1 }]);
 * } catch (e) {
 *   if (e instanceof GuantrCircuitBreakerError) {
 *     console.error(e.message);
 *     console.error(e.action, e.resource, e.limit);
 *   }
 * }
 * ```
 */
export class GuantrCircuitBreakerError extends Error {
  /** The action being checked when the circuit breaker tripped. */
  action: string;
  /** The resource key being checked when the circuit breaker tripped. */
  resource: string;
  /** The configured iteration limit that was exceeded. */
  limit: number;

  constructor(action: string, resource: string, limit: number) {
    super(
      `[guantr] Circuit breaker tripped: rule iteration limit (${limit}) exceeded while evaluating action "${action}" on resource "${resource}". ` +
        `Consider reducing the number of rules or increasing the \`maxRuleIterations\` option.`,
    );
    this.name = 'GuantrCircuitBreakerError';
    this.action = action;
    this.resource = resource;
    this.limit = limit;
  }
}

/**
 * Error thrown when an unknown operator is encountered during condition evaluation.
 * This is thrown by `matchConditionExpression` when it encounters an operator that does not
 * correspond to any known `ConditionOperator` value.
 *
 * @example
 * ```ts
 * try {
 *   matchConditionExpression({ value: 'foo', expression: ['unknownOp', 'bar'] });
 * } catch (e) {
 *   if (e instanceof GuantrInvalidConditionOperatorError) {
 *     console.error('Unknown operator:', e.operator);
 *   }
 * }
 * ```
 */
export class GuantrInvalidConditionOperatorError extends Error {
  /** The unrecognized operator string that caused the error. */
  operator: string;

  constructor(operator: string) {
    super(
      `[guantr] Unknown condition operator: "${operator}". ` +
        `Ensure the operator is one of the supported ConditionOperator values.`,
    );
    this.name = 'GuantrInvalidConditionOperatorError';
    this.operator = operator;
  }
}

/**
 * Error thrown when a condition fails validation at rule-definition time.
 * This is thrown by `setRules` when a condition contains an unrecognized operator or has
 * malformed structure (e.g. a condition expression that is not a valid `[operator, operand]` tuple).
 *
 * @example
 * ```ts
 * try {
 *   await guantr.setRules([
 *     { effect: 'allow', action: 'read', resource: 'post', condition: { id: ['unknownOp', 1] } },
 *   ]);
 * } catch (e) {
 *   if (e instanceof GuantrInvalidConditionError) {
 *     console.error('Bad condition:', e.condition, 'Reason:', e.reason);
 *   }
 * }
 * ```
 */
export class GuantrInvalidConditionError extends Error {
  /** The condition value (expression or object) that failed validation. */
  condition: unknown;
  /** A human-readable description of why the condition is invalid. */
  reason: string;

  constructor(condition: unknown, reason: string) {
    super(`[guantr] Invalid condition: ${reason}`);
    this.name = 'GuantrInvalidConditionError';
    this.condition = condition;
    this.reason = reason;
  }
}

/**
 * Error thrown when a condition references a key that does not exist on the resource
 * instance being evaluated. This catches typos and misconfigured rules at evaluation
 * time rather than silently returning `false`.
 *
 * **Opt-out:** When the operand of a condition expression is `null` or `undefined`,
 * the key-existence check is skipped — this signals that the developer intentionally
 * handles sparse objects where the key may be absent.
 *
 * @example
 * ```ts
 * // Throws: 'titel' does not exist on the resource
 * try {
 *   await guantr.can('read', ['post', { title: 'Hello' }]);
 *   // Rule condition: { titel: ['eq', 'Hello'] }  ← typo
 * } catch (e) {
 *   if (e instanceof GuantrInvalidConditionKeyError) {
 *     console.error('Missing key:', e.key);
 *   }
 * }
 * ```
 *
 * @example
 * ```ts
 * // Opt-out: explicit nullish operand signals sparse object intent
 * { optionalField: ['eq', undefined] }  // No error even if optionalField is absent
 * ```
 */
export class GuantrInvalidConditionKeyError extends Error {
  /** The key that does not exist on the resource model. */
  key: string;

  constructor(key: string) {
    super(
      `[guantr] Invalid condition key: "${key}" does not exist on the resource instance. ` +
        `If this key is intentionally optional, use an explicit nullish operand to opt out: ` +
        `{ ${key}: ['eq', undefined] } or { ${key}: ['eq', null] }.`,
    );
    this.name = 'GuantrInvalidConditionKeyError';
    this.key = key;
  }
}
