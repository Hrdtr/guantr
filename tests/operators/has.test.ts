import { describe, expect, it } from 'vitest';
import { matchRuleCondition } from '../../src/utils';
import { matchConditionExpression } from '../../src/utils';

describe('has operator', () => {
  // ---------------------------------------------------------------------------
  // Tests via matchRuleCondition (properly typed)
  // ---------------------------------------------------------------------------

  it('returns true when array has the element (string)', () => {
    expect(matchRuleCondition({ tags: ['a', 'b', 'c'] }, { tags: ['has', 'a'] })).toBe(true);
  });

  it('returns true when array has the element (number)', () => {
    expect(matchRuleCondition({ tags: [1, 2, 3] }, { tags: ['has', 2] })).toBe(true);
  });

  it('returns false when array does not have the element', () => {
    expect(matchRuleCondition({ tags: ['x', 'y', 'z'] }, { tags: ['has', 'a'] })).toBe(false);
  });

  it('returns false for empty array', () => {
    expect(matchRuleCondition({ tags: [] }, { tags: ['has', 'element'] })).toBe(false);
  });

  it('returns false for null array', () => {
    expect(matchRuleCondition({ tags: null }, { tags: ['has', 'element'] })).toBe(false);
  });

  it('returns false for undefined array', () => {
    expect(matchRuleCondition({ tags: undefined }, { tags: ['has', 'element'] })).toBe(false);
  });

  it('returns true for case-insensitive match', () => {
    expect(
      matchRuleCondition(
        { tags: ['A', 'B', 'C'] },
        { tags: ['has', 'a', { caseInsensitive: true }] },
      ),
    ).toBe(true);
  });

  it('returns false for case-insensitive non-match', () => {
    expect(
      matchRuleCondition(
        { tags: ['x', 'y', 'z'] },
        { tags: ['has', 'A', { caseInsensitive: true }] },
      ),
    ).toBe(false);
  });

  it('returns true for case-insensitive match with mixed types', () => {
    expect(
      matchRuleCondition(
        { tags: ['One', 2, 'Three', 4] },
        { tags: ['has', 'three', { caseInsensitive: true }] },
      ),
    ).toBe(true);
  });

  it('returns true with mixed types in array', () => {
    expect(matchRuleCondition({ tags: [1, 'two', 3] }, { tags: ['has', 'two'] })).toBe(true);
  });

  it('returns false with mixed types (number not found)', () => {
    expect(matchRuleCondition({ tags: [1, 'two', 3] }, { tags: ['has', 2] })).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // TypeError tests via matchConditionExpression (cast needed to bypass TS)
  // ---------------------------------------------------------------------------

  it('should throw TypeError for unexpected resource value type', () => {
    // as any needed because we intentionally pass an object as value to test
    // the runtime TypeError for the has operator
    const expression = ['has', 'element'] as any;
    expect(() => matchConditionExpression({ value: { key: 'value' }, expression })).toThrow(
      TypeError,
    );
  });

  it('should throw TypeError for invalid operand type', () => {
    // as any needed because we intentionally pass an object as operand to test
    // the runtime TypeError for the has operator
    const expression = ['has', { key: 'value' }] as any;
    expect(() => matchConditionExpression({ value: ['a', 'b', 'c'], expression })).toThrow(
      TypeError,
    );
  });
});
