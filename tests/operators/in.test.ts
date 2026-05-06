import { describe, expect, it } from 'vitest';
import { matchRuleCondition } from '../../src/utils';
import { matchConditionExpression } from '../../src/utils';

describe('in operator', () => {
  // ---------------------------------------------------------------------------
  // Tests via matchRuleCondition (properly typed)
  // ---------------------------------------------------------------------------

  it('returns true when number is in array', () => {
    expect(matchRuleCondition({ value: 3 }, { value: ['in', [1, 2, 3, 4, 5]] })).toBe(true);
  });

  it('returns true when string is in array', () => {
    expect(
      matchRuleCondition({ value: 'banana' }, { value: ['in', ['apple', 'banana', 'cherry']] }),
    ).toBe(true);
  });

  it('returns true when string is in another array', () => {
    expect(matchRuleCondition({ value: 'hello' }, { value: ['in', ['hello', 'world']] })).toBe(
      true,
    );
  });

  it('returns false when number is not in array', () => {
    expect(matchRuleCondition({ value: 6 }, { value: ['in', [1, 2, 3, 4, 5]] })).toBe(false);
  });

  it('returns false when string is not in array', () => {
    expect(
      matchRuleCondition({ value: 'pear' }, { value: ['in', ['apple', 'banana', 'cherry']] }),
    ).toBe(false);
  });

  it('returns false when another string is not in array', () => {
    expect(matchRuleCondition({ value: 'goodbye' }, { value: ['in', ['hello', 'world']] })).toBe(
      false,
    );
  });

  it('returns true for case-insensitive match', () => {
    expect(
      matchRuleCondition(
        { value: 'test' },
        { value: ['in', ['test', 'TEST', 'TeSt'], { caseInsensitive: true }] },
      ),
    ).toBe(true);
  });

  it('returns true for case-insensitive match (different casing)', () => {
    expect(
      matchRuleCondition(
        { value: 'case' },
        { value: ['in', ['CaSe', 'CASE', 'case'], { caseInsensitive: true }] },
      ),
    ).toBe(true);
  });

  it('returns false for null value', () => {
    // as any needed because the array contains mixed types (string | number)
    // which is not allowed by the typed in operator operand signature
    // oxlint-disable-next-line typescript/no-explicit-any
    const condition = { value: ['in', ['null', 0]] } as any;
    expect(matchRuleCondition({ value: null }, condition)).toBe(false);
  });

  it('returns false for undefined value', () => {
    // as any needed because the array contains mixed types (string | number)
    // oxlint-disable-next-line typescript/no-explicit-any
    const condition = { value: ['in', ['undefined', 0]] } as any;
    expect(matchRuleCondition({ value: undefined }, condition)).toBe(false);
  });

  it('returns false for empty operand array', () => {
    expect(matchRuleCondition({ value: 'test' }, { value: ['in', []] })).toBe(false);
  });

  it('returns true for empty string in array of one', () => {
    expect(matchRuleCondition({ value: '' }, { value: ['in', ['']] })).toBe(true);
  });

  it('returns true with special characters', () => {
    expect(matchRuleCondition({ value: '@#$%' }, { value: ['in', ['@#$%', 'abc', 'def']] })).toBe(
      true,
    );
  });

  it('returns true with special asterisk', () => {
    expect(
      matchRuleCondition({ value: 'special*' }, { value: ['in', ['*special', 'special*', '*']] }),
    ).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // TypeError tests via matchConditionExpression (cast needed to bypass TS)
  // ---------------------------------------------------------------------------

  it('should throw TypeError for unexpected resource value type', () => {
    // as any needed because we intentionally pass an object as value to test
    // the runtime TypeError for the in operator
    // oxlint-disable-next-line typescript/no-explicit-any
    const expression = ['in', [1, 2, 3]] as any;
    expect(() => matchConditionExpression({ value: { key: 'value' }, expression })).toThrow(
      TypeError,
    );
  });

  it('should throw TypeError for invalid operand type', () => {
    // as any needed because we intentionally pass a non-array as operand to test
    // the runtime TypeError for the in operator
    // oxlint-disable-next-line typescript/no-explicit-any
    const expression = ['in', 'not an array'] as any;
    expect(() => matchConditionExpression({ value: 'test', expression })).toThrow(TypeError);
  });
});
