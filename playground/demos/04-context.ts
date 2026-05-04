/**
 * Demo 4: Context-Aware Rules
 * ============================
 *
 * Demonstrates $ctx. operands — how rules can reference context values
 * that are resolved at evaluation time.
 *
 * Also covers:
 *   - can / cannot / can.abstract / cannot.abstract
 *   - Rule lifecycle: setRules (array + callback), getRules, relatedRulesFor
 *   - Condition validation at definition time
 */

import type { Post, BlogContext } from '../utils';
import { createGuantr, GuantrMeta, GuantrResourceMap, validateCondition } from '../../src/index';
import { heading, sub, assert, info } from '../utils';
import { publishedPost } from '../utils';

/* ------------------------------------------------------------------ */
/*  Typed context demo                                                  */
/* ------------------------------------------------------------------ */

type CtxResourceMap = GuantrResourceMap<{
  post: {
    action: 'read' | 'update' | 'delete' | 'publish';
    model: Post;
  };
}>;

type CtxMeta = GuantrMeta<CtxResourceMap, BlogContext>;

export async function demoContext(): Promise<void> {
  heading('4. Context-Aware Rules ($ctx.)');

  /* ------------------------------------------------------------------ */
  /*  4a. Context with leaf-key autocompletion                           */
  /* ------------------------------------------------------------------ */
  // ┌─────────────────────────────────────────────────────────────┐
  // │  TYPE COMPLETION CHECKPOINT — $ctx. autocompletion          │
  // │                                                             │
  // │  CtxMeta = GuantrMeta<..., BlogContext>                     │
  // │  BlogContext = { userId, userRole, isAuthenticated, teamId?}│
  // │                                                             │
  // │  When typing `$ctx.` inside condition operands, you should  │
  // │  see these autocompletions:                                 │
  // │                                                             │
  // │  $ctx.userId            (number)                            │
  // │  $ctx.userRole          ('admin'|'editor'|'viewer')         │
  // │  $ctx.isAuthenticated   (boolean)                           │
  // │  $ctx.teamId            (number|undefined)  ← optional      │
  // │                                                             │
  // │  The type of operand is narrowed by the operator:           │
  // │  - ['eq', $ctx.…]   shows matching type context paths      │
  // │  - ['gt', $ctx.…]   shows only number paths                │
  // │  - ['has', $ctx.…]  shows only array paths                 │
  // └─────────────────────────────────────────────────────────────┘
  sub('$ctx. operands — autocompleted from BlogContext');

  const guantr = await createGuantr<CtxMeta>({
    getContext: () => ({
      userId: 42,
      userRole: 'editor',
      isAuthenticated: true,
    }),
  });

  await guantr.setRules([
    {
      effect: 'allow',
      action: 'update',
      resource: 'post',
      condition: { authorId: ['eq', '$ctx.userId'] },
    },
    // Published posts can be read
    {
      effect: 'allow',
      action: 'read',
      resource: 'post',
      condition: { status: ['eq', 'published'] },
    },
  ]);

  // Same author — should match $ctx.userId === 42
  assert(
    await guantr.can('update', ['post', { ...publishedPost(), authorId: 42 }]),
    '$ctx.userId resolves and matches authorId',
  );

  // Different author — should NOT match
  assert(
    !(await guantr.can('update', ['post', { ...publishedPost(), authorId: 99 }])),
    '$ctx.userId does not match different authorId',
  );

  /* ------------------------------------------------------------------ */
  /*  4b. Nullable context properties                                     */
  /* ------------------------------------------------------------------ */
  sub('Nullable context ($ctx.teamId)');

  const guantrWithOptional = await createGuantr<CtxMeta>({
    getContext: () => ({
      userId: 1,
      userRole: 'admin',
      isAuthenticated: true,
      teamId: 1, // teamId is optional but sometimes set
    }),
  });

  await guantrWithOptional.setRules([
    {
      effect: 'allow',
      action: 'read',
      resource: 'post',
      // teamId is optional (BlogContext.teamId?: number).
      // When present, $ctx.teamId resolves to its value (1).
      condition: { authorId: ['eq', '$ctx.teamId'] },
    },
  ]);

  assert(
    await guantrWithOptional.can('read', ['post', { ...publishedPost(), authorId: 1 }]),
    'Optional context property ($ctx.teamId) resolves when set',
  );

  assert(
    !(await guantrWithOptional.can('read', ['post', { ...publishedPost(), authorId: 99 }])),
    'Optional context property ($ctx.teamId) does not match if present but different',
  );

  // ┌─────────────────────────────────────────────────────────────┐
  // │  TYPE COMPLETION CHECKPOINT — can() / cannot() signatures    │
  // │                                                             │
  // │  When typing `g.can(`, your IDE should show:                 │
  // │    can<ResourceKey, Resource>(                              │
  // │      action: ResourceMap[ResourceKey]['action'],            │
  // │      resource: [ResourceKey, Resource],                     │
  // │    ): Promise<boolean>                                      │
  // │                                                             │
  // │  When typing `g.can.abstract(`, your IDE should show:       │
  // │    can.abstract<ResourceKey>(                               │
  // │      action: ResourceMap[ResourceKey]['action'],            │
  // │      resource: ResourceKey,                                  │
  // │    ): Promise<boolean>                                      │
  // │                                                             │
  // │  Same patterns for `g.cannot` and `g.cannot.abstract`.      │
  // └─────────────────────────────────────────────────────────────┘
  /* ------------------------------------------------------------------ */
  /*  4c. can / cannot / abstract methods                                 */
  /* ------------------------------------------------------------------ */
  sub('can(), cannot(), can.abstract(), cannot.abstract()');

  const g = await createGuantr<CtxMeta>({
    getContext: () => ({ userId: 1, userRole: 'admin', isAuthenticated: true }),
  });

  await g.setRules([
    { effect: 'allow', action: 'read', resource: 'post', condition: null },
    {
      effect: 'deny',
      action: 'delete',
      resource: 'post',
      condition: { status: ['eq', 'published'] },
    },
    {
      effect: 'allow',
      action: 'delete',
      resource: 'post',
      condition: { authorId: ['eq', '$ctx.userId'] },
    },
  ]);

  // can() — full evaluation
  assert(await g.can('read', ['post', publishedPost()]), 'can() returns true for allowed action');
  assert(
    !(await g.can('delete', ['post', publishedPost()])),
    'can() returns false when deny overrides',
  );

  // cannot() — negation
  assert(await g.cannot('delete', ['post', publishedPost()]), 'cannot() negates can()');
  assert(
    !(await g.cannot('read', ['post', publishedPost()])),
    'cannot() returns false for allowed action',
  );

  // can.abstract() — ignores conditions and deny rules
  assert(await g.can.abstract('delete', 'post'), 'can.abstract() true when any allow rule exists');
  assert(
    !(await g.can.abstract('publish', 'post')),
    'can.abstract() false when no allow rule exists',
  );

  // cannot.abstract() — negated abstract
  assert(
    await g.cannot.abstract('publish', 'post'),
    'cannot.abstract() true when no allow rule exists',
  );
  assert(
    !(await g.cannot.abstract('read', 'post')),
    'cannot.abstract() false when allow rule exists',
  );

  /* ------------------------------------------------------------------ */
  /*  4d. Rule lifecycle                                                  */
  /* ------------------------------------------------------------------ */
  sub('Rule lifecycle: setRules / getRules / relatedRulesFor');

  const lifecycle = await createGuantr<CtxMeta>();

  // setRules with array
  await lifecycle.setRules([
    { effect: 'allow', action: 'read', resource: 'post', condition: null },
    {
      effect: 'deny',
      action: 'delete',
      resource: 'post',
      condition: { status: ['eq', 'archived'] },
    },
  ]);
  assert(
    (await lifecycle.getRules()).length === 2,
    'getRules returns 2 rules after setRules(array)',
  );

  // setRules with callback (replaces all rules)
  await lifecycle.setRules(async (allow) => {
    allow('read', 'post');
    allow('read', ['post', { status: ['eq', 'published'] }]);
  });
  assert(
    (await lifecycle.getRules()).length === 2,
    'getRules returns 2 rules after callback setRules',
  );

  // relatedRulesFor — filters by action + resource
  const filtered = await lifecycle.relatedRulesFor('read', 'post');
  assert(filtered.length === 2, 'relatedRulesFor filters by action+resource');
  assert(
    filtered.every((r) => r.action === 'read' && r.resource === 'post'),
    'All returned rules match',
  );

  // relatedRulesFor with contextual operand resolution
  const ctxGuantr = await createGuantr<CtxMeta>({
    getContext: () => ({ userId: 1, userRole: 'admin', isAuthenticated: true }),
  });
  await ctxGuantr.setRules([
    {
      effect: 'allow',
      action: 'read',
      resource: 'post',
      condition: { authorId: ['eq', '$ctx.userId'] },
    },
  ]);

  const resolved = await ctxGuantr.relatedRulesFor('read', 'post', {
    applyConditionContextualOperands: true,
  });
  assert(resolved.length === 1, 'relatedRulesFor with contextual operands returns 1 rule');
  assert(
    JSON.stringify(resolved[0].condition).includes('1'),
    '$ctx.userId resolved to 1 in condition',
  );

  /* ------------------------------------------------------------------ */
  /*  4e. Condition validation                                            */
  /* ------------------------------------------------------------------ */
  sub('Condition validation at definition time');

  // Valid conditions — should not throw
  validateCondition(null);
  validateCondition({ status: ['eq', 'published'] });
  validateCondition({ tags: ['hasSome', ['a', 'b']] });
  validateCondition({
    items: ['some', { price: ['gte', 10] }],
  });
  assert(true, 'validateCondition accepts valid conditions');

  // Invalid conditions — should throw
  try {
    // Intentionally passing an invalid operator to test runtime validation
    validateCondition({ bad: ['unknown_op', 'val'] } as unknown as Parameters<
      typeof validateCondition
    >[0]);
    assert(false, 'Should have thrown for unknown operator');
  } catch {
    assert(true, 'validateCondition rejects unknown operator');
  }

  /* ------------------------------------------------------------------ */
  /*  Summary                                                             */
  /* ------------------------------------------------------------------ */
  info('Context usage and lifecycle verified.');
}
