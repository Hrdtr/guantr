import { describe, expect, it } from 'vitest';
import { matchRuleCondition } from '../../src/utils';
import { matchConditionExpression } from '../../src/utils';

describe('caseInsensitive edge cases', () => {
  // ---------------------------------------------------------------------------
  // Tests via matchRuleCondition (properly typed)
  // ---------------------------------------------------------------------------

  describe('eq', () => {
    it('returns true for equal numbers even when caseInsensitive is true (strict equality)', () => {
      // as any needed because TypeScript only allows caseInsensitive option on
      // string conditions (not number/boolean), but we're testing the runtime
      // behavior where it falls through to strict equality for non-strings
      const expression = ['eq', 42, { caseInsensitive: true }] as any;
      expect(matchConditionExpression({ value: 42, expression })).toBe(true);
    });

    it('returns false for different numbers even when caseInsensitive is true', () => {
      const expression = ['eq', 43, { caseInsensitive: true }] as any;
      expect(matchConditionExpression({ value: 42, expression })).toBe(false);
    });

    it('returns true for equal booleans when caseInsensitive is true (strict equality)', () => {
      const expression = ['eq', true, { caseInsensitive: true }] as any;
      expect(matchConditionExpression({ value: true, expression })).toBe(true);
    });

    it('returns false for non-equal booleans when caseInsensitive is true', () => {
      const expression = ['eq', true, { caseInsensitive: true }] as any;
      expect(matchConditionExpression({ value: false, expression })).toBe(false);
    });

    it('returns false for string value vs number operand with caseInsensitive', () => {
      // as any needed because the type system normally prevents comparing
      // a string value with a number operand via eq
      const expression = ['eq', 42, { caseInsensitive: true }] as any;
      expect(matchConditionExpression({ value: '42', expression })).toBe(false);
    });
  });

  describe('in', () => {
    it('matches a number value in a number array with caseInsensitive true', () => {
      // as any needed because caseInsensitive option is only allowed on string
      // conditions by the type system, but we're testing runtime fallback
      const expression = ['in', [41, 42, 43], { caseInsensitive: true }] as any;
      expect(matchConditionExpression({ value: 42, expression })).toBe(true);
    });

    it('returns false when number value is not in the array with caseInsensitive true', () => {
      const expression = ['in', [41, 42, 43], { caseInsensitive: true }] as any;
      expect(matchConditionExpression({ value: 99, expression })).toBe(false);
    });
  });

  describe('contains', () => {
    it('returns false for null value with caseInsensitive true', () => {
      // as any needed because we intentionally pass null as string value
      // to verify the contains handler's null early-exit behavior
      const expression = ['contains', 'test', { caseInsensitive: true }] as any;
      expect(matchConditionExpression({ value: null, expression })).toBe(false);
    });

    it('returns false for undefined value with caseInsensitive true', () => {
      const expression = ['contains', 'test', { caseInsensitive: true }] as any;
      expect(matchConditionExpression({ value: undefined, expression })).toBe(false);
    });
  });

  describe('startsWith', () => {
    it('returns false for null value with caseInsensitive true', () => {
      const expression = ['startsWith', 'test', { caseInsensitive: true }] as any;
      expect(matchConditionExpression({ value: null, expression })).toBe(false);
    });

    it('returns false for undefined value with caseInsensitive true', () => {
      const expression = ['startsWith', 'test', { caseInsensitive: true }] as any;
      expect(matchConditionExpression({ value: undefined, expression })).toBe(false);
    });
  });

  describe('endsWith', () => {
    it('returns false for null value with caseInsensitive true', () => {
      const expression = ['endsWith', 'test', { caseInsensitive: true }] as any;
      expect(matchConditionExpression({ value: null, expression })).toBe(false);
    });

    it('returns false for undefined value with caseInsensitive true', () => {
      const expression = ['endsWith', 'test', { caseInsensitive: true }] as any;
      expect(matchConditionExpression({ value: undefined, expression })).toBe(false);
    });
  });

  describe('has', () => {
    it('matches a number operand via strict includes when caseInsensitive is true', () => {
      expect(
        matchRuleCondition({ tags: [1, 2, 3] }, { tags: ['has', 2, { caseInsensitive: true }] }),
      ).toBe(true);
    });

    it('returns false when number operand is not in the array with caseInsensitive true', () => {
      expect(
        matchRuleCondition({ tags: [1, 2, 3] }, { tags: ['has', 99, { caseInsensitive: true }] }),
      ).toBe(false);
    });
  });

  describe('hasSome', () => {
    it('returns true for a mixed string+number operand array with case-insensitive string match', () => {
      expect(
        matchRuleCondition(
          { tags: ['hello', 1, 2] },
          { tags: ['hasSome', ['HELLO', 3], { caseInsensitive: true }] },
        ),
      ).toBe(true);
    });

    it('returns false when mixed operand has no matches', () => {
      expect(
        matchRuleCondition(
          { tags: ['world', 4, 5] },
          { tags: ['hasSome', ['HELLO', 3], { caseInsensitive: true }] },
        ),
      ).toBe(false);
    });

    it('matches a number operand via strict equality when caseInsensitive is true', () => {
      expect(
        matchRuleCondition(
          { tags: ['hello', 1, 2] },
          { tags: ['hasSome', [99, 2], { caseInsensitive: true }] },
        ),
      ).toBe(true);
    });
  });

  describe('hasEvery', () => {
    it('returns true when every operand is found (strings case-insensitively, numbers strictly)', () => {
      expect(
        matchRuleCondition(
          { tags: ['hello', 1] },
          { tags: ['hasEvery', ['HELLO', 1], { caseInsensitive: true }] },
        ),
      ).toBe(true);
    });

    it('returns false when one operand item is missing (number not in value array)', () => {
      expect(
        matchRuleCondition(
          { tags: ['hello', 1] },
          { tags: ['hasEvery', ['HELLO', 3], { caseInsensitive: true }] },
        ),
      ).toBe(false);
    });

    it('returns false when string operand has no case-insensitive match', () => {
      expect(
        matchRuleCondition(
          { tags: ['world', 1] },
          { tags: ['hasEvery', ['HELLO', 1], { caseInsensitive: true }] },
        ),
      ).toBe(false);
    });
  });
});
