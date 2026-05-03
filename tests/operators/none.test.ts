import { describe, expect, it } from 'vitest';
import { matchConditionExpression } from '../../src/utils';

describe('matchConditionExpression - none operator', () => {
  const testCases = [
    // Basic Checks
    {
      value: [
        { id: 1, value: 10 },
        { id: 2, value: 20 },
        { id: 3, value: 30 },
      ],
      operand: { value: ['gt', 50] },
      expected: true,
    }, // No item with value > 50
    {
      value: [
        { id: 1, value: 50 },
        { id: 2, value: 60 },
      ],
      operand: { value: ['eq', 50] },
      expected: false,
    }, // One item with value === 50
    {
      value: [
        { id: 1, value: 10 },
        { id: 2, value: 20 },
      ],
      operand: { value: ['eq', 30] },
      expected: true,
    }, // No item with value === 30

    // Multiple Conditions
    {
      value: [
        { id: 1, value: 10, status: 'active' },
        { id: 2, value: 20, status: 'inactive' },
      ],
      operand: { value: ['gt', 15], status: ['eq', 'active'] },
      expected: true,
    }, // No item with value > 15 and status === 'active'
    {
      value: [
        { id: 1, value: 10, status: 'active' },
        { id: 2, value: 30, status: 'inactive' },
      ],
      operand: { value: ['gt', 15], status: ['eq', 'inactive'] },
      expected: false,
    }, // One item with value > 15 and status === 'inactive'
    {
      value: [
        { id: 1, name: 'alice', age: 25 },
        { id: 2, name: 'bob', age: 30 },
      ],
      operand: { name: ['eq', 'alice'], age: ['gte', 25] },
      expected: false,
    }, // One item with name === 'alice' and age >= 25

    // Nested
    {
      value: [
        { id: 1, name: { first: 'John', last: 'Doe' } },
        { id: 2, name: { first: 'Alice', last: 'Smith' } },
      ],
      operand: { name: { first: ['eq', 'Alice'] } },
      expected: false,
    }, // One item with name.first === 'Alice'
    {
      value: [
        { id: 1, name: { first: 'John', last: 'Doe' } },
        { id: 2, name: { first: 'Alice', last: 'Smith' } },
      ],
      operand: { name: { first: ['eq', 'Doe'] } },
      expected: true,
    }, // No item with name.first === 'Doe'
    {
      value: [
        { id: 1, name: { first: 'John', last: 'Doe' } },
        { id: 2, name: { first: 'Alice', last: 'Smith' } },
      ],
      operand: { name: { last: ['eq', 'Doe'] } },
      expected: false,
    }, // One item with name.last === 'Doe'

    // Handling null and undefined
    { value: null, operand: { value: ['gt', 10] }, expected: true }, // null array
    { value: undefined, operand: { value: ['gt', 10] }, expected: true }, // undefined array

    // Empty array
    { value: [], operand: { value: ['gt', 10] }, expected: true }, // empty array

    // Edge case: value array with mixed types
    {
      value: [
        { id: 1, value: 10 },
        { id: 2, value: 'twenty' },
      ],
      operand: { value: ['eq', 'twenty'] },
      expected: false,
    }, // One item with value === 'twenty'
    {
      value: [
        { id: 1, value: 10 },
        { id: 2, value: 20 },
      ],
      operand: { value: ['eq', 'twenty'] },
      expected: true,
    }, // No item with value === 'twenty'
  ];

  for (const [idx, { value, operand, expected }] of testCases.entries()) {
    it(`should return ${expected} for case #${idx + 1}`, () => {
      const expression = ['none', operand] as any;
      const result = matchConditionExpression({ value, expression });
      expect(result).toBe(expected);
    });
  }

  // Edge case: invalid resource value type
  it('should throw TypeError for unexpected resource value type', () => {
    const value = { key: 'value' }; // Invalid type for 'none' operator
    const operand = { value: ['gt', 10] };
    const expression = ['none', operand] as any;
    expect(() => matchConditionExpression({ value, expression })).toThrow(TypeError);
  });

  // Edge case: invalid nested condition value type in operand
  it('should throw TypeError for invalid nested condition value in operand', () => {
    const value = [{ id: 1, value: 10 }];
    const operand = { key: 'value' }; // String 'value' is not a valid condition expression
    const expression = ['none', operand] as any;
    expect(() => matchConditionExpression({ value, expression })).toThrow(TypeError);
  });

  // Edge case: invalid operand type (not a plain object)
  it('should throw TypeError for unexpected operand type', () => {
    const value = [{ id: 1, value: 10 }];
    const operand = 42; // Truly invalid type for 'none' operand
    const expression = ['none', operand] as any;
    expect(() => matchConditionExpression({ value, expression })).toThrow(TypeError);
  });
});
