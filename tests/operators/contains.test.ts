import { describe, expect, it } from "vitest"
import { matchConditionExpression } from "../../src/utils"

describe('matchConditionExpression - contains operator', () => {
  const context = {
    greeting: 'world',
    keyword: 'test',
    phrase: 'insensitive',
    mixedCaseWord: 'CaseSensitive'
  }

  const testCases = [
    // Valid cases where the value contains the operand
    { value: 'hello world', operand: 'world', expected: true },
    { value: 'testing with Vitest', operand: 'Vitest', expected: true },
    { value: 'JavaScript testing framework', operand: 'testing', expected: true },

    // Cases where the value does not contain the operand
    { value: 'hello world', operand: 'hello!', expected: false },
    { value: 'test driven development', operand: 'unit', expected: false },
    { value: 'code review', operand: 'debug', expected: false },

    // Case-insensitive comparisons
    { value: 'Case Insensitive Test', operand: 'case', options: { caseInsensitive: true }, expected: true },
    { value: 'JavaScript is Fun', operand: 'javascript', options: { caseInsensitive: true }, expected: true },

    // Context usage
    { value: 'hello world', operand: '$context.greeting', expected: true },
    { value: 'unit test coverage', operand: '$context.keyword', expected: true },
    { value: 'case insensitive check', operand: '$context.phrase', options: { caseInsensitive: true }, expected: true },
    { value: 'Checking for CaseSensitive word', operand: '$context.mixedCaseWord', options: { caseInsensitive: true }, expected: true },

    // Null and undefined values
    { value: null, operand: 'null', expected: false },
    { value: undefined, operand: 'undefined', expected: false },

    // Edge cases with empty strings
    { value: '', operand: '', expected: true }, // Both are empty
    { value: 'test string', operand: '', expected: true }, // Operand is empty
    { value: '', operand: 'test', expected: false }, // Value is empty

    // Edge case with special characters
    { value: 'special*characters*test', operand: 'characters', expected: true },
    { value: 'a!@#$%^&*()b', operand: '@#$%', expected: true },
  ]

  for (const [idx, { value, operand, options, expected }] of testCases.entries()) {
    it(`should return ${expected} for case #${idx + 1}`, () => {
      const expression = ['contains', operand, options] as any
      const result = matchConditionExpression({ value, expression, context })
      expect(result).toBe(expected)
    })
  }

  // Edge case: invalid resource value type
  it('should throw TypeError for unexpected resource value type', () => {
    const value = 123 // Invalid type for 'contains' operator
    const operand = 'test'
    const expression = ['contains', operand] as any
    expect(() => matchConditionExpression({ value, expression, context })).toThrow(TypeError)
  })

  // Edge case: invalid operand type
  it('should throw TypeError for invalid operand type', () => {
    const value = 'test'
    const operand = 123 // Operand must be a string
    const expression = ['contains', operand] as any
    expect(() => matchConditionExpression({ value, expression, context })).toThrow(TypeError)
  })
})