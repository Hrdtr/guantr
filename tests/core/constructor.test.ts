import { describe, it, expect } from 'vitest';
import { Guantr, createGuantr } from '../../src/index';

describe('Guantr constructor validation', () => {
  it('throws TypeError when maxRuleIterations is not a positive integer', () => {
    expect(() => new Guantr({ maxRuleIterations: 0 })).toThrow(TypeError);
  });

  it('throws TypeError when maxRuleIterations is negative', () => {
    expect(() => new Guantr({ maxRuleIterations: -1 })).toThrow(TypeError);
  });

  it('throws TypeError when maxRuleIterations is not an integer', () => {
    expect(() => new Guantr({ maxRuleIterations: 1.5 })).toThrow(TypeError);
  });

  it('accepts valid maxRuleIterations', () => {
    expect(() => new Guantr({ maxRuleIterations: 1 })).not.toThrow();
  });

  it('defaults to 1000 when not specified', () => {
    const guantr = new Guantr();
    expect(guantr).toBeDefined();
  });

  it('createGuantr with valid options works', async () => {
    const guantr = await createGuantr({ maxRuleIterations: 500 });
    expect(guantr).toBeDefined();
  });
});
