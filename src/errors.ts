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
 * Error thrown when an unknown operator is encountered during condition evaluation in strict mode.
 * This is thrown by `matchConditionExpression` when it encounters an operator that does not
 * correspond to any known `ConditionOperator` value.
 *
 * @example
 * ```ts
 * try {
 *   matchConditionExpression({ value: 'foo', expression: ['unknownOp', 'bar'], strict: true });
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
        `Ensure the operator is one of the supported ConditionOperator values. ` +
        `If you want silent fallback instead of throwing, set \`strict: false\` in GuantrOptions.`,
    );
    this.name = 'GuantrInvalidConditionOperatorError';
    this.operator = operator;
  }
}

/**
 * Error thrown when a condition fails validation at rule-definition time in strict mode.
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
