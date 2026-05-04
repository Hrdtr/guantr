import { describe, expect, it } from 'vitest';
import { matchRuleCondition } from '../../src/utils';
import { matchConditionExpression } from '../../src/utils';

describe('hasEvery operator', () => {
  // ---------------------------------------------------------------------------
  // Tests via matchRuleCondition (properly typed)
  // ---------------------------------------------------------------------------

  it('returns true when array has all elements (strings)', () => {
    expect(matchRuleCondition({ tags: ['a', 'b', 'c'] }, { tags: ['hasEvery', ['a', 'b']] })).toBe(
      true,
    );
  });

  it('returns true when array has all elements (numbers)', () => {
    expect(matchRuleCondition({ tags: [1, 2, 3, 4] }, { tags: ['hasEvery', [2, 3, 4]] })).toBe(
      true,
    );
  });

  it('returns false when array does not have all elements', () => {
    expect(matchRuleCondition({ tags: ['x', 'y', 'z'] }, { tags: ['hasEvery', ['y', 'a']] })).toBe(
      false,
    );
  });

  it('returns false when operand has more elements than value', () => {
    expect(matchRuleCondition({ tags: ['a', 'b'] }, { tags: ['hasEvery', ['a', 'b', 'c']] })).toBe(
      false,
    );
  });

  it('returns false for null array', () => {
    expect(matchRuleCondition({ tags: null }, { tags: ['hasEvery', ['element']] })).toBe(false);
  });

  it('returns false for undefined array', () => {
    expect(matchRuleCondition({ tags: undefined }, { tags: ['hasEvery', ['element']] })).toBe(
      false,
    );
  });

  it('returns true for case-insensitive match', () => {
    expect(
      matchRuleCondition(
        { tags: ['A', 'B', 'C'] },
        { tags: ['hasEvery', ['a', 'b'], { caseInsensitive: true }] },
      ),
    ).toBe(true);
  });

  it('returns false for case-insensitive non-match', () => {
    expect(
      matchRuleCondition(
        { tags: ['x', 'y', 'z'] },
        { tags: ['hasEvery', ['Y', 'A'], { caseInsensitive: true }] },
      ),
    ).toBe(false);
  });

  it('returns true for case-insensitive match with mixed types', () => {
    expect(
      matchRuleCondition(
        { tags: ['One', 2, 'Three', 4] },
        { tags: ['hasEvery', ['three', 'one'], { caseInsensitive: true }] },
      ),
    ).toBe(true);
  });

  it('returns true with mixed types in array', () => {
    expect(matchRuleCondition({ tags: [1, 'two', 3] }, { tags: ['hasEvery', [1, 'two']] })).toBe(
      true,
    );
  });

  it('returns true with mixed types case-insensitive', () => {
    expect(
      matchRuleCondition(
        { tags: [1, 'two', 3] },
        { tags: ['hasEvery', [1, 'Two'], { caseInsensitive: true }] },
      ),
    ).toBe(true);
  });

  it('returns false with mixed types no match', () => {
    expect(matchRuleCondition({ tags: [1, 'two', 3] }, { tags: ['hasEvery', [1, 'four']] })).toBe(
      false,
    );
  });

  // ---------------------------------------------------------------------------
  // TypeError tests via matchConditionExpression (cast needed to bypass TS)
  // ---------------------------------------------------------------------------

  it('should throw TypeError for unexpected resource value type', () => {
    // as any needed because we intentionally pass an object as value to test
    // the runtime TypeError for the hasEvery operator
    const expression = ['hasEvery', ['element']] as any;
    expect(() => matchConditionExpression({ value: { key: 'value' }, expression })).toThrow(
      TypeError,
    );
  });

  it('should throw TypeError for invalid operand type', () => {
    // as any needed because we intentionally pass an object as operand to test
    // the runtime TypeError for the hasEvery operator
    const expression = ['hasEvery', { key: 'value' }] as any;
    expect(() => matchConditionExpression({ value: ['a', 'b', 'c'], expression })).toThrow(
      TypeError,
    );
  });
});
