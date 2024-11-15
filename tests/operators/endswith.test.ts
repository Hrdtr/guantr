import { describe, expect, it } from "vitest"
import { matchConditionExpression } from "../../src/utils"

describe('matchConditionExpression - endsWith operator', () => {
  const testCases = [
    // Valid cases where the value ends with the operand
    { value: 'Hello, world!', operand: 'world!', expected: true },
    { value: 'Testing endsWith operator', operand: 'operator', expected: true },

    // Cases where the value does not end with the operand
    { value: 'Hello, world!', operand: 'world', expected: false },
    { value: 'Testing endsWith operator', operand: 'operators', expected: false },

    // Case insensitive checks
    { value: 'Hello, world!', operand: 'WORLD!', expected: true, options: { caseInsensitive: true } },
    { value: 'Testing endsWith Operator', operand: 'operator', expected: true, options: { caseInsensitive: true } },

    // Null and undefined values
    { value: null, operand: 'suffix', expected: false },
    { value: undefined, operand: 'suffix', expected: false },

    // Special characters
    { value: 'Special*Characters!', operand: 'Characters!', expected: true },
    { value: 'Special*Characters!', operand: 'characters!', expected: true, options: { caseInsensitive: true } },
  ]

  for (const [idx, { value, operand, expected, options }] of testCases.entries()) {
    it(`should return ${expected} for case #${idx + 1}`, () => {
      const expression = ['endsWith', operand, options] as any
      const result = matchConditionExpression({ value, expression })
      expect(result).toBe(expected)
    })
  }

  // Edge case: invalid resource value type
  it('should throw TypeError for unexpected resource value type', () => {
    const value = { key: 'value' } // Invalid type for 'endsWith' operator
    const operand = 'value'
    const expression = ['endsWith', operand] as any
    expect(() => matchConditionExpression({ value, expression })).toThrow(TypeError)
  })

  // Edge case: invalid operand type
  it('should throw TypeError for unexpected operand type', () => {
    const value = 'string value'
    const operand = 123 // Invalid type for 'endsWith' operand
    const expression = ['endsWith', operand] as any
    expect(() => matchConditionExpression({ value, expression })).toThrow(TypeError)
  })
})
