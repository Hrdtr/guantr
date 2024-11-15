import { describe, expect, it } from "vitest"
import { matchConditionExpression } from "../../src/utils"

describe('matchConditionExpression - has operator', () => {
  const testCases = [
    // Basic Array Checks
    { value: ['a', 'b', 'c'], operand: 'a', expected: true }, // 'a' in ['a', 'b', 'c']
    { value: [1, 2, 3], operand: 2, expected: true }, // 2 in [1, 2, 3]
    { value: ['x', 'y', 'z'], operand: 'a', expected: false }, // 'a' not in ['x', 'y', 'z']
    { value: [], operand: 'element', expected: false }, // 'element' not in []

    // Handling null and undefined
    { value: null, operand: 'element', expected: false }, // null array
    { value: undefined, operand: 'element', expected: false }, // undefined array

    // Case Insensitive Checks
    { value: ['A', 'B', 'C'], operand: 'a', expected: true, options: { caseInsensitive: true } }, // 'a' (case insensitive) in ['A', 'B', 'C']
    { value: ['x', 'y', 'z'], operand: 'A', expected: false, options: { caseInsensitive: true } }, // 'A' (case insensitive) not in ['x', 'y', 'z']
    { value: ['One', 2, 'Three', 4], operand: 'three', expected: true, options: { caseInsensitive: true } }, // 'three' (case insensitive) in ['One', 2, 'Three', 4]

    // Edge case: value array with mixed types
    { value: [1, 'two', 3], operand: 'two', expected: true }, // 'two' in [1, 'two', 3]
    { value: [1, 'two', 3], operand: 2, expected: false } // 2 not in [1, 'two', 3]
  ]

  for (const [idx, { value, operand, expected, options }] of testCases.entries()) {
    it(`should return ${expected} for case #${idx + 1}`, () => {
      const expression = ['has', operand, options] as any
      const result = matchConditionExpression({ value, expression })
      expect(result).toBe(expected)
    })
  }

  // Edge case: invalid resource value type
  it('should throw TypeError for unexpected resource value type', () => {
    const value = { key: 'value' } // Invalid type for 'has' operator
    const operand = 'element'
    const expression = ['has', operand] as any
    expect(() => matchConditionExpression({ value, expression })).toThrow(TypeError)
  })

  // Edge case: invalid operand type
  it('should throw TypeError for unexpected operand type', () => {
    const value = ['a', 'b', 'c']
    const operand = { key: 'value' } // Invalid type for 'has' operand
    const expression = ['has', operand] as any
    expect(() => matchConditionExpression({ value, expression })).toThrow(TypeError)
  })
})
