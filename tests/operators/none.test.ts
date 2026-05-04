import { describe, expect, it } from 'vitest';
import { matchRuleCondition } from '../../src/utils';
import { matchConditionExpression } from '../../src/utils';

describe('none operator', () => {
  // ---------------------------------------------------------------------------
  // Tests via matchRuleCondition (properly typed)
  // ---------------------------------------------------------------------------

  it('returns true when no items have value > 50', () => {
    expect(
      matchRuleCondition(
        {
          items: [
            { id: 1, value: 10 },
            { id: 2, value: 20 },
            { id: 3, value: 30 },
          ],
        },
        { items: ['none', { value: ['gt', 50] }] },
      ),
    ).toBe(true);
  });

  it('returns false when some items match eq', () => {
    expect(
      matchRuleCondition(
        {
          items: [
            { id: 1, value: 50 },
            { id: 2, value: 60 },
          ],
        },
        { items: ['none', { value: ['eq', 50] }] },
      ),
    ).toBe(false);
  });

  it('returns true when no items match eq', () => {
    expect(
      matchRuleCondition(
        {
          items: [
            { id: 1, value: 10 },
            { id: 2, value: 20 },
          ],
        },
        { items: ['none', { value: ['eq', 30] }] },
      ),
    ).toBe(true);
  });

  it('returns true with multiple conditions when no item matches all', () => {
    expect(
      matchRuleCondition(
        {
          items: [
            { id: 1, value: 10, status: 'active' },
            { id: 2, value: 20, status: 'inactive' },
          ],
        },
        { items: ['none', { value: ['gt', 15], status: ['eq', 'active'] }] },
      ),
    ).toBe(true);
  });

  it('returns false with multiple conditions when some item matches all', () => {
    expect(
      matchRuleCondition(
        {
          items: [
            { id: 1, value: 10, status: 'active' },
            { id: 2, value: 30, status: 'inactive' },
          ],
        },
        { items: ['none', { value: ['gt', 15], status: ['eq', 'inactive'] }] },
      ),
    ).toBe(false);
  });

  it('returns false with multiple conditions when one item matches', () => {
    expect(
      matchRuleCondition(
        {
          items: [
            { id: 1, name: 'alice', age: 25 },
            { id: 2, name: 'bob', age: 30 },
          ],
        },
        { items: ['none', { name: ['eq', 'alice'], age: ['gte', 25] }] },
      ),
    ).toBe(false);
  });

  it('returns false with nested object condition when some match', () => {
    expect(
      matchRuleCondition(
        {
          items: [
            { id: 1, name: { first: 'John', last: 'Doe' } },
            { id: 2, name: { first: 'Alice', last: 'Smith' } },
          ],
        },
        { items: ['none', { name: { first: ['eq', 'Alice'] } }] },
      ),
    ).toBe(false);
  });

  it('returns true with nested object condition when none match', () => {
    expect(
      matchRuleCondition(
        {
          items: [
            { id: 1, name: { first: 'John', last: 'Doe' } },
            { id: 2, name: { first: 'Alice', last: 'Smith' } },
          ],
        },
        { items: ['none', { name: { first: ['eq', 'Doe'] } }] },
      ),
    ).toBe(true);
  });

  it('returns false with nested object condition when some match last name', () => {
    expect(
      matchRuleCondition(
        {
          items: [
            { id: 1, name: { first: 'John', last: 'Doe' } },
            { id: 2, name: { first: 'Alice', last: 'Smith' } },
          ],
        },
        { items: ['none', { name: { last: ['eq', 'Doe'] } }] },
      ),
    ).toBe(false);
  });

  it('returns true for null value', () => {
    expect(matchRuleCondition({ items: null }, { items: ['none', { value: ['gt', 10] }] })).toBe(
      true,
    );
  });

  it('returns true for undefined value', () => {
    expect(
      matchRuleCondition({ items: undefined }, { items: ['none', { value: ['gt', 10] }] }),
    ).toBe(true);
  });

  it('returns true for empty array', () => {
    expect(matchRuleCondition({ items: [] }, { items: ['none', { value: ['gt', 10] }] })).toBe(
      true,
    );
  });

  it('returns false with mixed types when some match', () => {
    expect(
      matchRuleCondition(
        {
          items: [
            { id: 1, value: 10 },
            { id: 2, value: 'twenty' },
          ],
        },
        { items: ['none', { value: ['eq', 'twenty'] }] },
      ),
    ).toBe(false);
  });

  it('returns true with mixed types when none match', () => {
    expect(
      matchRuleCondition(
        {
          items: [
            { id: 1, value: 10 },
            { id: 2, value: 20 },
          ],
        },
        { items: ['none', { value: ['eq', 'twenty'] }] },
      ),
    ).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // TypeError tests via matchConditionExpression (cast needed to bypass TS)
  // ---------------------------------------------------------------------------

  it('should throw TypeError for unexpected resource value type', () => {
    // as any needed because we intentionally pass an object as value to test
    // the runtime TypeError for the none operator
    const expression = ['none', { value: ['gt', 10] }] as any;
    expect(() => matchConditionExpression({ value: { key: 'value' }, expression })).toThrow(
      TypeError,
    );
  });

  it('should throw TypeError for invalid nested condition value in operand', () => {
    // as any needed because we intentionally pass a string instead of a valid
    // condition expression to test the runtime TypeError validation
    const expression = ['none', { id: 'value' }] as any;
    expect(() => matchConditionExpression({ value: [{ id: 1, value: 10 }], expression })).toThrow(
      TypeError,
    );
  });

  it('should throw TypeError for unexpected operand type', () => {
    // as any needed because we intentionally pass a number as operand to test
    // the runtime TypeError for the none operator
    const expression = ['none', 42] as any;
    expect(() => matchConditionExpression({ value: [{ id: 1, value: 10 }], expression })).toThrow(
      TypeError,
    );
  });
});
