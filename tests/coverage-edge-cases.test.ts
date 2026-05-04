/**
 * Focused coverage tests for hard-to-reach branches.
 */
import { describe, expect, it } from 'vitest';
import {
  Guantr,
  GuantrInvalidConditionOperatorError,
  GuantrRuleConditionExpression,
  matchConditionExpression,
  matchRuleCondition,
  validateCondition,
  GuantrRule,
  createGuantr,
} from '../src/index';

describe('Coverage edge cases', () => {
  // ---------------------------------------------------------------------------
  // index.ts:260 — getRules() cache hit path
  // ---------------------------------------------------------------------------
  it('getRules cache hit: second call returns cached rules', async () => {
    const guantr = new Guantr();
    await guantr.setRules([{ effect: 'allow', action: 'read', resource: 'post', condition: null }]);
    await guantr.getRules();
    const rules = await guantr.getRules();
    expect(rules).toHaveLength(1);
  });

  // ---------------------------------------------------------------------------
  // index.ts:378 — unconditional deny in loop via custom storage
  // ---------------------------------------------------------------------------
  it('unconditional deny with falsy non-null condition reaches loop else branch', async () => {
    const storage = {
      rules: [] as GuantrRule[],
      cache: undefined as any,
      setRules: async function (rules: GuantrRule[]) {
        this.rules = rules;
      },
      getRules: async function () {
        return [...this.rules];
      },
      queryRules: async function () {
        return this.rules.map((r: any) => ({
          ...r,
          condition: r.condition === null ? (0 as any) : r.condition,
        }));
      },
    };
    const guantr = new Guantr({ storage: storage as any });
    await guantr.setRules([{ effect: 'deny', action: 'read', resource: 'post', condition: null }]);
    expect(await guantr.can('read', ['post', { id: 1 }])).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // index.ts:463 — if (activeCache) branch coverage (both truthy and falsy)
  // ---------------------------------------------------------------------------
  it('if (activeCache) both branches covered (index.ts:463)', async () => {
    // 1) Storage with cache: undefined → activeCache is undefined → falsy → skip
    const storageNoCache = {
      setRules: async () => {},
      getRules: async () => [],
      queryRules: async () => [
        {
          effect: 'allow' as const,
          action: 'read',
          resource: 'post',
          condition: { authorId: ['eq', '$ctx.userId'] } as any,
        },
      ],
    };
    const g1 = new Guantr({
      getContext: () => ({ userId: 42 }),
      storage: storageNoCache as any,
    });
    expect(await g1.can('read', ['post', { authorId: 42 }])).toBe(true);

    // 2) Storage WITH cache (default InMemoryStorage) → truthy → enter body
    const g2 = new Guantr({
      getContext: () => ({ userId: 99 }),
    });
    await g2.setRules([
      {
        effect: 'allow' as const,
        action: 'read',
        resource: 'post',
        condition: { authorId: ['eq', '$ctx.userId'] },
      },
    ]);
    expect(await g2.can('read', ['post', { authorId: 99 }])).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // index.ts:499 — hasOwnProperty else branch in traverse
  //   Use Object.create to give the condition an inherited property that
  //   for...in enumerates but hasOwnProperty rejects.
  // ---------------------------------------------------------------------------
  it('traverse skips inherited property (index.ts:499)', async () => {
    const proto = { malicious: ['eq', 'injected'] };
    const condition = Object.create(proto);
    condition.authorId = ['eq', '$ctx.userId'];

    const storage = {
      _rules: [] as GuantrRule[],
      setRules: async function (rules: GuantrRule[]) {
        this._rules = rules;
      },
      getRules: async function () {
        return [...this._rules];
      },
      queryRules: async function (action: string, resource: string) {
        return this._rules.filter((r) => r.action === action && r.resource === resource);
      },
      cache: {
        set: async () => {},
        get: async () => undefined,
        has: async () => false,
        clear: async () => {},
      },
    };
    const g = new Guantr({ storage: storage as any, getContext: () => ({ userId: 42 }) });
    await storage.setRules([
      { effect: 'allow' as const, action: 'read', resource: 'post', condition: condition as any },
    ]);
    expect(await g.can('read', ['post', { authorId: 42 }])).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // index.ts:565 — createGuantr ?: first branch: rules array, no options
  // ---------------------------------------------------------------------------
  it('createGuantr with rules array and no options (index.ts:565)', async () => {
    const guantr = await createGuantr([
      { effect: 'allow' as const, action: 'read', resource: 'post', condition: null },
    ]);
    expect(await guantr.can('read', ['post', { id: 1 }])).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // utils.ts:574 — checkComplexCondition return false for non-object item
  // ---------------------------------------------------------------------------
  it('checkComplexCondition nested object on non-object value returns false', () => {
    expect(
      matchRuleCondition(
        { items: [{ id: 1, name: 'John' }] },
        { items: ['some', { name: { first: ['eq', 'John'] } }] },
      ),
    ).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // utils.ts:680 — matchConditionExpression early return for short expr
  // ---------------------------------------------------------------------------
  it('matchConditionExpression returns false for null expr', () => {
    expect(matchConditionExpression({ value: 'test', expression: null as any })).toBe(false);
  });

  it('matchConditionExpression returns false for short expr', () => {
    expect(matchConditionExpression({ value: 'test', expression: ['eq'] as any })).toBe(false);
  });

  it('matchConditionExpression returns false for empty expr', () => {
    expect(matchConditionExpression({ value: 'test', expression: [] as any })).toBe(false);
  });

  it('matchConditionExpression throws for invalid operator', () => {
    expect(() => matchConditionExpression({ value: 42, expression: ['badOp', 42] as any })).toThrow(
      GuantrInvalidConditionOperatorError,
    );
  });

  it('matchConditionExpression with valid eq operator', () => {
    const expr: GuantrRuleConditionExpression = ['eq', 'hello'];
    expect(matchConditionExpression({ value: 'hello', expression: expr })).toBe(true);
  });

  it('matchConditionExpression with valid gt operator', () => {
    const expr: GuantrRuleConditionExpression = ['gt', 3];
    expect(matchConditionExpression({ value: 5, expression: expr })).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // validateCondition edge case
  // ---------------------------------------------------------------------------
  it('validateCondition with non-null non-object condition', () => {
    expect(() => validateCondition('invalid' as any)).toThrow();
  });
});
