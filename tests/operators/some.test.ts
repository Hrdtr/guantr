import { describe, expect, it } from "vitest"
import { matchConditionExpression } from "../../src/utils"

describe('matchConditionExpression - some operator', () => {
  const testCases = [
    // Basic Checks
    { value: [{ id: 1, value: 10 }, { id: 2, value: 20 }, { id: 3, value: 30 }], operand: { value: ['gt', 15] }, expected: true }, // One item with value > 15
    { value: [{ id: 1, value: 50 }, { id: 2, value: 60 }], operand: { value: ['eq', 50] }, expected: true }, // One item with value === 50
    { value: [{ id: 1, value: 10 }, { id: 2, value: 20 }], operand: { value: ['eq', 30] }, expected: false }, // No item with value === 30

    // Multiple Conditions
    { value: [{ id: 1, value: 10, status: 'active' }, { id: 2, value: 20, status: 'inactive' }], operand: { value: ['gt', 15], status: ['eq', 'active'] }, expected: false }, // No item with value > 15 and status === 'active'
    { value: [{ id: 1, value: 10, status: 'active' }, { id: 2, value: 30, status: 'inactive' }], operand: { value: ['gt', 15], status: ['eq', 'inactive'] }, expected: true }, // One item with value > 15 and status === 'inactive'
    { value: [{ id: 1, name: 'alice', age: 25 }, { id: 2, name: 'bob', age: 30 }], operand: { name: ['eq', 'alice'], age: ['gte', 25] }, expected: true }, // One item with name === 'alice' and age >= 25

    // Nested
    { value: [{ id: 1, name: { first: 'John', last: 'Doe' } }, { id: 2, name: { first: 'Alice', last: 'Smith' } }], operand: { name: { first: ['eq', 'Alice'] } }, expected: true },
    { value: [{ id: 1, name: { first: 'John', last: 'Doe' } }, { id: 2, name: { first: 'Alice', last: 'Smith' } }], operand: { name: { first: ['eq', 'Doe'] } }, expected: false },
    { value: [{ id: 1, name: { first: 'John', last: 'Doe' } }, { id: 2, name: { first: 'Alice', last: 'Smith' } }], operand: { name: { last: ['eq', 'Doe'] } }, expected: true },

    // Handling null and undefined
    { value: null, operand: { value: ['gt', 10] }, expected: false }, // null array
    { value: undefined, operand: { value: ['gt', 10] }, expected: false }, // undefined array

    // Edge case: value array with mixed types
    { value: [{ id: 1, value: 10 }, { id: 2, value: 'twenty' }], operand: { value: ['eq', 'twenty'] }, expected: true }, // One item with value === 'twenty'
    { value: [{ id: 1, value: 10 }, { id: 2, value: 20 }], operand: { value: ['eq', 'twenty'] }, expected: false }, // No item with value === 'twenty'
  ]

  for (const [idx, { value, operand, expected }] of testCases.entries()) {
    it(`should return ${expected} for case #${idx + 1}`, () => {
      const expression = ['some', operand] as any
      const result = matchConditionExpression({ value, expression })
      expect(result).toBe(expected)
    })
  }

  // Edge case: invalid resource value type
  it('should throw TypeError for unexpected resource value type', () => {
    const value = { key: 'value' } // Invalid type for 'some' operator
    const operand = { value: ['gt', 10] }
    const expression = ['some', operand] as any
    expect(() => matchConditionExpression({ value, expression })).toThrow(TypeError)
  })

  // Edge case: invalid operand type
  it('should throw TypeError for unexpected operand type', () => {
    const value = [{ id: 1, value: 10 }]
    const operand = { key: 'value' } // Invalid type for 'some' operand
    const expression = ['some', operand] as any
    expect(() => matchConditionExpression({ value, expression })).toThrow(TypeError)
  })
})
