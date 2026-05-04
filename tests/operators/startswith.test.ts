import { describe, expect, it } from 'vitest';
import { matchRuleCondition } from '../../src/utils';
import { matchConditionExpression } from '../../src/utils';

describe('startsWith operator', () => {
  // ---------------------------------------------------------------------------
  // Tests via matchRuleCondition (properly typed)
  // ---------------------------------------------------------------------------

  it('returns true when string starts with the operand', () => {
    expect(matchRuleCondition({ title: 'hello world' }, { title: ['startsWith', 'hello'] })).toBe(
      true,
    );
  });

  it('returns true for another prefix', () => {
    expect(
      matchRuleCondition({ title: 'javascript testing' }, { title: ['startsWith', 'java'] }),
    ).toBe(true);
  });

  it('returns true for exact prefix', () => {
    expect(
      matchRuleCondition({ title: 'Vitest is great' }, { title: ['startsWith', 'Vitest'] }),
    ).toBe(true);
  });

  it('returns false when string does not start with the operand', () => {
    expect(matchRuleCondition({ title: 'hello world' }, { title: ['startsWith', 'world'] })).toBe(
      false,
    );
  });

  it('returns false for suffix match', () => {
    expect(
      matchRuleCondition({ title: 'javascript testing' }, { title: ['startsWith', 'script'] }),
    ).toBe(false);
  });

  it('returns false for middle substring', () => {
    expect(matchRuleCondition({ title: 'Vitest is great' }, { title: ['startsWith', 'is'] })).toBe(
      false,
    );
  });

  it('returns true for case-insensitive match', () => {
    expect(
      matchRuleCondition(
        { title: 'Case Insensitive Test' },
        { title: ['startsWith', 'case', { caseInsensitive: true }] },
      ),
    ).toBe(true);
  });

  it('returns true for case-insensitive match (different casing)', () => {
    expect(
      matchRuleCondition(
        { title: 'Vitest Is Great' },
        { title: ['startsWith', 'vitest', { caseInsensitive: true }] },
      ),
    ).toBe(true);
  });

  it('returns false for null value', () => {
    expect(matchRuleCondition({ title: null }, { title: ['startsWith', 'null'] })).toBe(false);
  });

  it('returns false for undefined value', () => {
    expect(matchRuleCondition({ title: undefined }, { title: ['startsWith', 'undefined'] })).toBe(
      false,
    );
  });

  it('returns true when both strings are empty', () => {
    expect(matchRuleCondition({ title: '' }, { title: ['startsWith', ''] })).toBe(true);
  });

  it('returns true when operand is empty string', () => {
    expect(matchRuleCondition({ title: 'test string' }, { title: ['startsWith', ''] })).toBe(true);
  });

  it('returns false when value is empty string and operand is not', () => {
    expect(matchRuleCondition({ title: '' }, { title: ['startsWith', 'test'] })).toBe(false);
  });

  it('returns true with special characters prefix', () => {
    expect(matchRuleCondition({ title: 'a!@#$%^&*()' }, { title: ['startsWith', 'a!@#'] })).toBe(
      true,
    );
  });

  it('returns true with special asterisk', () => {
    expect(
      matchRuleCondition(
        { title: 'special*characters*test' },
        { title: ['startsWith', 'special*'] },
      ),
    ).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // TypeError tests via matchConditionExpression (cast needed to bypass TS)
  // ---------------------------------------------------------------------------

  it('should throw TypeError for unexpected resource value type', () => {
    // as any needed because we intentionally pass a number as value to test
    // the runtime TypeError for the startsWith operator
    const expression = ['startsWith', 'test'] as any;
    expect(() => matchConditionExpression({ value: 123, expression })).toThrow(TypeError);
  });

  it('should throw TypeError for invalid operand type', () => {
    // as any needed because we intentionally pass a number as operand to test
    // the runtime TypeError for the startsWith operator
    const expression = ['startsWith', 123] as any;
    expect(() => matchConditionExpression({ value: 'test', expression })).toThrow(TypeError);
  });
});
