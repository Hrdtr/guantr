import { describe, expect, it } from "vitest"
import { matchConditionExpression } from "../../src/utils"

describe('matchConditionExpression - gt operator', () => {
  const context = {
    smallNumber: 5,
    mediumNumber: 15,
    largeNumber: 100
  }

  const testCases = [
    // Basic Comparisons
    { value: 20, operand: 10, expected: true }, // 20 > 10
    { value: 5, operand: 10, expected: false }, // 5 < 10
    { value: -5, operand: -10, expected: true }, // -5 > -10
    { value: 0, operand: 0, expected: false }, // 0 == 0

    // Contextual Comparisons
    { value: 20, operand: '$context.smallNumber', expected: true }, // 20 > 5 (from context)
    { value: 10, operand: '$context.mediumNumber', expected: false }, // 10 < 15 (from context)
    { value: 50, operand: '$context.largeNumber', expected: false }, // 50 < 100 (from context)

    // Handling null and undefined
    { value: null, operand: 10, expected: false }, // null is not greater than 10
    { value: undefined, operand: 10, expected: false }, // undefined is not greater than 10
  ]

  for (const [idx, { value, operand, expected }] of testCases.entries()) {
    it(`should return ${expected} for case #${idx + 1}`, () => {
      const expression = ['gt', operand] as any
      const result = matchConditionExpression({ value, expression, context })
      expect(result).toBe(expected)
    })
  }

  // Edge case: invalid resource value type
  it('should throw TypeError for unexpected resource value type', () => {
    const value = { key: 'value' } // Invalid type for 'gt' operator
    const operand = 10
    const expression = ['gt', operand] as any
    expect(() => matchConditionExpression({ value, expression, context })).toThrow(TypeError)
  })

  // Edge case: invalid operand type
  it('should throw TypeError for unexpected operand type', () => {
    const value = 10
    const operand = { key: 'value' } // Invalid type for 'gt' operand
    const expression = ['gt', operand] as any
    expect(() => matchConditionExpression({ value, expression, context })).toThrow(TypeError)
  })
})
