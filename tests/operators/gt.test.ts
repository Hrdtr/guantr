import { describe, expect, it } from 'vitest';
import { matchRuleCondition } from '../../src/utils';
import { matchConditionExpression } from '../../src/utils';

describe('gt operator', () => {
  // ---------------------------------------------------------------------------
  // Tests via matchRuleCondition (properly typed)
  // ---------------------------------------------------------------------------

  it('returns true when value is greater than operand', () => {
    expect(matchRuleCondition({ count: 20 }, { count: ['gt', 10] })).toBe(true);
  });

  it('returns false when value is less than operand', () => {
    expect(matchRuleCondition({ count: 5 }, { count: ['gt', 10] })).toBe(false);
  });

  it('returns true for negative numbers', () => {
    expect(matchRuleCondition({ count: -5 }, { count: ['gt', -10] })).toBe(true);
  });

  it('returns false when values are equal', () => {
    expect(matchRuleCondition({ count: 0 }, { count: ['gt', 0] })).toBe(false);
  });

  it('returns false for null value', () => {
    expect(matchRuleCondition({ count: null }, { count: ['gt', 10] })).toBe(false);
  });

  it('returns false for undefined value', () => {
    expect(matchRuleCondition({ count: undefined }, { count: ['gt', 10] })).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // TypeError tests via matchConditionExpression (cast needed to bypass TS)
  // ---------------------------------------------------------------------------

  it('should throw TypeError for unexpected resource value type', () => {
    // as any needed because we intentionally pass an object as value to test
    // the runtime TypeError for the gt operator
    const expression = ['gt', 10] as any;
    expect(() => matchConditionExpression({ value: { key: 'value' }, expression })).toThrow(
      TypeError,
    );
  });

  it('should throw TypeError for invalid operand type', () => {
    // as any needed because we intentionally pass an object as operand to test
    // the runtime TypeError for the gt operator
    const expression = ['gt', { key: 'value' }] as any;
    expect(() => matchConditionExpression({ value: 10, expression })).toThrow(TypeError);
  });
});
