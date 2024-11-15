import { describe, expect, it } from "vitest"
import { matchConditionExpression } from "../../src/utils"

describe('matchConditionExpression - startsWith operator', () => {
  const testCases = [
    // Valid cases where the value starts with the operand
    { value: 'hello world', operand: 'hello', expected: true },
    { value: 'javascript testing', operand: 'java', expected: true },
    { value: 'Vitest is great', operand: 'Vitest', expected: true },

    // Cases where the value does not start with the operand
    { value: 'hello world', operand: 'world', expected: false },
    { value: 'javascript testing', operand: 'script', expected: false },
    { value: 'Vitest is great', operand: 'is', expected: false },

    // Case-insensitive comparisons
    { value: 'Case Insensitive Test', operand: 'case', options: { caseInsensitive: true }, expected: true },
    { value: 'Vitest Is Great', operand: 'vitest', options: { caseInsensitive: true }, expected: true },

    // Null and undefined values
    { value: null, operand: 'null', expected: false },
    { value: undefined, operand: 'undefined', expected: false },

    // Edge cases with empty strings
    { value: '', operand: '', expected: true }, // Both are empty
    { value: 'test string', operand: '', expected: true }, // Operand is empty
    { value: '', operand: 'test', expected: false }, // Value is empty

    // Edge case with special characters
    { value: 'a!@#$%^&*()', operand: 'a!@#', expected: true },
    { value: 'special*characters*test', operand: 'special*', expected: true },
  ]

  for (const [idx, { value, operand, options, expected }] of testCases.entries()) {
    it(`should return ${expected} for case #${idx + 1}`, () => {
      const expression = ['startsWith', operand, options] as any
      const result = matchConditionExpression({ value, expression })
      expect(result).toBe(expected)
    })
  }

  // Edge case: invalid resource value type
  it('should throw TypeError for unexpected resource value type', () => {
    const value = 123 // Invalid type for 'startsWith' operator
    const operand = 'test'
    const expression = ['startsWith', operand] as any
    expect(() => matchConditionExpression({ value, expression })).toThrow(TypeError)
  })

  // Edge case: invalid operand type
  it('should throw TypeError for invalid operand type', () => {
    const value = 'test'
    const operand = 123 // Operand must be a string
    const expression = ['startsWith', operand] as any
    expect(() => matchConditionExpression({ value, expression })).toThrow(TypeError)
  })
})
