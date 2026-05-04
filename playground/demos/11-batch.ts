/**
 * Demo 11: Batch Permission Checks (can.all / can.any)
 * =====================================================
 *
 * Demonstrates the batch permission checking API:
 *   - `can.all(checks)` — ALL must be granted
 *   - `can.any(checks)` — ANY must be granted
 *   - `cannot.all(checks)` — ALL must be denied
 *   - `cannot.any(checks)` — ANY must be denied
 *
 * Key benefits:
 *   - Context is resolved once and shared across all checks
 *   - Short-circuits on first conclusive result
 *   - Cleaner syntax for complex authorization logic
 */

import { createGuantr } from '../../src/index';
import { heading, sub, assert } from '../utils';

export async function demoBatch(): Promise<void> {
  heading('11. Batch Permission Checks');

  /* ------------------------------------------------------------------ */
  /*  11a. can.all — single resource, multiple actions                   */
  /* ------------------------------------------------------------------ */
  sub('can.all — single resource, multiple actions');

  const guantr = await createGuantr({
    getContext: () => ({ userId: 42 }),
  });

  await guantr.setRules((allow, deny) => {
    allow('read', 'post');
    allow('update', ['post', { authorId: ['eq', '$ctx.userId'] }]);
    allow('delete', ['post', { authorId: ['eq', '$ctx.userId'] }]);
    deny('delete', ['post', { status: ['eq', 'published'] }]);
    deny('archive', 'post');
  });

  // Owner of a draft post can read, update, and delete
  const draftPost = { id: 1, authorId: 42, status: 'draft' as const };

  const canManageDraft = await guantr.can.all([
    ['read', ['post', draftPost]],
    ['update', ['post', draftPost]],
    ['delete', ['post', draftPost]],
  ]);
  assert(canManageDraft, 'can.all: owner can manage draft post');

  // Owner of a published post can read and update, but NOT delete
  const publishedPost = { id: 2, authorId: 42, status: 'published' as const };

  const canManagePublished = await guantr.can.all([
    ['read', ['post', publishedPost]],
    ['update', ['post', publishedPost]],
    ['delete', ['post', publishedPost]],
  ]);
  assert(!canManagePublished, 'can.all: owner cannot delete published post');

  /* ------------------------------------------------------------------ */
  /*  11b. can.any — at least one permission is enough                   */
  /* ------------------------------------------------------------------ */
  sub('can.any — at least one permission is enough');

  // Reader can at least read, even if they can't update or delete
  const canInteract = await guantr.can.any([
    ['read', ['post', publishedPost]],
    ['update', ['post', publishedPost]],
    ['comment', ['post', publishedPost]], // no rules for 'comment' → false
  ]);
  assert(canInteract, 'can.any: reader can at least read the post');

  // If none are allowed, returns false
  const noPermissions = await guantr.can.any([
    ['delete', ['post', { id: 999, authorId: 99, status: 'published' }]],
    ['admin', ['post', {}]], // no rules for 'admin'
  ]);
  assert(!noPermissions, 'can.any: no permissions at all');

  /* ------------------------------------------------------------------ */
  /*  11c. can.all with context — resolved once                          */
  /*  (prove context is not called N times)                              */
  /* ------------------------------------------------------------------ */
  sub('can.all with shared context resolution');

  let callCount = 0;
  const ctxGuantr = await createGuantr({
    getContext: () => {
      callCount++;
      return { userId: 42 };
    },
  });

  await ctxGuantr.setRules((allow) => {
    allow('read', 'post');
    allow('update', ['post', { authorId: ['eq', '$ctx.userId'] }]);
    allow('delete', ['post', { authorId: ['eq', '$ctx.userId'] }]);
  });

  const myPost = { id: 1, authorId: 42 };
  callCount = 0;
  await ctxGuantr.can.all([
    ['read', ['post', myPost]],
    ['update', ['post', myPost]],
    ['delete', ['post', myPost]],
  ]);
  assert(callCount === 1, 'can.all: context resolved only once');

  /* ------------------------------------------------------------------ */
  /*  11d. can.all — short-circuiting                                   */
  /* ------------------------------------------------------------------ */
  sub('Short-circuit behavior');

  // can.all stops at the first false
  // The third check (delete) would be true, but we never get there
  const cantDeleteAll = await guantr.can.all([
    ['read', ['post', publishedPost]], // true
    ['delete', ['post', publishedPost]], // false → short-circuit
    ['update', ['post', publishedPost]], // would be true, but skipped
  ]);
  assert(!cantDeleteAll, 'can.all: short-circuits on first false');

  // can.any stops at the first true
  const canReadAny = await guantr.can.any([
    ['read', ['post', publishedPost]], // true → short-circuit
    ['delete', ['post', publishedPost]], // would be false, but skipped
  ]);
  assert(canReadAny, 'can.any: short-circuits on first true');

  /* ------------------------------------------------------------------ */
  /*  11e. cannot.all and cannot.any                                     */
  /* ------------------------------------------------------------------ */
  sub('cannot.all — all must be denied');

  // Both delete and archive are denied for published posts
  const allDenied = await guantr.cannot.all([
    ['delete', ['post', publishedPost]],
    ['archive', ['post', publishedPost]],
  ]);
  assert(allDenied, 'cannot.all: delete and archive are denied for published posts');

  // If one is allowed, cannot.all returns false
  const notAllDenied = await guantr.cannot.all([
    ['read', ['post', publishedPost]], // allowed (read is unconditionally allowed)
    ['delete', ['post', publishedPost]], // denied
  ]);
  assert(!notAllDenied, 'cannot.all: read is allowed, so not all denied');

  sub('cannot.any — at least one must be denied');

  const anyDenied = await guantr.cannot.any([
    ['read', ['post', publishedPost]], // allowed
    ['delete', ['post', publishedPost]], // denied → short-circuit
  ]);
  assert(anyDenied, 'cannot.any: delete is denied');

  const noneDenied = await guantr.cannot.any([
    ['read', ['post', draftPost]],
    ['update', ['post', draftPost]],
  ]);
  assert(!noneDenied, 'cannot.any: neither read nor update is denied for draft');

  /* ------------------------------------------------------------------ */
  /*  11f. Empty checks array                                            */
  /* ------------------------------------------------------------------ */
  sub('Edge case: empty checks array');

  assert(await guantr.can.all([]), 'can.all([]) → true (vacuous truth)');
  assert(!(await guantr.can.any([])), 'can.any([]) → false (vacuous false)');
  assert(await guantr.cannot.all([]), 'cannot.all([]) → true (vacuous truth)');
  assert(!(await guantr.cannot.any([])), 'cannot.any([]) → false (vacuous false)');

  /* ------------------------------------------------------------------ */
  /*  11g. Mixed resource keys                                           */
  /* ------------------------------------------------------------------ */
  sub('Mixed resource keys');

  const mixedGuantr = await createGuantr();
  await mixedGuantr.setRules((allow) => {
    allow('read', 'user');
    allow('read', 'post');
    allow('update', ['post', { authorId: ['eq', 1] }]);
  });

  const aUser = { id: 1, name: 'Alice' };
  const aPost = { id: 1, authorId: 1, title: 'My Post' };

  assert(
    await mixedGuantr.can.all([
      ['read', ['user', aUser]],
      ['read', ['post', aPost]],
      ['update', ['post', aPost]],
    ]),
    'can.all: mixed resource keys all pass',
  );
}
