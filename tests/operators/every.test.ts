import { describe, expect, it } from 'vitest';
import { matchRuleCondition } from '../../src/utils';
import { matchConditionExpression } from '../../src/utils';

describe('every operator', () => {
  // ---------------------------------------------------------------------------
  // Tests via matchRuleCondition (properly typed)
  // ---------------------------------------------------------------------------

  it('returns true when every item has value > 50', () => {
    expect(
      matchRuleCondition(
        {
          items: [
            { id: 1, value: 60 },
            { id: 2, value: 70 },
            { id: 3, value: 80 },
          ],
        },
        { items: ['every', { value: ['gt', 50] }] },
      ),
    ).toBe(true);
  });

  it('returns false when not all items match eq', () => {
    expect(
      matchRuleCondition(
        {
          items: [
            { id: 1, value: 40 },
            { id: 2, value: 50 },
            { id: 3, value: 60 },
          ],
        },
        { items: ['every', { value: ['eq', 50] }] },
      ),
    ).toBe(false);
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
        { items: ['every', { value: ['eq', 30] }] },
      ),
    ).toBe(false);
  });

  it('returns true with multiple conditions when all items match', () => {
    expect(
      matchRuleCondition(
        {
          items: [
            { id: 1, value: 60, status: 'active' },
            { id: 2, value: 70, status: 'active' },
          ],
        },
        { items: ['every', { value: ['gt', 50], status: ['eq', 'active'] }] },
      ),
    ).toBe(true);
  });

  it('returns false with multiple conditions when not all items match', () => {
    expect(
      matchRuleCondition(
        {
          items: [
            { id: 1, value: 60, status: 'active' },
            { id: 2, value: 70, status: 'inactive' },
          ],
        },
        { items: ['every', { value: ['gt', 50], status: ['eq', 'active'] }] },
      ),
    ).toBe(false);
  });

  it('returns false with multiple conditions only some items match', () => {
    expect(
      matchRuleCondition(
        {
          items: [
            { id: 1, name: 'alice', age: 25 },
            { id: 2, name: 'bob', age: 30 },
          ],
        },
        { items: ['every', { name: ['eq', 'alice'], age: ['gte', 25] }] },
      ),
    ).toBe(false);
  });

  it('returns true with nested object condition', () => {
    expect(
      matchRuleCondition(
        {
          items: [
            { id: 1, name: { first: 'John', last: 'Doe' } },
            { id: 2, name: { first: 'Alice', last: 'Doe' } },
          ],
        },
        { items: ['every', { name: { last: ['eq', 'Doe'] } }] },
      ),
    ).toBe(true);
  });

  it('returns false for null value', () => {
    expect(matchRuleCondition({ items: null }, { items: ['every', { value: ['gt', 10] }] })).toBe(
      false,
    );
  });

  it('returns false for undefined value', () => {
    expect(
      matchRuleCondition({ items: undefined }, { items: ['every', { value: ['gt', 10] }] }),
    ).toBe(false);
  });

  it('returns false for empty array', () => {
    expect(matchRuleCondition({ items: [] }, { items: ['every', { value: ['gt', 10] }] })).toBe(
      false,
    );
  });

  it('returns false for empty array even with trivially true condition', () => {
    expect(matchRuleCondition({ items: [] }, { items: ['every', { id: ['gte', 0] }] })).toBe(false);
  });

  it('returns false with mixed types when not all match', () => {
    expect(
      matchRuleCondition(
        {
          items: [
            { id: 1, value: 10 },
            { id: 2, value: 'twenty' },
          ],
        },
        { items: ['every', { value: ['eq', 'twenty'] }] },
      ),
    ).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // TypeError tests via matchConditionExpression (cast needed to bypass TS)
  // ---------------------------------------------------------------------------

  it('should throw TypeError for unexpected resource value type', () => {
    // as any needed because we intentionally pass an object as value to test
    // the runtime TypeError for the every operator
    const expression = ['every', { value: ['gt', 10] }] as any;
    expect(() => matchConditionExpression({ value: { key: 'value' }, expression })).toThrow(
      TypeError,
    );
  });

  it('should throw TypeError for unexpected operand type', () => {
    // as any needed because we intentionally pass a string as condition value
    // to test the runtime TypeError for the every operator
    const expression = ['every', { id: 'value' }] as any;
    expect(() => matchConditionExpression({ value: [{ id: 1, value: 10 }], expression })).toThrow(
      TypeError,
    );
  });
});
