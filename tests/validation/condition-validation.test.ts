import { describe, expect, it } from 'vitest';
import {
  createGuantr,
  GuantrInvalidConditionError,
  GuantrInvalidConditionOperatorError,
  GuantrInvalidConditionKeyError,
  GuantrCircuitBreakerError,
  matchConditionExpression,
  matchRuleCondition,
  validateCondition,
  isConditionExpressionLike,
  KNOWN_OPERATORS,
  conditionHandlers,
} from '../../src/index';

describe('KNOWN_OPERATORS', () => {
  it('should contain all expected operators', () => {
    const expected = [
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
    ] as const;
    for (const op of expected) {
      expect(KNOWN_OPERATORS.has(op)).toBe(true);
    }
    expect(KNOWN_OPERATORS.size).toBe(expected.length);
  });
});

describe('isConditionExpressionLike', () => {
  it('returns true for a well-formed expression with a known operator', () => {
    expect(isConditionExpressionLike(['eq', 'val'])).toBe(true);
  });

  it('returns true for an unknown operator (structural check only)', () => {
    expect(isConditionExpressionLike(['unknownOp', 'val'])).toBe(true);
  });

  it('returns false for structurally malformed expressions', () => {
    expect(isConditionExpressionLike('not array')).toBe(false);
    expect(isConditionExpressionLike(['only'])).toBe(false);
    expect(isConditionExpressionLike([1, 'val'])).toBe(false);
  });
});

describe('validateCondition', () => {
  it('accepts null condition without throwing', () => {
    expect(() => validateCondition(null)).not.toThrow();
  });

  it('accepts a valid flat condition without throwing', () => {
    expect(() => validateCondition({ id: ['eq', 1], title: ['eq', 'test'] })).not.toThrow();
  });

  it('accepts a valid nested condition without throwing', () => {
    expect(() =>
      validateCondition({ address: { city: ['eq', 'NYC'], zip: ['eq', '10001'] } }),
    ).not.toThrow();
  });

  it('accepts some/every/none with a valid nested condition', () => {
    expect(() => validateCondition({ comments: ['some', { authorId: ['eq', 1] }] })).not.toThrow();
  });

  it('throws GuantrInvalidConditionError for an unknown operator', () => {
    // as any needed because 'unknownOp' is not a valid ConditionOperator
    const condition = { id: ['unknownOp', 1] } as any;
    expect(() => validateCondition(condition)).toThrow(GuantrInvalidConditionError);
  });

  it('throws for a malformed expression (too short)', () => {
    // as any needed because ['eq'] is too short to be a valid expression
    const condition = { id: ['eq'] } as any;
    expect(() => validateCondition(condition)).toThrow(GuantrInvalidConditionError);
  });

  it('throws for a malformed expression (non-string operator)', () => {
    // as any needed because the operator is a number, not a string
    const condition = { id: [123, 'value'] } as any;
    expect(() => validateCondition(condition)).toThrow(GuantrInvalidConditionError);
  });
});

describe('validateCondition additional edge cases', () => {
  it('throws for a condition that is not null and not a plain object', () => {
    // as any needed because we intentionally pass an invalid type to
    // validateCondition to test the runtime error handling
    expect(() => validateCondition('not an object' as any)).toThrow(GuantrInvalidConditionError);
  });

  it('throws for a condition value that is neither array nor plain object', () => {
    // as any needed because we intentionally pass a string value inside
    // a condition to test the _validateConditionValue error path
    const condition = { id: 'just a string' } as any;
    expect(() => validateCondition(condition)).toThrow(GuantrInvalidConditionError);
  });
});

describe('matchConditionExpression — operator validation', () => {
  it('throws GuantrInvalidConditionOperatorError for an unknown operator', () => {
    // as any needed because we intentionally pass an invalid operator
    // to verify that matchConditionExpression throws the right error
    const expression = ['unknownOp', 'value'] as any;
    expect(() => matchConditionExpression({ value: 'test', expression })).toThrow(
      GuantrInvalidConditionOperatorError,
    );
  });

  it('includes the operator in the thrown error', () => {
    let caught: unknown;
    try {
      const expression = ['badOp', 'value'] as any;
      matchConditionExpression({ value: 'test', expression });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(GuantrInvalidConditionOperatorError);
    expect((caught as GuantrInvalidConditionOperatorError).operator).toBe('badOp');
  });

  it('evaluates known operators normally', () => {
    // as any needed because we're testing matchConditionExpression directly
    // with valid but dynamically typed expressions
    expect(matchConditionExpression({ value: 'test', expression: ['eq', 'test'] as any })).toBe(
      true,
    );
    expect(matchConditionExpression({ value: 5, expression: ['gt', 3] as any })).toBe(true);
    expect(matchConditionExpression({ value: 5, expression: ['gte', 5] as any })).toBe(true);
  });
});

describe('Guantr setRules — validation at definition time', () => {
  it('accepts valid rules without throwing', async () => {
    const guantr = await createGuantr();
    await expect(
      guantr.setRules([{ effect: 'allow', action: 'read', resource: 'post', condition: null }]),
    ).resolves.not.toThrow();
  });

  it('throws GuantrInvalidConditionError via callback form when an operator is unknown', async () => {
    const guantr = await createGuantr();
    // as any needed because 'unknownOp' is not a valid ConditionOperator
    const condition = { title: ['unknownOp', 'test'] } as any;
    await expect(
      guantr.setRules((allow) => {
        allow('read', ['post', condition]);
      }),
    ).rejects.toThrow(GuantrInvalidConditionError);
  });

  it('throws GuantrInvalidConditionError via array form when an operator is unknown', async () => {
    const guantr = await createGuantr();
    // as any needed because 'unknownOp' is not a valid ConditionOperator
    await expect(
      guantr.setRules([
        {
          effect: 'allow',
          action: 'read',
          resource: 'post',
          condition: { title: ['unknownOp', 'test'] } as any,
        },
      ]),
    ).rejects.toThrow(GuantrInvalidConditionError);
  });

  it('throws for a malformed condition expression', async () => {
    const guantr = await createGuantr();
    // as any needed because ['eq'] is too short to be a valid expression
    await expect(
      guantr.setRules([
        { effect: 'allow', action: 'read', resource: 'post', condition: { title: ['eq'] } as any },
      ]),
    ).rejects.toThrow(GuantrInvalidConditionError);
  });

  it('skips validation for rules with null condition', async () => {
    const guantr = await createGuantr();
    await expect(
      guantr.setRules([{ effect: 'allow', action: 'read', resource: 'post', condition: null }]),
    ).resolves.not.toThrow();
  });

  it('validates nested conditions inside some/every/none operands', async () => {
    const guantr = await createGuantr();
    // as any needed because 'unknownOp' is not a valid ConditionOperator
    await expect(
      guantr.setRules([
        {
          effect: 'allow',
          action: 'read',
          resource: 'post',
          condition: { comments: ['some', { authorId: ['unknownOp', 1] }] } as any,
        },
      ]),
    ).rejects.toThrow(GuantrInvalidConditionError);
  });
});

describe('conditionHandlers direct tests (some/every/none implementations)', () => {
  it('conditionHandlers.some returns false for null value', () => {
    expect(conditionHandlers.some(null, { value: ['gt', 10] })).toBe(false);
  });

  it('conditionHandlers.some returns false for undefined value', () => {
    expect(conditionHandlers.some(undefined, { value: ['gt', 10] })).toBe(false);
  });

  it('conditionHandlers.some throws for non-object operand', () => {
    expect(() => conditionHandlers.some([{ id: 1 }], 42 as any)).toThrow(TypeError);
  });

  it('conditionHandlers.every returns false for null value', () => {
    expect(conditionHandlers.every(null, { value: ['gt', 10] })).toBe(false);
  });

  it('conditionHandlers.every returns false for undefined value', () => {
    expect(conditionHandlers.every(undefined, { value: ['gt', 10] })).toBe(false);
  });

  it('conditionHandlers.every returns false for empty array', () => {
    expect(conditionHandlers.every([], { value: ['gt', 10] })).toBe(false);
  });

  it('conditionHandlers.every throws for non-object operand', () => {
    expect(() => conditionHandlers.every([{ id: 1 }], 42 as any)).toThrow(TypeError);
  });

  it('conditionHandlers.every returns true when all items match the condition', () => {
    expect(
      conditionHandlers.every(
        [
          { id: 1, value: 60 },
          { id: 2, value: 70 },
        ],
        { value: ['gt', 50] },
      ),
    ).toBe(true);
  });

  it('conditionHandlers.every returns false when some items do not match', () => {
    expect(
      conditionHandlers.every(
        [
          { id: 1, value: 40 },
          { id: 2, value: 70 },
        ],
        { value: ['gt', 50] },
      ),
    ).toBe(false);
  });

  it('conditionHandlers.none returns true for null value', () => {
    expect(conditionHandlers.none(null, { value: ['gt', 10] })).toBe(true);
  });

  it('conditionHandlers.none returns true for undefined value', () => {
    expect(conditionHandlers.none(undefined, { value: ['gt', 10] })).toBe(true);
  });

  it('conditionHandlers.none returns true for empty array', () => {
    expect(conditionHandlers.none([], { value: ['gt', 10] })).toBe(true);
  });

  it('conditionHandlers.none throws for non-object operand', () => {
    expect(() => conditionHandlers.none([{ id: 1 }], 42 as any)).toThrow(TypeError);
  });

  it('conditionHandlers.none returns true when no items match the condition', () => {
    expect(
      conditionHandlers.none(
        [
          { id: 1, value: 10 },
          { id: 2, value: 20 },
        ],
        { value: ['gt', 50] },
      ),
    ).toBe(true);
  });

  it('conditionHandlers.none returns false when some items match', () => {
    expect(
      conditionHandlers.none(
        [
          { id: 1, value: 60 },
          { id: 2, value: 20 },
        ],
        { value: ['gt', 50] },
      ),
    ).toBe(false);
  });

  it('conditionHandlers.some returns true when at least one item matches', () => {
    expect(
      conditionHandlers.some(
        [
          { id: 1, value: 10 },
          { id: 2, value: 60 },
        ],
        { value: ['gt', 50] },
      ),
    ).toBe(true);
  });

  it('conditionHandlers.some returns false when no items match', () => {
    expect(
      conditionHandlers.some(
        [
          { id: 1, value: 10 },
          { id: 2, value: 20 },
        ],
        { value: ['gt', 50] },
      ),
    ).toBe(false);
  });
});

describe('matchRuleCondition edge cases', () => {
  it('returns false for nullish model', () => {
    // as any needed because we intentionally pass null as the model
    // to test the matchRuleCondition early return
    expect(matchRuleCondition(null as any, { id: ['eq', 1] })).toBe(false);
  });

  it('throws TypeError for unexpected expression value type', () => {
    // as any needed because we intentionally pass a number as the
    // condition value to test the runtime TypeError
    expect(() => matchRuleCondition({ title: 'test' }, { title: 42 as any })).toThrow(TypeError);
  });

  it('throws TypeError for unexpected nested value type in complex condition', () => {
    // as any needed because we intentionally pass a number as the
    // nested condition value to test the checkComplexCondition TypeError
    expect(() =>
      matchRuleCondition({ items: [{ id: 1 }] }, { items: ['some', { id: 42 as any }] }),
    ).toThrow(TypeError);
  });
});

describe('Error classes', () => {
  it('GuantrCircuitBreakerError has expected properties', () => {
    const error = new GuantrCircuitBreakerError('read', 'post', 100);
    expect(error.action).toBe('read');
    expect(error.resource).toBe('post');
    expect(error.limit).toBe(100);
    expect(error.message).toContain('100');
  });

  it('GuantrInvalidConditionError has expected properties', () => {
    const error = new GuantrInvalidConditionError({ bad: 'value' }, 'test reason');
    expect(error.reason).toBe('test reason');
    expect(error.condition).toEqual({ bad: 'value' });
  });

  it('GuantrInvalidConditionOperatorError has expected properties', () => {
    const error = new GuantrInvalidConditionOperatorError('badOp');
    expect(error.operator).toBe('badOp');
  });

  it('GuantrInvalidConditionKeyError has expected properties', () => {
    const error = new GuantrInvalidConditionKeyError('missingKey');
    expect(error.key).toBe('missingKey');
  });
});
