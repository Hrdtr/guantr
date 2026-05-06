import { describe, expect, it } from 'vitest';
import { matchRuleCondition } from '../../src/utils';
import { matchConditionExpression } from '../../src/utils';

describe('contains operator', () => {
  // ---------------------------------------------------------------------------
  // Tests via matchRuleCondition (properly typed)
  // ---------------------------------------------------------------------------

  it('returns true when string contains the operand', () => {
    expect(matchRuleCondition({ title: 'hello world' }, { title: ['contains', 'world'] })).toBe(
      true,
    );
  });

  it('returns true when string contains another substring', () => {
    expect(
      matchRuleCondition({ title: 'testing with Vitest' }, { title: ['contains', 'Vitest'] }),
    ).toBe(true);
  });

  it('returns true even with spaces', () => {
    expect(
      matchRuleCondition(
        { title: 'JavaScript testing framework' },
        { title: ['contains', 'testing'] },
      ),
    ).toBe(true);
  });

  it('returns false when string does not contain the operand', () => {
    expect(matchRuleCondition({ title: 'hello world' }, { title: ['contains', 'hello!'] })).toBe(
      false,
    );
  });

  it('returns false for absent substring', () => {
    expect(
      matchRuleCondition({ title: 'test driven development' }, { title: ['contains', 'unit'] }),
    ).toBe(false);
  });

  it('returns false for another absent substring', () => {
    expect(matchRuleCondition({ title: 'code review' }, { title: ['contains', 'debug'] })).toBe(
      false,
    );
  });

  it('returns true for case-insensitive match', () => {
    expect(
      matchRuleCondition(
        { title: 'Case Insensitive Test' },
        { title: ['contains', 'case', { caseInsensitive: true }] },
      ),
    ).toBe(true);
  });

  it('returns true for case-insensitive match (different casing)', () => {
    expect(
      matchRuleCondition(
        { title: 'JavaScript is Fun' },
        { title: ['contains', 'javascript', { caseInsensitive: true }] },
      ),
    ).toBe(true);
  });

  it('returns false for null value', () => {
    expect(matchRuleCondition({ title: null }, { title: ['contains', 'null'] })).toBe(false);
  });

  it('returns false for undefined value', () => {
    expect(matchRuleCondition({ title: undefined }, { title: ['contains', 'undefined'] })).toBe(
      false,
    );
  });

  it('returns true when both strings are empty', () => {
    expect(matchRuleCondition({ title: '' }, { title: ['contains', ''] })).toBe(true);
  });

  it('returns true when operand is empty string', () => {
    expect(matchRuleCondition({ title: 'test string' }, { title: ['contains', ''] })).toBe(true);
  });

  it('returns false when value is empty string and operand is not', () => {
    expect(matchRuleCondition({ title: '' }, { title: ['contains', 'test'] })).toBe(false);
  });

  it('returns true with special characters', () => {
    expect(
      matchRuleCondition(
        { title: 'special*characters*test' },
        { title: ['contains', 'characters'] },
      ),
    ).toBe(true);
  });

  it('returns true with special symbols', () => {
    expect(matchRuleCondition({ title: 'a!@#$%^&*()b' }, { title: ['contains', '@#$%'] })).toBe(
      true,
    );
  });

  // ---------------------------------------------------------------------------
  // TypeError tests via matchConditionExpression (cast needed to bypass TS)
  // ---------------------------------------------------------------------------

  it('should throw TypeError for unexpected resource value type', () => {
    // as any needed because we intentionally pass a number as value to test
    // the runtime TypeError for the contains operator
    // oxlint-disable-next-line typescript/no-explicit-any
    const expression = ['contains', 'test'] as any;
    expect(() => matchConditionExpression({ value: 123, expression })).toThrow(TypeError);
  });

  it('should throw TypeError for invalid operand type', () => {
    // as any needed because we intentionally pass a number as operand to test
    // the runtime TypeError for the contains operator
    // oxlint-disable-next-line typescript/no-explicit-any
    const expression = ['contains', 123] as any;
    expect(() => matchConditionExpression({ value: 'test', expression })).toThrow(TypeError);
  });
});
