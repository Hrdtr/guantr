import { describe, expect, it } from 'vitest';
import { createGuantr, Guantr } from '../../src/index';
import { matchRuleCondition } from '../../src/utils';

describe('deeply nested conditions (depth 3+)', () => {
  it('3-level deep: matches when value equals expected string', () => {
    expect(
      matchRuleCondition({ a: { b: { c: 'deep' } } }, { a: { b: { c: ['eq', 'deep'] } } }),
    ).toBe(true);
  });

  it('3-level deep: does not match when value differs from expected string', () => {
    expect(
      matchRuleCondition({ a: { b: { c: 'other' } } }, { a: { b: { c: ['eq', 'deep'] } } }),
    ).toBe(false);
  });

  it('4-level deep: matches when value equals expected number', () => {
    expect(
      matchRuleCondition(
        { a: { b: { c: { d: 42 } } } },
        {
          a: { b: { c: { d: ['eq', 42] } } },
        },
      ),
    ).toBe(true);
  });

  it('4-level deep: does not match when value differs from expected number', () => {
    expect(
      matchRuleCondition(
        { a: { b: { c: { d: 99 } } } },
        {
          a: { b: { c: { d: ['eq', 42] } } },
        },
      ),
    ).toBe(false);
  });

  it('3-level with contains operator: matches when string contains the substring', () => {
    expect(
      matchRuleCondition(
        { meta: { tags: { primary: 'typescript' } } },
        { meta: { tags: { primary: ['contains', 'type'] } } },
      ),
    ).toBe(true);
  });

  it('3-level with contains operator: does not match when substring is absent', () => {
    expect(
      matchRuleCondition(
        { meta: { tags: { primary: 'javascript' } } },
        { meta: { tags: { primary: ['contains', 'type'] } } },
      ),
    ).toBe(false);
  });

  it('3-level with gt operator: matches when value is greater than threshold', () => {
    expect(
      matchRuleCondition(
        { stats: { metrics: { score: 100 } } },
        { stats: { metrics: { score: ['gt', 50] } } },
      ),
    ).toBe(true);
  });

  it('3-level with gt operator: does not match when value is below threshold', () => {
    expect(
      matchRuleCondition(
        { stats: { metrics: { score: 30 } } },
        { stats: { metrics: { score: ['gt', 50] } } },
      ),
    ).toBe(false);
  });

  it('3-level where intermediate value is null: returns false', () => {
    expect(matchRuleCondition({ a: { b: null } }, { a: { b: { c: ['eq', 'deep'] } } })).toBe(false);
  });

  it('mixed depth: matches when all conditions at different depths pass', () => {
    expect(
      matchRuleCondition(
        { title: 'hello', meta: { tags: { primary: 'typescript' } } },
        { title: ['eq', 'hello'], meta: { tags: { primary: ['eq', 'typescript'] } } },
      ),
    ).toBe(true);
  });

  it('mixed depth: does not match when the shallow condition fails', () => {
    expect(
      matchRuleCondition(
        { title: 'world', meta: { tags: { primary: 'typescript' } } },
        { title: ['eq', 'hello'], meta: { tags: { primary: ['eq', 'typescript'] } } },
      ),
    ).toBe(false);
  });

  it('mixed depth: does not match when the deep condition fails', () => {
    expect(
      matchRuleCondition(
        { title: 'hello', meta: { tags: { primary: 'javascript' } } },
        { title: ['eq', 'hello'], meta: { tags: { primary: ['eq', 'typescript'] } } },
      ),
    ).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Integration tests — createGuantr + can()
  // ---------------------------------------------------------------------------

  it('createGuantr + setRules with 3-level nested condition: can() returns true when matching', async () => {
    const guantr = await createGuantr();
    await guantr.setRules([
      {
        resource: 'document',
        action: 'read',
        condition: { meta: { tags: { primary: ['eq', 'typescript'] } } },
        effect: 'allow',
      },
    ]);
    expect(
      await guantr.can('read', ['document', { meta: { tags: { primary: 'typescript' } } }]),
    ).toBe(true);
  });

  it('createGuantr + setRules with 3-level nested condition: can() returns false when not matching', async () => {
    const guantr = await createGuantr();
    await guantr.setRules([
      {
        resource: 'document',
        action: 'read',
        condition: { meta: { tags: { primary: ['eq', 'typescript'] } } },
        effect: 'allow',
      },
    ]);
    expect(
      await guantr.can('read', ['document', { meta: { tags: { primary: 'javascript' } } }]),
    ).toBe(false);
  });

  it('createGuantr with 4-level nested condition: context operand resolves at a deep path', async () => {
    const guantr = new Guantr({
      getContext: () => ({ config: { permissions: { maxDepth: 5 } } }),
    });
    await guantr.setRules([
      {
        resource: 'item',
        action: 'read',
        condition: {
          settings: { config: { maxDepth: ['gte', '$ctx.config.permissions.maxDepth'] } },
        },
        effect: 'allow',
      },
    ]);
    expect(await guantr.can('read', ['item', { settings: { config: { maxDepth: 5 } } }])).toBe(
      true,
    );
    expect(await guantr.can('read', ['item', { settings: { config: { maxDepth: 10 } } }])).toBe(
      true,
    );
    expect(await guantr.can('read', ['item', { settings: { config: { maxDepth: 3 } } }])).toBe(
      false,
    );
  });
});
