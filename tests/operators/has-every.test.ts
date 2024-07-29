import { describe, expect, it } from "vitest"
import { matchConditionExpression } from "../../src/utils"

describe('matchConditionExpression - hasEvery operator', () => {
  const context = {
    stringElements: ['foo', 'bar'],
    numberElements: [1, 42, 100],
    mixedArray: ['one', 2, 'three', 4],
    singleString: 'single',
    singleNumber: 10
  }

  const testCases = [
    // Basic Array Checks
    { value: ['a', 'b', 'c'], operand: ['a', 'b'], expected: true }, // 'a' and 'b' in ['a', 'b', 'c']
    { value: [1, 2, 3, 4], operand: [2, 3, 4], expected: true }, // 2, 3, and 4 in [1, 2, 3, 4]
    { value: ['x', 'y', 'z'], operand: ['y', 'a'], expected: false }, // 'y' and 'a' not both in ['x', 'y', 'z']
    { value: ['a', 'b'], operand: ['a', 'b', 'c'], expected: false }, // ['a', 'b', 'c'] not all in ['a', 'b']

    // Contextual Checks
    { value: ['foo', 'bar', 'baz'], operand: '$context.stringElements', expected: true }, // 'foo' and 'bar' (from context) in ['foo', 'bar', 'baz']
    { value: [1, 2, 42], operand: '$context.numberElements', expected: false }, // 1, 42, and 100 (from context) not all in [1, 2, 42]
    { value: ['one', 2, 'three', 4], operand: '$context.mixedArray', expected: true }, // 'one', 2, 'three', and 4 (from context) in ['one', 2, 'three', 4]

    // Handling null and undefined
    { value: null, operand: ['element'], expected: false }, // null array
    { value: undefined, operand: ['element'], expected: false }, // undefined array

    // Case Insensitive Checks
    { value: ['A', 'B', 'C'], operand: ['a', 'b'], expected: true, options: { caseInsensitive: true } }, // 'a' and 'b' (case insensitive) in ['A', 'B', 'C']
    { value: ['x', 'y', 'z'], operand: ['Y', 'A'], expected: false, options: { caseInsensitive: true } }, // 'Y' and 'A' (case insensitive) not both in ['x', 'y', 'z']
    { value: ['One', 2, 'Three', 4], operand: ['three', 'one'], expected: true, options: { caseInsensitive: true } }, // 'three' and 'one' (case insensitive) in ['One', 2, 'Three', 4]

    // Edge case: value array with mixed types
    { value: [1, 'two', 3], operand: [1, 'two'], expected: true }, // 1 and 'two' in [1, 'two', 3]
    { value: [1, 'two', 3], operand: [1, 'Two'], expected: true, options: { caseInsensitive: true } }, // 1 and 'two' in [1, 'two', 3]
    { value: [1, 'two', 3], operand: [1, 'four'], expected: false }, // 1 and 'four' not both in [1, 'two', 3]
  ]

  for (const [idx, { value, operand, expected, options }] of testCases.entries()) {
    it(`should return ${expected} for case #${idx + 1}`, () => {
      const expression = ['hasEvery', operand, options] as any
      const result = matchConditionExpression({ value, expression, context })
      expect(result).toBe(expected)
    })
  }

  // Edge case: invalid resource value type
  it('should throw TypeError for unexpected resource value type', () => {
    const value = { key: 'value' } // Invalid type for 'hasEvery' operator
    const operand = ['element']
    const expression = ['hasEvery', operand] as any
    expect(() => matchConditionExpression({ value, expression, context })).toThrow(TypeError)
  })

  // Edge case: invalid operand type
  it('should throw TypeError for unexpected operand type', () => {
    const value = ['a', 'b', 'c']
    const operand = { key: 'value' } // Invalid type for 'hasEvery' operand
    const expression = ['hasEvery', operand] as any
    expect(() => matchConditionExpression({ value, expression, context })).toThrow(TypeError)
  })
})
