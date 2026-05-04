/**
 * Demo 2: Fully Typed Usage
 * ==========================
 *
 * Demonstrates using Guantr with GuantrMeta for full type safety.
 *
 * Key v2.0 patterns:
 *   - Context is part of GuantrMeta, NOT a separate generic
 *   - createGuantr<MyMeta>()  — no Context generic needed
 *   - GuantrRule<MyMeta>      — infers resource keys, actions, condition shapes
 *   - GuantrRuleCondition     — untyped when no Model; typed with Model
 *   - $ctx. autocompletion   — Context leaf keys appear in condition operands
 */

import type { Post, User, BlogContext } from '../utils';
import {
  createGuantr,
  GuantrMeta,
  GuantrResourceMap,
  GuantrRule,
  GuantrRuleCondition,
} from '../../src/index';
import { heading, sub, assert, info } from '../utils';

/* ------------------------------------------------------------------ */
/*  Blog Resource Map & Meta                                            */
/* ------------------------------------------------------------------ */

type BlogResourceMap = GuantrResourceMap<{
  post: {
    action: 'create' | 'read' | 'update' | 'delete' | 'publish';
    model: Post;
  };
  user: {
    action: 'read' | 'update' | 'delete' | 'ban';
    model: User;
  };
  comment: {
    action: 'create' | 'read' | 'moderate' | 'delete';
    model: {
      id: number;
      postId: number;
      userId: number;
      text: string;
      flagged: boolean;
      moderated: boolean;
    };
  };
}>;

/**
 * BlogMeta includes BlogContext directly.
 * v2.0: Context is NO LONGER a separate generic on createGuantr.
 */
type BlogMeta = GuantrMeta<BlogResourceMap, BlogContext>;

/* ------------------------------------------------------------------ */
/*  Helper to create a fully-typed guantr instance                      */
/* ------------------------------------------------------------------ */

function createBlogGuantr(ctx: BlogContext) {
  return createGuantr<BlogMeta>({
    getContext: () => ctx,
  });
}

/* ------------------------------------------------------------------ */
/*  Demo                                                                */
/* ------------------------------------------------------------------ */

export async function demoTyped(): Promise<void> {
  heading('2. Fully Typed Usage');

  /* ------------------------------------------------------------------ */
  /*  2a. GuantrRule<BlogMeta>                                           */
  /* ------------------------------------------------------------------ */
  // ┌─────────────────────────────────────────────────────────────┐
  // │  TYPE COMPLETION CHECKPOINT — GuantrRule<BlogMeta>          │
  // │                                                             │
  // │  Type the object literal below. Your IDE should autocomplete:│
  // │  resource  → 'post' | 'user' | 'comment'                    │
  // │  action    → narrowed after choosing resource               │
  // │              - post:  'create'|'read'|'update'|'delete'|'pub'│
  // │              - user:  'read'|'update'|'delete'|'ban'        │
  // │              - comment: 'create'|'read'|'moderate'|'delete' │
  // │  condition → GuantrRuleCondition<Post, BlogContext>         │
  // │              keys are Post model fields                     │
  // │              $ctx. shows BlogContext leaf keys              │
  // └─────────────────────────────────────────────────────────────┘
  sub('GuantrRule<BlogMeta> — narrowed resource & action');

  const typedRule: GuantrRule<BlogMeta> = {
    effect: 'allow',
    resource: 'post',
    action: 'publish',
    condition: { authorId: ['eq', '$ctx.userId'] },
  };
  assert(typedRule.resource === 'post', 'Typed GuantrRule<BlogMeta> constrains resource keys');

  /* ------------------------------------------------------------------ */
  /*  2b. GuantrRuleCondition<Model, Context>                             */
  /* ------------------------------------------------------------------ */
  // ┌─────────────────────────────────────────────────────────────┐
  // │  TYPE COMPLETION CHECKPOINT — GuantrRuleCondition<Post,    │
  // │                                    BlogContext>            │
  // │                                                             │
  // │  When typing condition keys, autocomplete shows Post fields:│
  // │  id (number)    → NumberConditionExpression                 │
  // │  title (string) → StringConditionExpression                 │
  // │  status (union) → StringConditionExpression (literals)      │
  // │  tags (string[]) → ArrayConditionExpressionBasic            │
  // │  metadata (obj) → nested GuantrRuleCondition                │
  // │  comments (array of obj) → ArrayConditionExpressionObject   │
  // │                                                             │
  // │  At operand positions ($ctx.), autocomplete shows           │
  // │  BlogContext leaf keys:                                     │
  // │  $ctx.userId, $ctx.userRole, $ctx.isAuthenticated,          │
  // │  $ctx.teamId                                                │
  // └─────────────────────────────────────────────────────────────┘
  sub('GuantrRuleCondition<Post, BlogContext> — typed condition');

  const typedCond: GuantrRuleCondition<Post, BlogContext> = {
    status: ['eq', 'published'],
    authorId: ['eq', '$ctx.userId'],
    tags: ['has', 'typescript'],
    metadata: {
      views: ['gte', 100],
      featured: ['eq', true],
    },
  };
  assert(typedCond.status?.[0] === 'eq', 'Typed condition: status eq');
  const md = typedCond.metadata as GuantrRuleCondition;
  assert(Array.isArray(md.views) && md.views[0] === 'gte', 'Typed condition: metadata.views gte');

  /* ------------------------------------------------------------------ */
  /*  2c. GuantrRuleCondition without generics → untyped fallback         */
  /* ------------------------------------------------------------------ */
  sub('GuantrRuleCondition (no generics) — untyped fallback');

  const untypedCond: GuantrRuleCondition = {
    anyKey: ['eq', 'anyValue'],
    deeply: { nested: { path: ['gt', 1] } },
  };
  assert(untypedCond.anyKey?.[0] === 'eq', 'Untyped condition fallback works');

  /* ------------------------------------------------------------------ */
  /*  2d. createGuantr<BlogMeta>() — Context inferred from Meta           */
  /* ------------------------------------------------------------------ */
  // ┌─────────────────────────────────────────────────────────────┐
  // │  TYPE COMPLETION CHECKPOINT — createGuantr<BlogMeta>()     │
  // │                                                             │
  // │  Only ONE type argument is accepted now:                    │
  // │  ✅ createGuantr<BlogMeta>(...)  — Context from Meta        │
  // │  ❌ createGuantr<BlogMeta, BlogContext>(...)  — ERROR       │
  // │                                                             │
  // │  Hover over `guantr` below — its type is:                   │
  // │  Guantr<BlogMeta>                                            │
  // │  (NOT Guantr<BlogMeta, BlogContext>)                        │
  // └─────────────────────────────────────────────────────────────┘
  sub('createGuantr<BlogMeta>() — Context inferred, not passed as generic');

  const guantr = await createBlogGuantr({
    userId: 1,
    userRole: 'editor',
    isAuthenticated: true,
  });

  await guantr.setRules(async (allow, deny) => {
    // Autocomplete: 'action' is narrowed per 'resource'
    // Autocomplete: 'resource' is 'post' | 'user' | 'comment'
    allow('read', 'post');
    allow('update', ['post', { authorId: ['eq', '$ctx.userId'] }]);

    deny('delete', ['post', { status: ['eq', 'published'] }]);
    deny('delete', ['comment', { flagged: ['eq', true] }]);
  });

  const post: Post = {
    id: 10,
    title: 'Test',
    content: '...',
    status: 'published',
    authorId: 1,
    tags: [],
    metadata: { views: 0, featured: false, category: '' },
    comments: [],
  };

  assert(await guantr.can('read', ['post', post]), 'Typed: can read any post');
  assert(
    !(await guantr.can('delete', ['post', post])),
    'Typed: deny overrides allow for published post',
  );

  /* ------------------------------------------------------------------ */
  /*  2e. Type inference in can/cannot calls                              */
  /* ------------------------------------------------------------------ */
  // ┌─────────────────────────────────────────────────────────────┐
  // │  TYPE COMPLETION CHECKPOINT — can() type inference          │
  // │                                                             │
  // │  Type `guantr.can(` and your IDE should show:               │
  // │  - First arg: action narrowed by resource                   │
  // │  - Second arg: ['post', PostInstance]                       │
  // │               The PostInstance is typed (not `any`)         │
  // │                                                             │
  // │  Type `guantr.can.abstract(` and your IDE should show:      │
  // │  - First arg: action narrowed by resource                   │
  // │  - Second arg: resource key (string, no instance)           │
  // └─────────────────────────────────────────────────────────────┘
  sub('can() / cannot() — type inference from resource key');

  await guantr.can('update', [
    'post',
    {
      id: 1,
      title: '',
      content: '',
      status: 'draft',
      authorId: 1,
      tags: [],
      metadata: { views: 0, featured: false, category: '' },
      comments: [],
    },
  ]);

  /* ------------------------------------------------------------------ */
  /*  Summary                                                             */
  /* ------------------------------------------------------------------ */
  info('Typed mode complete — Meta fully drives type inference.');
}
