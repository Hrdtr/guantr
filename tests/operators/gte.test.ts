import { describe, expect, it } from "vitest"
import { matchConditionExpression } from "../../src/utils"

describe('matchConditionExpression - gte operator', () => {
  const testCases = [
    // Basic Comparisons
    { value: 20, operand: 10, expected: true }, // 20 >= 10
    { value: 5, operand: 10, expected: false }, // 5 < 10
    { value: -5, operand: -10, expected: true }, // -5 > -10
    { value: 0, operand: 10, expected: false }, // 0 < 10

    // Handling null and undefined
    { value: null, operand: 10, expected: false }, // null is not greater than or equal to 10
    { value: undefined, operand: 10, expected: false }, // undefined is not greater than or equal to 10
  ]

  for (const [idx, { value, operand, expected }] of testCases.entries()) {
    it(`should return ${expected} for case #${idx + 1}`, () => {
      const expression = ['gte', operand] as any
      const result = matchConditionExpression({ value, expression })
      expect(result).toBe(expected)
    })
  }

  // Edge case: invalid resource value type
  it('should throw TypeError for unexpected resource value type', () => {
    const value = { key: 'value' } // Invalid type for 'gte' operator
    const operand = 10
    const expression = ['gte', operand] as any
    expect(() => matchConditionExpression({ value, expression })).toThrow(TypeError)
  })

  // Edge case: invalid operand type
  it('should throw TypeError for unexpected operand type', () => {
    const value = 10
    const operand = { key: 'value' } // Invalid type for 'gte' operand
    const expression = ['gte', operand] as any
    expect(() => matchConditionExpression({ value, expression })).toThrow(TypeError)
  })
})
