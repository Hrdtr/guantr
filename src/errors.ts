/**
 * Error thrown when the circuit breaker trips due to excessive rule iterations.
 * Indicates that the number of rules evaluated for a single permission check
 * exceeded the configured `maxRuleIterations` limit.
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
 * Error thrown when a condition references a key that does not exist on the resource
 * instance being evaluated. This catches typos and misconfigured rules at evaluation
 * time rather than silently returning `false`.
 *
 * **Opt-out:** When the operand of a condition expression is `null` or `undefined`,
 * the key-existence check is skipped — this signals that the developer intentionally
 * handles sparse objects where the key may be absent.
 */
export class GuantrInvalidConditionKeyError extends Error {
  /** The key that does not exist on the resource model. */
  key: string;

  constructor(key: string) {
    super(
      `[guantr] Invalid condition key: "${key}" does not exist on the resource instance. ` +
        `If this key is intentionally optional, use an explicit nullish operand to opt out.`,
    );
    this.name = 'GuantrInvalidConditionKeyError';
    this.key = key;
  }
}
