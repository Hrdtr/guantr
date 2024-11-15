import { describe, expect, it } from "vitest"
import { matchConditionExpression } from "../../src/utils"

describe('matchConditionExpression - equals operator', () => {
  const testCases = [
    // Null and undefined values
    { value: null, operand: null, expected: true },
    { value: undefined, operand: undefined, expected: true },
    { value: null, operand: undefined, expected: false },
    { value: undefined, operand: null, expected: false },

    // String values
    { value: 'test', operand: 'test', expected: true },
    { value: 'Test', operand: 'test', expected: false },
    { value: 'Test', operand: 'test', options: { caseInsensitive: true }, expected: true },
    { value: 'test', operand: 'Test', options: { caseInsensitive: true }, expected: true },

    // Number values
    { value: 123, operand: 123, expected: true },
    { value: 123, operand: 456, expected: false },
    { value: 123.456, operand: 123.456, expected: true },
    { value: 123, operand: 123.456, expected: false },

    // Boolean values
    { value: true, operand: true, expected: true },
    { value: false, operand: false, expected: true },
    { value: true, operand: false, expected: false },
    { value: false, operand: true, expected: false },
  ]

  for (const [idx, { value, operand, options, expected }] of testCases.entries()) {
    it(`should return ${expected} for case #${idx + 1}`, () => {
      const expression = ['equals', operand, options] as any
      const result = matchConditionExpression({ value, expression })
      expect(result).toBe(expected)
    })
  }

  // Edge case: invalid resource value type
  it('should throw TypeError for unexpected resource value type', () => {
    const value = { key: 'value' }
    const operand = 'test'
    const expression = ['equals', operand] as any
    expect(() => matchConditionExpression({ value, expression })).toThrow(TypeError)
  })

  // Edge case: invalid operand type
  it('should throw TypeError for invalid operand type', () => {
    const value = 'test'
    const operand = { key: 'value' }
    const expression = ['equals', operand] as any
    expect(() => matchConditionExpression({ value, expression })).toThrow(TypeError)
  })
})
