import { describe, expect, it } from 'vitest';
import { matchConditionExpression } from '../../src/utils';

describe('caseInsensitive edge cases', () => {
  // -------------------------------------------------------------------------
  // eq operator
  // -------------------------------------------------------------------------
  describe('eq', () => {
    it('returns true for equal numbers even when caseInsensitive is true (falls through to strict equality)', () => {
      // Both operand and value are numbers → isString(operand) is false → strict ===
      expect(
        matchConditionExpression({
          value: 42,
          expression: ['eq', 42, { caseInsensitive: true }] as any,
        }),
      ).toBe(true);
    });

    it('returns false for different numbers even when caseInsensitive is true', () => {
      expect(
        matchConditionExpression({
          value: 42,
          expression: ['eq', 43, { caseInsensitive: true }] as any,
        }),
      ).toBe(false);
    });

    it('returns true for equal booleans when caseInsensitive is true (falls through to strict equality)', () => {
      // Both operand and value are booleans → isString(operand) is false → strict ===
      expect(
        matchConditionExpression({
          value: true,
          expression: ['eq', true, { caseInsensitive: true }] as any,
        }),
      ).toBe(true);
    });

    it('returns false for non-equal booleans when caseInsensitive is true', () => {
      expect(
        matchConditionExpression({
          value: false,
          expression: ['eq', true, { caseInsensitive: true }] as any,
        }),
      ).toBe(false);
    });

    it('returns false for string value compared to number operand with caseInsensitive (isString(operand) fails → strict equality)', () => {
      // value is '42' (string), operand is 42 (number) → isString(operand) is false → '42' === 42 → false
      expect(
        matchConditionExpression({
          value: '42',
          expression: ['eq', 42 as any, { caseInsensitive: true }],
        }),
      ).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // in operator
  // -------------------------------------------------------------------------
  describe('in', () => {
    it('matches a number value inside a number array with caseInsensitive true (falls through to includes)', () => {
      // value is not a string → skips the caseInsensitive branch → operand.includes(value)
      expect(
        matchConditionExpression({
          value: 42,
          expression: ['in', [41, 42, 43], { caseInsensitive: true }] as any,
        }),
      ).toBe(true);
    });

    it('returns false when number value is not in the array with caseInsensitive true', () => {
      expect(
        matchConditionExpression({
          value: 99,
          expression: ['in', [41, 42, 43], { caseInsensitive: true }] as any,
        }),
      ).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // contains operator
  // -------------------------------------------------------------------------
  describe('contains', () => {
    it('returns false for null value with caseInsensitive true (null early-exit)', () => {
      expect(
        matchConditionExpression({
          value: null,
          expression: ['contains', 'test', { caseInsensitive: true }],
        }),
      ).toBe(false);
    });

    it('returns false for undefined value with caseInsensitive true (undefined early-exit)', () => {
      expect(
        matchConditionExpression({
          value: undefined,
          expression: ['contains', 'test', { caseInsensitive: true }],
        }),
      ).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // startsWith operator
  // -------------------------------------------------------------------------
  describe('startsWith', () => {
    it('returns false for null value with caseInsensitive true (null early-exit)', () => {
      expect(
        matchConditionExpression({
          value: null,
          expression: ['startsWith', 'test', { caseInsensitive: true }],
        }),
      ).toBe(false);
    });

    it('returns false for undefined value with caseInsensitive true (undefined early-exit)', () => {
      expect(
        matchConditionExpression({
          value: undefined,
          expression: ['startsWith', 'test', { caseInsensitive: true }],
        }),
      ).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // endsWith operator
  // -------------------------------------------------------------------------
  describe('endsWith', () => {
    it('returns false for null value with caseInsensitive true (null early-exit)', () => {
      expect(
        matchConditionExpression({
          value: null,
          expression: ['endsWith', 'test', { caseInsensitive: true }],
        }),
      ).toBe(false);
    });

    it('returns false for undefined value with caseInsensitive true (undefined early-exit)', () => {
      expect(
        matchConditionExpression({
          value: undefined,
          expression: ['endsWith', 'test', { caseInsensitive: true }],
        }),
      ).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // has operator
  // -------------------------------------------------------------------------
  describe('has', () => {
    it('matches a number operand using strict includes when caseInsensitive is true (isString(operand) is false)', () => {
      // operand is a number → isString(operand) is false → the caseInsensitive branch is skipped → includes()
      expect(
        matchConditionExpression({
          value: [1, 2, 3],
          expression: ['has', 2, { caseInsensitive: true }],
        }),
      ).toBe(true);
    });

    it('returns false when number operand is not in the array with caseInsensitive true', () => {
      expect(
        matchConditionExpression({
          value: [1, 2, 3],
          expression: ['has', 99, { caseInsensitive: true }],
        }),
      ).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // hasSome operator
  // -------------------------------------------------------------------------
  describe('hasSome', () => {
    it('returns true for a mixed string+number operand array: string matched case-insensitively', () => {
      // value = ['hello', 1, 2], operand = ['HELLO', 3]
      // 'HELLO' is a string → checks isString(op) && isString(val) && case-insensitive match
      // → 'hello' == 'hello' (lowercased) → true, so hasSome returns true
      expect(
        matchConditionExpression({
          value: ['hello', 1, 2],
          expression: ['hasSome', ['HELLO', 3], { caseInsensitive: true }],
        }),
      ).toBe(true);
    });

    it('returns false when mixed operand has no matches (case-insensitive string miss, number miss)', () => {
      // value = ['world', 4, 5], operand = ['HELLO', 3]
      // 'HELLO' vs 'world' → no case-insensitive match; 3 not in [4, 5] → false
      expect(
        matchConditionExpression({
          value: ['world', 4, 5],
          expression: ['hasSome', ['HELLO', 3], { caseInsensitive: true }],
        }),
      ).toBe(false);
    });

    it('matches a number operand in a mixed array via strict equality when caseInsensitive is true', () => {
      // operand 2 is a number → isString(2) is false → op === val path → 2 === 2 → true
      expect(
        matchConditionExpression({
          value: ['hello', 1, 2],
          expression: ['hasSome', [99, 2], { caseInsensitive: true }],
        }),
      ).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // hasEvery operator
  // -------------------------------------------------------------------------
  describe('hasEvery', () => {
    it('returns true when every operand is found: strings case-insensitively, numbers strictly', () => {
      // value = ['hello', 1], operand = ['HELLO', 1]
      // 'HELLO' → case-insensitive match with 'hello' → true
      // 1 → op === val path → 1 === 1 → true
      // every found → true
      expect(
        matchConditionExpression({
          value: ['hello', 1],
          expression: ['hasEvery', ['HELLO', 1], { caseInsensitive: true }],
        }),
      ).toBe(true);
    });

    it('returns false when one operand item is missing: number not in value array', () => {
      // value = ['hello', 1], operand = ['HELLO', 3]
      // 'HELLO' → found via case-insensitive match → true
      // 3 → not in ['hello', 1] → false
      // every fails → false
      expect(
        matchConditionExpression({
          value: ['hello', 1],
          expression: ['hasEvery', ['HELLO', 3], { caseInsensitive: true }],
        }),
      ).toBe(false);
    });

    it('returns false when string operand has no case-insensitive match', () => {
      // value = ['world', 1], operand = ['HELLO', 1]
      // 'HELLO' → no case-insensitive match with 'world' → false
      expect(
        matchConditionExpression({
          value: ['world', 1],
          expression: ['hasEvery', ['HELLO', 1], { caseInsensitive: true }],
        }),
      ).toBe(false);
    });
  });
});
