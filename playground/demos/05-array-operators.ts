/**
 * Demo 5: Array Operators (some / every / none / $expr)
 * =====================================================
 *
 * Demonstrates object-array operators and $expr (length + expression).
 */

import { createGuantr, matchRuleCondition, GuantrMeta, GuantrResourceMap } from '../../src/index';
import { heading, sub, assert, info } from '../utils';

/* ------------------------------------------------------------------ */
/*  Typed resource maps for end-to-end $expr demos                    */
/* ------------------------------------------------------------------ */

/** Model with primitive array — used by $expr + has/length demo */
type TaggedPost = {
  id: number;
  tags: string[];
};

/** Model with object array — used by $expr + some/length demo */
type CommentedPost = {
  id: number;
  comments: Array<{
    id: number;
    text: string;
    moderated: boolean;
  }>;
};

type ExprResourceMap = GuantrResourceMap<{
  post: { action: 'read'; model: TaggedPost };
  article: { action: 'read'; model: CommentedPost };
}>;

type ExprMeta = GuantrMeta<ExprResourceMap>;

export async function demoArrayOperators(): Promise<void> {
  heading('5. Array Operators (some / every / none / $expr)');

  /* ------------------------------------------------------------------ */
  /*  5a. some — at least one element matches                             */
  /* ------------------------------------------------------------------ */
  sub('some — at least one element matches the nested condition');

  const article = {
    comments: [
      { id: 1, text: 'Great post!', moderated: true },
      { id: 2, text: 'Spam comment', moderated: false },
      { id: 3, text: 'Nice work', moderated: true },
    ],
  };

  assert(
    matchRuleCondition(article, {
      comments: ['some', { moderated: ['eq', false] }],
    }),
    'some: at least one unmoderated comment exists',
  );

  assert(
    matchRuleCondition(article, {
      comments: ['some', { text: ['contains', 'Spam'] }],
    }),
    'some: at least one comment contains "Spam"',
  );

  assert(
    !matchRuleCondition(article, {
      comments: ['some', { text: ['eq', 'nonexistent'] }],
    }),
    'some: no comment matches nonexistent text',
  );

  /* ------------------------------------------------------------------ */
  /*  5b. every — all elements must match                                 */
  /* ------------------------------------------------------------------ */
  sub('every — all elements must match the nested condition');

  assert(
    !matchRuleCondition(article, {
      comments: ['every', { moderated: ['eq', true] }],
    }),
    'every: not all comments are moderated (one is false)',
  );

  // All comments should have non-empty text
  assert(
    matchRuleCondition(article, {
      comments: ['every', { text: ['startsWith', ''] }],
    }),
    'every: all texts start with empty string (always true)',
  );

  /* ------------------------------------------------------------------ */
  /*  5c. none — no elements should match                                 */
  /* ------------------------------------------------------------------ */
  sub('none — no elements must match the nested condition');

  assert(
    matchRuleCondition(article, {
      comments: ['none', { text: ['eq', 'nonexistent'] }],
    }),
    'none: no comment matches "nonexistent"',
  );

  assert(
    !matchRuleCondition(article, {
      comments: ['none', { moderated: ['eq', false] }],
    }),
    'none: there IS an unmoderated comment, so none([moderated=false]) is false',
  );

  /* ------------------------------------------------------------------ */
  /*  5d. some with multiple nested conditions                            */
  /* ------------------------------------------------------------------ */
  sub('some with multiple conditions in the nested condition');

  assert(
    matchRuleCondition(article, {
      comments: ['some', { moderated: ['eq', true], text: ['contains', 'Great'] }],
    }),
    'some: moderated comment containing "Great"',
  );

  assert(
    !matchRuleCondition(article, {
      comments: ['some', { moderated: ['eq', true], text: ['contains', 'Spam'] }],
    }),
    'some: no moderated comment contains "Spam"',
  );

  /* ------------------------------------------------------------------ */
  /*  5e. $expr — combine length check with array expression              */
  /* ------------------------------------------------------------------ */
  sub('$expr — combining length with array expression');

  const model = {
    tags: ['news', 'tech', 'typescript'],
  };

  assert(
    matchRuleCondition(model, {
      tags: { $expr: ['has', 'tech'], length: ['gte', 2] },
    }),
    '$expr: length >= 2 AND has "tech"',
  );

  assert(
    !matchRuleCondition(model, {
      tags: { $expr: ['has', 'sports'], length: ['gte', 2] },
    }),
    '$expr: length >= 2 but does NOT have "sports"',
  );

  assert(
    !matchRuleCondition(model, {
      tags: { $expr: ['has', 'news'], length: ['eq', 1] },
    }),
    '$expr: has "news" but length is not 1',
  );

  // ── End-to-end: $expr + length in an actual rule ──
  // ┌─────────────────────────────────────────────────────────────┐
  // │  TYPE COMPLETION CHECKPOINT — typed $expr + length         │
  // │                                                             │
  // │  Using createGuantr<ExprMeta>() — tags is string[],         │
  // │  autocomplete suggests ['has', <string>], ['hasSome', ...], │
  // │  and { $expr: ..., length: ... } for arrays.               │
  // │  The operand of `has` is narrowed to string.                │
  // └─────────────────────────────────────────────────────────────┘
  sub('End-to-end: setRules with $expr + length');

  const guantrExpr = await createGuantr<ExprMeta>();
  await guantrExpr.setRules([
    {
      effect: 'allow',
      action: 'read',
      resource: 'post',
      condition: {
        tags: { $expr: ['has', 'typescript'], length: ['gte', 2] },
      },
    },
  ]);

  assert(
    await guantrExpr.can('read', ['post', { id: 1, tags: ['typescript', 'javascript', 'react'] }]),
    '$expr rule: post with typescript AND length >= 2 → allowed',
  );

  assert(
    !(await guantrExpr.can('read', ['post', { id: 2, tags: ['typescript'] }])),
    '$expr rule: post with typescript but length 1 < 2 → denied',
  );

  assert(
    !(await guantrExpr.can('read', ['post', { id: 3, tags: ['javascript', 'react'] }])),
    '$expr rule: post without typescript but length >= 2 → denied',
  );

  // ── End-to-end: $expr + length on array of objects ──
  // ┌─────────────────────────────────────────────────────────────┐
  // │  TYPE COMPLETION CHECKPOINT — typed $expr on object array  │
  // │                                                             │
  // │  comments is Array<{ id, text, moderated }>.                │
  // │  Autocomplete offers:                                       │
  // │    ['some', { moderated: ['eq', <boolean>] }]   ← boolean!  │
  // │    { $expr: ['some', ...], length: ['gte', <number>] }     │
  // │                                                             │
  // │  `moderated` typed as boolean → operand narrowed to boolean.│
  // │  Passing a string (e.g. `['eq', 'string']`) is a TS error. │
  // └─────────────────────────────────────────────────────────────┘
  sub('$expr + length on object arrays (some + length)');

  const guantrObjExpr = await createGuantr<ExprMeta>();
  await guantrObjExpr.setRules([
    {
      effect: 'allow',
      action: 'read',
      resource: 'article',
      // Only allow reading articles that have AT LEAST 2 moderated comments.
      // `moderated` is typed as boolean — autocomplete suggests true/false,
      // and passing a string like `['eq', 'string']` would be a TS error.
      condition: {
        comments: {
          $expr: ['some', { moderated: ['eq', true] }],
          length: ['gte', 2],
        },
      },
    },
  ]);

  assert(
    await guantrObjExpr.can('read', [
      'article',
      {
        id: 1,
        comments: [
          { id: 1, text: 'Great!', moderated: true },
          { id: 2, text: 'Nice', moderated: true },
          { id: 3, text: 'Spam', moderated: false },
        ],
      },
    ]),
    '$expr object array: 3 comments, 2 moderated, length >= 2 → allowed',
  );

  assert(
    !(await guantrObjExpr.can('read', [
      'article',
      {
        id: 2,
        comments: [
          { id: 1, text: 'Spam', moderated: false },
          { id: 2, text: 'Spam2', moderated: false },
        ],
      },
    ])),
    '$expr object array: 2 comments, 0 moderated, some fails → denied',
  );

  assert(
    !(await guantrObjExpr.can('read', [
      'article',
      {
        id: 3,
        comments: [{ id: 1, text: 'Great!', moderated: true }],
      },
    ])),
    '$expr object array: 1 comment, 1 moderated, length < 2 → denied',
  );

  /* ------------------------------------------------------------------ */
  /*  5f. Deeply nested some                                             */
  /* ------------------------------------------------------------------ */
  sub('Deeply nested some inside some');

  const complex = {
    groups: [
      {
        name: 'admins',
        users: [
          { id: 1, active: true },
          { id: 2, active: false },
        ],
      },
      {
        name: 'editors',
        users: [{ id: 3, active: true }],
      },
    ],
  };

  assert(
    matchRuleCondition(complex, {
      groups: [
        'some',
        {
          name: ['eq', 'admins'],
          users: ['some', { id: ['eq', 1] }],
        },
      ],
    }),
    'some with nested some: admins group contains user id=1',
  );

  assert(
    !matchRuleCondition(complex, {
      groups: [
        'some',
        {
          name: ['eq', 'admins'],
          users: ['every', { active: ['eq', true] }],
        },
      ],
    }),
    'some with nested every: not all admins users are active',
  );

  /* ------------------------------------------------------------------ */
  /*  5g. Empty arrays                                                    */
  /* ------------------------------------------------------------------ */
  sub('Edge cases: empty arrays');

  const empty = { items: [] as Array<Record<string, unknown>> };

  assert(
    !matchRuleCondition(empty, { items: ['some', { x: ['eq', 1] }] }),
    'some on empty array returns false',
  );
  assert(
    !matchRuleCondition(empty, { items: ['every', { x: ['eq', 1] }] }),
    'every on empty array returns false (no matching items)',
  );
  assert(
    matchRuleCondition(empty, { items: ['none', { x: ['eq', 1] }] }),
    'none on empty array returns true',
  );

  /* ------------------------------------------------------------------ */
  /*  Summary                                                             */
  /* ------------------------------------------------------------------ */
  info('Array operators verified — some, every, none, $expr.');
}
