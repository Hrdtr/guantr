/**
 * Demo 1: Basic Untyped Usage
 * ============================
 *
 * Demonstrates using Guantr WITHOUT type arguments.
 * Useful for plain JavaScript projects or quick prototyping.
 *
 * TypeScript users get full type safety when no generics are provided:
 *   - GuantrRule         → { resource: string; action: string; ... }
 *   - GuantrRuleCondition → { [key: string]: GuantrRuleConditionExpression | ... }
 *   - GuantrRuleConditionExpression → ['eq', ...] | ['in', ...] | ...
 */

import {
  createGuantr,
  GuantrRule,
  GuantrRuleCondition,
  GuantrRuleConditionExpression,
} from '../../src/index';
import { heading, sub, assert, info } from '../utils';

export async function demoBasic(): Promise<void> {
  heading('1. Basic Untyped Usage');

  /* ------------------------------------------------------------------ */
  /*  1a. Untyped GuantrRule                                              */
  /* ------------------------------------------------------------------ */
  sub('GuantrRule without type arguments');

  // When no type arguments are provided, GuantrRule accepts any strings
  // for `resource` and `action`, and any condition object.
  const rule: GuantrRule = {
    effect: 'deny',
    action: 'delete', // autocomplete: any string
    resource: 'post', // autocomplete: any string
    condition: null,
  };
  assert(rule.effect === 'deny', 'Untyped GuantrRule accepts plain string action/resource');

  const ruleWithCond: GuantrRule = {
    effect: 'allow',
    action: 'read',
    resource: 'article',
    condition: {
      status: ['eq', 'published'],
      // Nested conditions work too
      author: { role: ['in', ['editor', 'admin']] },
    },
  };
  assert(ruleWithCond.condition !== null, 'Untyped GuantrRule accepts arbitrary condition');

  /* ------------------------------------------------------------------ */
  /*  1b. Untyped GuantrRuleCondition                                      */
  /* ------------------------------------------------------------------ */
  sub('GuantrRuleCondition without type arguments');

  // Without generics, GuantrRuleCondition is an index-signature type
  // that accepts any keys with expression or nested condition values.
  const cond: GuantrRuleCondition = {
    status: ['eq', 'published'],
    tags: ['has', 'tech'],
    nested: {
      deep: ['gte', 10],
    },
  };
  assert(cond['status']?.[0] === 'eq', 'Untyped condition with eq operator');
  const nestedDeep = cond.nested as GuantrRuleCondition;
  assert(
    Array.isArray(nestedDeep.deep) && nestedDeep.deep[0] === 'gte',
    'Untyped nested condition resolved',
  );

  /* ------------------------------------------------------------------ */
  /*  1c. GuantrRuleConditionExpression                                    */
  /* ------------------------------------------------------------------ */
  sub('GuantrRuleConditionExpression');

  // The expression union — usable without any type arguments
  const exprEq: GuantrRuleConditionExpression = ['eq', 'published'];
  const exprIn: GuantrRuleConditionExpression = ['in', ['draft', 'published']];
  const exprGt: GuantrRuleConditionExpression = ['gt', 5];
  const exprHasSome: GuantrRuleConditionExpression = ['hasSome', ['tag1', 'tag2']];

  assert(exprEq[0] === 'eq', 'Expression eq works');
  assert(exprIn[0] === 'in', 'Expression in works');
  assert(exprGt[0] === 'gt', 'Expression gt works');
  assert(exprHasSome[0] === 'hasSome', 'Expression hasSome works');

  /* ------------------------------------------------------------------ */
  /*  1d. createGuantr() — no type args                                  */
  /* ------------------------------------------------------------------ */
  sub('createGuantr() with no type arguments');

  info('Instantiating Guantr without any generics...');

  const guantr = await createGuantr();

  // setRules with array — all fields are untyped (plain strings)
  await guantr.setRules([{ effect: 'allow', action: 'read', resource: 'public', condition: null }]);

  assert(await guantr.can('read', ['public', {}]), 'can() works in untyped mode');

  assert(
    !(await guantr.can('write', ['public', {}])),
    'can() returns false for undefined permissions',
  );

  // setRules with callback — same untyped behavior
  await guantr.setRules((allow, deny) => {
    allow('read', 'dashboard');
    deny('delete', ['dashboard', { ownerOnly: ['eq', true] }]);
  });

  assert(await guantr.can('read', ['dashboard', {}]), 'setRules callback works in untyped mode');

  /* ------------------------------------------------------------------ */
  /*  1e. Guantr class constructor — no type args                        */
  /* ------------------------------------------------------------------ */
  sub('new Guantr() without type arguments');

  const { Guantr } = await import('../../src/index');
  const g2 = new Guantr();

  await g2.setRules([{ effect: 'allow', action: 'view', resource: 'homepage', condition: null }]);

  assert(await g2.can('view', ['homepage', {}]), 'new Guantr() works in untyped mode');

  /* ------------------------------------------------------------------ */
  /*  1f. Context usage — untyped still supports $ctx.                   */
  /* ------------------------------------------------------------------ */
  sub('Context usage with $ctx. operands (untyped)');

  info('Even without generics, you can use getContext and $ctx. operands.');

  const guantrCtx = await createGuantr({
    getContext: () => ({ userId: 42, role: 'admin' }),
  });

  await guantrCtx.setRules([
    {
      effect: 'allow',
      action: 'read',
      resource: 'document',
      condition: { ownerId: ['eq', '$ctx.userId'] },
    },
    {
      effect: 'deny',
      action: 'delete',
      resource: 'document',
      condition: { ownerId: ['eq', '$ctx.role'] },
    },
  ]);

  assert(
    await guantrCtx.can('read', ['document', { ownerId: 42 }]),
    'Untyped $ctx.userId resolves to 42 and matches',
  );

  assert(
    !(await guantrCtx.can('read', ['document', { ownerId: 99 }])),
    'Untyped $ctx.userId resolves to 42, does not match 99',
  );

  assert(
    !(await guantrCtx.can('delete', ['document', { ownerId: 'admin' }])),
    'Untyped $ctx.role resolves to "admin", deny rule matches → denied',
  );

  /* ------------------------------------------------------------------ */
  /*  Summary                                                             */
  /* ------------------------------------------------------------------ */
  info('Untyped mode complete — all APIs accept plain strings. Context with $ctx. still works.');
}
