import { describe, expect, it } from 'vitest';
import { matchRuleCondition } from '../../src/utils';
import { matchConditionExpression } from '../../src/utils';

describe('endsWith operator', () => {
  // ---------------------------------------------------------------------------
  // Tests via matchRuleCondition (properly typed)
  // ---------------------------------------------------------------------------

  it('returns true when string ends with the operand', () => {
    expect(matchRuleCondition({ title: 'Hello, world!' }, { title: ['endsWith', 'world!'] })).toBe(
      true,
    );
  });

  it('returns true for another suffix', () => {
    expect(
      matchRuleCondition(
        { title: 'Testing endsWith operator' },
        { title: ['endsWith', 'operator'] },
      ),
    ).toBe(true);
  });

  it('returns false when string does not end with the operand', () => {
    expect(matchRuleCondition({ title: 'Hello, world!' }, { title: ['endsWith', 'world'] })).toBe(
      false,
    );
  });

  it('returns false for wrong suffix', () => {
    expect(
      matchRuleCondition(
        { title: 'Testing endsWith operator' },
        { title: ['endsWith', 'operators'] },
      ),
    ).toBe(false);
  });

  it('returns true for case-insensitive match (uppercase operand)', () => {
    expect(
      matchRuleCondition(
        { title: 'Hello, world!' },
        { title: ['endsWith', 'WORLD!', { caseInsensitive: true }] },
      ),
    ).toBe(true);
  });

  it('returns true for case-insensitive match (lowercase operand)', () => {
    expect(
      matchRuleCondition(
        { title: 'Testing endsWith Operator' },
        { title: ['endsWith', 'operator', { caseInsensitive: true }] },
      ),
    ).toBe(true);
  });

  it('returns false for null value', () => {
    expect(matchRuleCondition({ title: null }, { title: ['endsWith', 'suffix'] })).toBe(false);
  });

  it('returns false for undefined value', () => {
    expect(matchRuleCondition({ title: undefined }, { title: ['endsWith', 'suffix'] })).toBe(false);
  });

  it('returns true with special characters', () => {
    expect(
      matchRuleCondition({ title: 'Special*Characters!' }, { title: ['endsWith', 'Characters!'] }),
    ).toBe(true);
  });

  it('returns true with special characters case-insensitive', () => {
    expect(
      matchRuleCondition(
        { title: 'Special*Characters!' },
        { title: ['endsWith', 'characters!', { caseInsensitive: true }] },
      ),
    ).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // TypeError tests via matchConditionExpression (cast needed to bypass TS)
  // ---------------------------------------------------------------------------

  it('should throw TypeError for unexpected resource value type', () => {
    // as any needed because we intentionally pass an object as value to test
    // the runtime TypeError for the endsWith operator
    const expression = ['endsWith', 'value'] as any;
    expect(() => matchConditionExpression({ value: { key: 'value' }, expression })).toThrow(
      TypeError,
    );
  });

  it('should throw TypeError for invalid operand type', () => {
    // as any needed because we intentionally pass a number as operand to test
    // the runtime TypeError for the endsWith operator
    const expression = ['endsWith', 123] as any;
    expect(() => matchConditionExpression({ value: 'string value', expression })).toThrow(
      TypeError,
    );
  });
});
