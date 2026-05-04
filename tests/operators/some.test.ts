import { describe, expect, it } from 'vitest';
import { matchRuleCondition } from '../../src/utils';
import { matchConditionExpression } from '../../src/utils';

describe('some operator', () => {
  // ---------------------------------------------------------------------------
  // Tests via matchRuleCondition (properly typed)
  // ---------------------------------------------------------------------------

  it('returns true when some items have value > 15', () => {
    expect(
      matchRuleCondition(
        {
          items: [
            { id: 1, value: 10 },
            { id: 2, value: 20 },
            { id: 3, value: 30 },
          ],
        },
        { items: ['some', { value: ['gt', 15] }] },
      ),
    ).toBe(true);
  });

  it('returns true when at least one item matches eq', () => {
    expect(
      matchRuleCondition(
        {
          items: [
            { id: 1, value: 50 },
            { id: 2, value: 60 },
          ],
        },
        { items: ['some', { value: ['eq', 50] }] },
      ),
    ).toBe(true);
  });

  it('returns false when no items match eq', () => {
    expect(
      matchRuleCondition(
        {
          items: [
            { id: 1, value: 10 },
            { id: 2, value: 20 },
          ],
        },
        { items: ['some', { value: ['eq', 30] }] },
      ),
    ).toBe(false);
  });

  it('returns false with multiple conditions when no item matches all', () => {
    expect(
      matchRuleCondition(
        {
          items: [
            { id: 1, value: 10, status: 'active' },
            { id: 2, value: 20, status: 'inactive' },
          ],
        },
        { items: ['some', { value: ['gt', 15], status: ['eq', 'active'] }] },
      ),
    ).toBe(false);
  });

  it('returns true with multiple conditions when one item matches all', () => {
    expect(
      matchRuleCondition(
        {
          items: [
            { id: 1, value: 10, status: 'active' },
            { id: 2, value: 30, status: 'inactive' },
          ],
        },
        { items: ['some', { value: ['gt', 15], status: ['eq', 'inactive'] }] },
      ),
    ).toBe(true);
  });

  it('returns true with nested object condition', () => {
    expect(
      matchRuleCondition(
        {
          items: [
            { id: 1, name: { first: 'John', last: 'Doe' } },
            { id: 2, name: { first: 'Alice', last: 'Smith' } },
          ],
        },
        { items: ['some', { name: { first: ['eq', 'Alice'] } }] },
      ),
    ).toBe(true);
  });

  it('returns false with nested object condition (wrong value)', () => {
    expect(
      matchRuleCondition(
        {
          items: [
            { id: 1, name: { first: 'John', last: 'Doe' } },
            { id: 2, name: { first: 'Alice', last: 'Smith' } },
          ],
        },
        { items: ['some', { name: { first: ['eq', 'Doe'] } }] },
      ),
    ).toBe(false);
  });

  it('returns true with nested object condition on last name', () => {
    expect(
      matchRuleCondition(
        {
          items: [
            { id: 1, name: { first: 'John', last: 'Doe' } },
            { id: 2, name: { first: 'Alice', last: 'Smith' } },
          ],
        },
        { items: ['some', { name: { last: ['eq', 'Doe'] } }] },
      ),
    ).toBe(true);
  });

  it('returns false for null value', () => {
    expect(matchRuleCondition({ items: null }, { items: ['some', { value: ['gt', 10] }] })).toBe(
      false,
    );
  });

  it('returns false for undefined value', () => {
    expect(
      matchRuleCondition({ items: undefined }, { items: ['some', { value: ['gt', 10] }] }),
    ).toBe(false);
  });

  it('returns true with mixed types in array', () => {
    expect(
      matchRuleCondition(
        {
          items: [
            { id: 1, value: 10 },
            { id: 2, value: 'twenty' },
          ],
        },
        { items: ['some', { value: ['eq', 'twenty'] }] },
      ),
    ).toBe(true);
  });

  it('returns false with mixed types when no match', () => {
    expect(
      matchRuleCondition(
        {
          items: [
            { id: 1, value: 10 },
            { id: 2, value: 20 },
          ],
        },
        { items: ['some', { value: ['eq', 'twenty'] }] },
      ),
    ).toBe(false);
  });

  it('returns false for empty array', () => {
    expect(matchRuleCondition({ items: [] }, { items: ['some', { value: ['gt', 10] }] })).toBe(
      false,
    );
  });

  // ---------------------------------------------------------------------------
  // TypeError tests via matchConditionExpression (cast needed to bypass TS)
  // ---------------------------------------------------------------------------

  it('should throw TypeError for unexpected resource value type', () => {
    // as any needed because we intentionally pass an object as value to test
    // the runtime TypeError for the some operator
    const expression = ['some', { value: ['gt', 10] }] as any;
    expect(() => matchConditionExpression({ value: { key: 'value' }, expression })).toThrow(
      TypeError,
    );
  });

  it('should throw TypeError for invalid nested condition value in operand', () => {
    // as any needed because we intentionally pass a string instead of a valid
    // condition expression to test the runtime TypeError validation
    const expression = ['some', { id: 'value' }] as any;
    expect(() => matchConditionExpression({ value: [{ id: 1, value: 10 }], expression })).toThrow(
      TypeError,
    );
  });

  it('should throw TypeError for unexpected operand type', () => {
    // as any needed because we intentionally pass a number as operand to test
    // the runtime TypeError for the some operator
    const expression = ['some', 42] as any;
    expect(() => matchConditionExpression({ value: [{ id: 1, value: 10 }], expression })).toThrow(
      TypeError,
    );
  });
});
