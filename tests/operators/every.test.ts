import { describe, expect, it } from "vitest"
import { matchConditionExpression } from "../../src/utils"

describe('matchConditionExpression - every operator', () => {
  const testCases = [
    // Basic Checks
    { value: [{ id: 1, value: 60 }, { id: 2, value: 70 }, { id: 3, value: 80 }], operand: { value: ['gt', 50] }, expected: true }, // All items with value > 50
    { value: [{ id: 1, value: 40 }, { id: 2, value: 50 }, { id: 3, value: 60 }], operand: { value: ['equals', 50] }, expected: false }, // Not all items with value === 50
    { value: [{ id: 1, value: 10 }, { id: 2, value: 20 }], operand: { value: ['equals', 30] }, expected: false }, // No item with value === 30

    // Multiple Conditions
    { value: [{ id: 1, value: 60, status: 'active' }, { id: 2, value: 70, status: 'active' }], operand: { value: ['gt', 50], status: ['equals', 'active'] }, expected: true }, // All items with value > 50 and status === 'active'
    { value: [{ id: 1, value: 60, status: 'active' }, { id: 2, value: 70, status: 'inactive' }], operand: { value: ['gt', 50], status: ['equals', 'active'] }, expected: false }, // Not all items with value > 50 and status === 'active'
    { value: [{ id: 1, name: 'alice', age: 25 }, { id: 2, name: 'bob', age: 30 }], operand: { name: ['equals', 'alice'], age: ['gte', 25] }, expected: false }, // Not all items with name === 'alice' and age >= 25

    // Nested
    { value: [{ id: 1, name: { first: 'John', last: 'Doe' } }, { id: 2, name: { first: 'Alice', last: 'Doe' } }], operand: { name: { last: ['equals', 'Doe'] } }, expected: true }, // All items with name.last === 'Doe'

    // Handling null and undefined
    { value: null, operand: { value: ['gt', 10] }, expected: false }, // null array
    { value: undefined, operand: { value: ['gt', 10] }, expected: false }, // undefined array

    // Edge case: value array with mixed types
    { value: [{ id: 1, value: 10 }, { id: 2, value: 'twenty' }], operand: { value: ['equals', 'twenty'] }, expected: false }, // Not all items with value === 'twenty'
  ]

  for (const [idx, { value, operand, expected }] of testCases.entries()) {
    it(`should return ${expected} for case #${idx + 1}`, () => {
      const expression = ['every', operand] as any
      const result = matchConditionExpression({ value, expression })
      expect(result).toBe(expected)
    })
  }

  // Edge case: invalid resource value type
  it('should throw TypeError for unexpected resource value type', () => {
    const value = { key: 'value' } // Invalid type for 'every' operator
    const operand = { value: ['gt', 10] }
    const expression = ['every', operand] as any
    expect(() => matchConditionExpression({ value, expression })).toThrow(TypeError)
  })

  // Edge case: invalid operand type
  it('should throw TypeError for unexpected operand type', () => {
    const value = [{ id: 1, value: 10 }]
    const operand = { key: 'value' } // Invalid type for 'every' operand
    const expression = ['every', operand] as any
    expect(() => matchConditionExpression({ value, expression })).toThrow(TypeError)
  })
})
