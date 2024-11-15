import { describe, expect, it } from "vitest"
import { matchConditionExpression } from "../../src/utils"

describe('matchConditionExpression - in operator', () => {
  const testCases = [
    // Valid cases where the value is in the operand array
    { value: 3, operand: [1, 2, 3, 4, 5], expected: true },
    { value: 'banana', operand: ['apple', 'banana', 'cherry'], expected: true },
    { value: 'hello', operand: ['hello', 'world'], expected: true },

    // Cases where the value is not in the operand array
    { value: 6, operand: [1, 2, 3, 4, 5], expected: false },
    { value: 'pear', operand: ['apple', 'banana', 'cherry'], expected: false },
    { value: 'goodbye', operand: ['hello', 'world'], expected: false },

    // Case-insensitive comparisons
    { value: 'test', operand: ['test', 'TEST', 'TeSt'], options: { caseInsensitive: true }, expected: true },
    { value: 'case', operand: ['CaSe', 'CASE', 'case'], options: { caseInsensitive: true }, expected: true },

    // Null and undefined values
    { value: null, operand: ['null', 0], expected: false },
    { value: undefined, operand: ['undefined', 0], expected: false },

    // Edge cases with empty arrays
    { value: 'test', operand: [], expected: false }, // Operand is an empty array
    { value: '', operand: [''], expected: true },    // Value is empty string and in the array

    // Edge case with special characters
    { value: '@#$%', operand: ['@#$%', 'abc', 'def'], expected: true },
    { value: 'special*', operand: ['*special', 'special*', '*'], expected: true },
  ]

  for (const [idx, { value, operand, options, expected }] of testCases.entries()) {
    it(`should return ${expected} for case #${idx + 1}`, () => {
      const expression = ['in', operand, options] as any
      const result = matchConditionExpression({ value, expression })
      expect(result).toBe(expected)
    })
  }

  // Edge case: invalid resource value type
  it('should throw TypeError for unexpected resource value type', () => {
    const value = { key: 'value' } // Invalid type for 'in' operator
    const operand = [1, 2, 3]
    const expression = ['in', operand] as any
    expect(() => matchConditionExpression({ value, expression })).toThrow(TypeError)
  })

  // Edge case: invalid operand type
  it('should throw TypeError for invalid operand type', () => {
    const value = 'test'
    const operand = 'not an array' // Operand must be an array
    const expression = ['in', operand] as any
    expect(() => matchConditionExpression({ value, expression })).toThrow(TypeError)
  })
})
