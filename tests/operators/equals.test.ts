import { describe, expect, it } from 'vitest';
import { matchRuleCondition } from '../../src/utils';
import { matchConditionExpression } from '../../src/utils';

describe('matchConditionExpression / matchRuleCondition - equals operator', () => {
  // ---------------------------------------------------------------------------
  // Tests via matchRuleCondition (properly typed - no casts needed)
  // ---------------------------------------------------------------------------

  it('returns true for null === null', () => {
    expect(matchRuleCondition({ value: null }, { value: ['eq', null] })).toBe(true);
  });

  it('returns true for undefined === undefined', () => {
    expect(matchRuleCondition({ value: undefined }, { value: ['eq', undefined] })).toBe(true);
  });

  it('returns false for null !== undefined', () => {
    expect(matchRuleCondition({ value: null }, { value: ['eq', undefined] })).toBe(false);
  });

  it('returns false for undefined !== null', () => {
    expect(matchRuleCondition({ value: undefined }, { value: ['eq', null] })).toBe(false);
  });

  it('returns true for matching strings', () => {
    expect(matchRuleCondition({ title: 'test' }, { title: ['eq', 'test'] })).toBe(true);
  });

  it('returns false for non-matching strings', () => {
    expect(matchRuleCondition({ title: 'Test' }, { title: ['eq', 'test'] })).toBe(false);
  });

  it('returns true for case-insensitive string match', () => {
    expect(
      matchRuleCondition({ title: 'Test' }, { title: ['eq', 'test', { caseInsensitive: true }] }),
    ).toBe(true);
  });

  it('returns true for case-insensitive string match (reversed casing)', () => {
    expect(
      matchRuleCondition({ title: 'test' }, { title: ['eq', 'Test', { caseInsensitive: true }] }),
    ).toBe(true);
  });

  it('returns true for matching numbers', () => {
    expect(matchRuleCondition({ count: 123 }, { count: ['eq', 123] })).toBe(true);
  });

  it('returns false for non-matching numbers', () => {
    expect(matchRuleCondition({ count: 123 }, { count: ['eq', 456] })).toBe(false);
  });

  it('returns true for matching floats', () => {
    expect(matchRuleCondition({ ratio: 123.456 }, { ratio: ['eq', 123.456] })).toBe(true);
  });

  it('returns false for non-matching float vs int', () => {
    expect(matchRuleCondition({ ratio: 123 }, { ratio: ['eq', 123.456] })).toBe(false);
  });

  it('returns true for matching booleans (true)', () => {
    expect(matchRuleCondition({ active: true }, { active: ['eq', true] })).toBe(true);
  });

  it('returns true for matching booleans (false)', () => {
    expect(matchRuleCondition({ active: false }, { active: ['eq', false] })).toBe(true);
  });

  it('returns false for non-matching booleans', () => {
    expect(matchRuleCondition({ active: true }, { active: ['eq', false] })).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Invalid type tests via matchConditionExpression (cast needed to bypass TS)
  // ---------------------------------------------------------------------------

  it('should throw TypeError for unexpected resource value type', () => {
    // as any is required here because we intentionally pass a plain object value
    // to the eq handler via matchConditionExpression to test the runtime
    // TypeError validation. The type system would normally prevent this.
    const expression = ['eq', 'test'] as any;
    expect(() => matchConditionExpression({ value: { key: 'value' }, expression })).toThrow(
      TypeError,
    );
  });

  it('should throw TypeError for invalid operand type', () => {
    // as any is required here because we intentionally pass a plain object
    // as the eq operand to test the runtime TypeError validation.
    const expression = ['eq', { key: 'value' }] as any;
    expect(() => matchConditionExpression({ value: 'test', expression })).toThrow(TypeError);
  });
});
