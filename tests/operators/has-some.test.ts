import { describe, expect, it } from 'vitest';
import { matchRuleCondition } from '../../src/utils';
import { matchConditionExpression } from '../../src/utils';

describe('hasSome operator', () => {
  // ---------------------------------------------------------------------------
  // Tests via matchRuleCondition (properly typed)
  // ---------------------------------------------------------------------------

  it('returns true when array has some of the elements (string)', () => {
    expect(matchRuleCondition({ tags: ['a', 'b', 'c'] }, { tags: ['hasSome', ['a', 'd']] })).toBe(
      true,
    );
  });

  it('returns true when array has some of the elements (number)', () => {
    expect(matchRuleCondition({ tags: [1, 2, 3] }, { tags: ['hasSome', [4, 2]] })).toBe(true);
  });

  it('returns false when array has none of the elements', () => {
    expect(matchRuleCondition({ tags: ['x', 'y', 'z'] }, { tags: ['hasSome', ['a', 'b']] })).toBe(
      false,
    );
  });

  it('returns false for empty array', () => {
    expect(matchRuleCondition({ tags: [] }, { tags: ['hasSome', ['a', 'b']] })).toBe(false);
  });

  it('returns false for null array', () => {
    expect(matchRuleCondition({ tags: null }, { tags: ['hasSome', ['element']] })).toBe(false);
  });

  it('returns false for undefined array', () => {
    expect(matchRuleCondition({ tags: undefined }, { tags: ['hasSome', ['element']] })).toBe(false);
  });

  it('returns true for case-insensitive match', () => {
    expect(
      matchRuleCondition(
        { tags: ['A', 'B', 'C'] },
        { tags: ['hasSome', ['a', 'd'], { caseInsensitive: true }] },
      ),
    ).toBe(true);
  });

  it('returns false for case-insensitive non-match', () => {
    expect(
      matchRuleCondition(
        { tags: ['x', 'y', 'z'] },
        { tags: ['hasSome', ['A', 'B'], { caseInsensitive: true }] },
      ),
    ).toBe(false);
  });

  it('returns true for case-insensitive match with mixed types', () => {
    expect(
      matchRuleCondition(
        { tags: ['One', 2, 'Three', 4] },
        { tags: ['hasSome', ['three', 'five'], { caseInsensitive: true }] },
      ),
    ).toBe(true);
  });

  it('returns true with mixed types in array', () => {
    expect(matchRuleCondition({ tags: [1, 'two', 3] }, { tags: ['hasSome', ['two', 2]] })).toBe(
      true,
    );
  });

  it('returns true with mixed types case-insensitive', () => {
    expect(
      matchRuleCondition(
        { tags: [1, 'two', 3] },
        { tags: ['hasSome', ['Two', 2], { caseInsensitive: true }] },
      ),
    ).toBe(true);
  });

  it('returns false with mixed types no match', () => {
    expect(matchRuleCondition({ tags: [1, 'two', 3] }, { tags: ['hasSome', ['four', 5]] })).toBe(
      false,
    );
  });

  // ---------------------------------------------------------------------------
  // TypeError tests via matchConditionExpression (cast needed to bypass TS)
  // ---------------------------------------------------------------------------

  it('should throw TypeError for unexpected resource value type', () => {
    // as any needed because we intentionally pass an object as value to test
    // the runtime TypeError for the hasSome operator
    const expression = ['hasSome', ['element']] as any;
    expect(() => matchConditionExpression({ value: { key: 'value' }, expression })).toThrow(
      TypeError,
    );
  });

  it('should throw TypeError for invalid operand type', () => {
    // as any needed because we intentionally pass an object as operand to test
    // the runtime TypeError for the hasSome operator
    const expression = ['hasSome', { key: 'value' }] as any;
    expect(() => matchConditionExpression({ value: ['a', 'b', 'c'], expression })).toThrow(
      TypeError,
    );
  });
});
