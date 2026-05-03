import { describe, expect, it } from 'vitest';
import { createGuantr, Guantr } from '../src/index';
import { matchRuleCondition } from '../src/utils';

describe('deeply nested conditions (depth 3+)', () => {
  // ---------------------------------------------------------------------------
  // Unit tests — matchRuleCondition
  // ---------------------------------------------------------------------------

  it('3-level deep: matches when value equals expected string', () => {
    expect(
      matchRuleCondition({ a: { b: { c: 'deep' } } }, { a: { b: { c: ['eq', 'deep'] } } } as any),
    ).toBe(true);
  });

  it('3-level deep: does not match when value differs from expected string', () => {
    expect(
      matchRuleCondition({ a: { b: { c: 'other' } } }, { a: { b: { c: ['eq', 'deep'] } } } as any),
    ).toBe(false);
  });

  it('4-level deep: matches when value equals expected number', () => {
    expect(
      matchRuleCondition({ a: { b: { c: { d: 42 } } } }, {
        a: { b: { c: { d: ['eq', 42] } } },
      } as any),
    ).toBe(true);
  });

  it('4-level deep: does not match when value differs from expected number', () => {
    expect(
      matchRuleCondition({ a: { b: { c: { d: 99 } } } }, {
        a: { b: { c: { d: ['eq', 42] } } },
      } as any),
    ).toBe(false);
  });

  it('3-level with contains operator: matches when string contains the substring', () => {
    expect(
      matchRuleCondition({ meta: { tags: { primary: 'typescript' } } }, {
        meta: { tags: { primary: ['contains', 'type'] } },
      } as any),
    ).toBe(true);
  });

  it('3-level with contains operator: does not match when substring is absent', () => {
    // 'javascript' does not contain 'type' (j-a-v-a-s-c-r-i-p-t)
    expect(
      matchRuleCondition({ meta: { tags: { primary: 'javascript' } } }, {
        meta: { tags: { primary: ['contains', 'type'] } },
      } as any),
    ).toBe(false);
  });

  it('3-level with gt operator: matches when value is greater than threshold', () => {
    expect(
      matchRuleCondition({ stats: { metrics: { score: 100 } } }, {
        stats: { metrics: { score: ['gt', 50] } },
      } as any),
    ).toBe(true);
  });

  it('3-level with gt operator: does not match when value is below threshold', () => {
    expect(
      matchRuleCondition({ stats: { metrics: { score: 30 } } }, {
        stats: { metrics: { score: ['gt', 50] } },
      } as any),
    ).toBe(false);
  });

  it('3-level where intermediate value is null: returns false', () => {
    // model.a.b is null — isPlainObject(null) === false and Array.isArray(null) === false,
    // so matchRuleCondition returns false when it cannot recurse into a null value.
    expect(
      matchRuleCondition(
        { a: { b: null } } as Record<string, unknown>,
        { a: { b: { c: ['eq', 'deep'] } } } as any,
      ),
    ).toBe(false);
  });

  it('mixed depth: matches when all conditions at different depths pass', () => {
    expect(
      matchRuleCondition({ title: 'hello', meta: { tags: { primary: 'typescript' } } }, {
        title: ['eq', 'hello'],
        meta: { tags: { primary: ['eq', 'typescript'] } },
      } as any),
    ).toBe(true);
  });

  it('mixed depth: does not match when the shallow (depth-1) condition fails', () => {
    expect(
      matchRuleCondition({ title: 'world', meta: { tags: { primary: 'typescript' } } }, {
        title: ['eq', 'hello'],
        meta: { tags: { primary: ['eq', 'typescript'] } },
      } as any),
    ).toBe(false);
  });

  it('mixed depth: does not match when the deep (depth-3) condition fails', () => {
    expect(
      matchRuleCondition({ title: 'hello', meta: { tags: { primary: 'javascript' } } }, {
        title: ['eq', 'hello'],
        meta: { tags: { primary: ['eq', 'typescript'] } },
      } as any),
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
        condition: {
          meta: {
            tags: {
              primary: ['eq', 'typescript'],
            },
          },
        } as any,
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
        condition: {
          meta: {
            tags: {
              primary: ['eq', 'typescript'],
            },
          },
        } as any,
        effect: 'allow',
      },
    ]);

    expect(
      await guantr.can('read', ['document', { meta: { tags: { primary: 'javascript' } } }]),
    ).toBe(false);
  });

  it('createGuantr with 4-level nested condition: context operand injected at a deep path resolves correctly', async () => {
    // Context: { config: { permissions: { maxDepth: 5 } } }
    // Condition operand '$ctx.config.permissions.maxDepth' is resolved to 5 at evaluation time.
    const guantr = new Guantr({
      getContext: () => ({ config: { permissions: { maxDepth: 5 } } }),
    });

    await guantr.setRules([
      {
        resource: 'item',
        action: 'read',
        condition: {
          settings: {
            config: {
              maxDepth: ['gte', '$ctx.config.permissions.maxDepth'],
            },
          },
        } as any,
        effect: 'allow',
      },
    ]);

    // 5 >= 5 → true
    expect(await guantr.can('read', ['item', { settings: { config: { maxDepth: 5 } } }])).toBe(
      true,
    );

    // 10 >= 5 → true
    expect(await guantr.can('read', ['item', { settings: { config: { maxDepth: 10 } } }])).toBe(
      true,
    );

    // 3 >= 5 → false
    expect(await guantr.can('read', ['item', { settings: { config: { maxDepth: 3 } } }])).toBe(
      false,
    );
  });
});
