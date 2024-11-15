import { describe, expect, it } from "vitest"
import { matchConditionExpression } from "../../src/utils"

describe('matchConditionExpression - hasSome operator', () => {
  const testCases = [
    // Basic Array Checks
    { value: ['a', 'b', 'c'], operand: ['a', 'd'], expected: true }, // 'a' or 'd' in ['a', 'b', 'c']
    { value: [1, 2, 3], operand: [4, 2], expected: true }, // 4 or 2 in [1, 2, 3]
    { value: ['x', 'y', 'z'], operand: ['a', 'b'], expected: false }, // 'a' or 'b' not in ['x', 'y', 'z']
    { value: [], operand: ['a', 'b'], expected: false }, // empty array

    // Handling null and undefined
    { value: null, operand: ['element'], expected: false }, // null array
    { value: undefined, operand: ['element'], expected: false }, // undefined array

    // Case Insensitive Checks
    { value: ['A', 'B', 'C'], operand: ['a', 'd'], expected: true, options: { caseInsensitive: true } }, // 'a' or 'd' (case insensitive) in ['A', 'B', 'C']
    { value: ['x', 'y', 'z'], operand: ['A', 'B'], expected: false, options: { caseInsensitive: true } }, // 'A' or 'B' (case insensitive) not in ['x', 'y', 'z']
    { value: ['One', 2, 'Three', 4], operand: ['three', 'five'], expected: true, options: { caseInsensitive: true } }, // 'three' or 'five' (case insensitive) in ['One', 2, 'Three', 4]

    // Edge case: value array with mixed types
    { value: [1, 'two', 3], operand: ['two', 2], expected: true }, // 'two' or 2 in [1, 'two', 3]
    { value: [1, 'two', 3], operand: ['Two', 2], expected: true, options: { caseInsensitive: true } }, // 'two' or 2 in [1, 'two', 3]
    { value: [1, 'two', 3], operand: ['four', 5], expected: false }, // 'four' or 5 not in [1, 'two', 3]
  ]

  for (const [idx, { value, operand, expected, options }] of testCases.entries()) {
    it(`should return ${expected} for case #${idx + 1}`, () => {
      const expression = ['hasSome', operand, options] as any
      const result = matchConditionExpression({ value, expression })
      expect(result).toBe(expected)
    })
  }

  // Edge case: invalid resource value type
  it('should throw TypeError for unexpected resource value type', () => {
    const value = { key: 'value' } // Invalid type for 'hasSome' operator
    const operand = ['element']
    const expression = ['hasSome', operand] as any
    expect(() => matchConditionExpression({ value, expression })).toThrow(TypeError)
  })

  // Edge case: invalid operand type
  it('should throw TypeError for unexpected operand type', () => {
    const value = ['a', 'b', 'c']
    const operand = { key: 'value' } // Invalid type for 'hasSome' operand
    const expression = ['hasSome', operand] as any
    expect(() => matchConditionExpression({ value, expression })).toThrow(TypeError)
  })
})
