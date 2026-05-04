/**
 * Demo 3: All Condition Operators
 * ================================
 *
 * Demonstrates every condition operator at runtime via matchRuleCondition.
 * Also covers case-insensitive options, nullish expressions, $expr with
 * length checks, and nested object conditions.
 */

import { matchRuleCondition, KNOWN_OPERATORS } from '../../src/index';
import { heading, sub, assert, info } from '../utils';

export async function demoOperators(): Promise<void> {
  heading('3. Condition Operators');

  const model = {
    title: 'Hello World',
    status: 'published',
    tags: ['news', 'tech', 'typescript'],
    count: 42,
    ratio: 3.14,
    active: true,
    nested: { value: 10 },
    optional: null,
    missing: undefined,
  };

  /* ------------------------------------------------------------------ */
  /*  3a. String operators                                                */
  /* ------------------------------------------------------------------ */
  sub('String operators: eq, in, contains, startsWith, endsWith');

  assert(matchRuleCondition(model, { title: ['eq', 'Hello World'] }), 'eq string');
  assert(matchRuleCondition(model, { status: ['in', ['draft', 'published']] }), 'in string');
  assert(matchRuleCondition(model, { title: ['contains', 'World'] }), 'contains');
  assert(matchRuleCondition(model, { title: ['startsWith', 'Hello'] }), 'startsWith');
  assert(matchRuleCondition(model, { title: ['endsWith', 'World'] }), 'endsWith');

  // Negative cases
  assert(!matchRuleCondition(model, { title: ['eq', 'Goodbye'] }), 'eq negative');
  assert(!matchRuleCondition(model, { status: ['in', ['draft', 'archived']] }), 'in negative');
  assert(!matchRuleCondition(model, { title: ['contains', 'xyz'] }), 'contains negative');

  /* ------------------------------------------------------------------ */
  /*  3b. Numeric operators                                               */
  /* ------------------------------------------------------------------ */
  sub('Numeric operators: eq, in, gt, gte');

  assert(matchRuleCondition(model, { count: ['eq', 42] }), 'eq number');
  assert(matchRuleCondition(model, { count: ['in', [10, 42, 100]] }), 'in number');
  assert(matchRuleCondition(model, { count: ['gt', 10] }), 'gt');
  assert(matchRuleCondition(model, { count: ['gte', 42] }), 'gte');
  assert(matchRuleCondition(model, { ratio: ['gt', 3] }), 'gt float');
  assert(matchRuleCondition(model, { ratio: ['gte', 3.14] }), 'gte float');

  // Negative cases
  assert(!matchRuleCondition(model, { count: ['gt', 100] }), 'gt negative');
  assert(!matchRuleCondition(model, { count: ['eq', 0] }), 'eq number negative');

  /* ------------------------------------------------------------------ */
  /*  3c. Boolean operator                                                */
  /* ------------------------------------------------------------------ */
  sub('Boolean operator: eq');

  assert(matchRuleCondition(model, { active: ['eq', true] }), 'eq boolean true');
  assert(!matchRuleCondition(model, { active: ['eq', false] }), 'eq boolean false negative');

  /* ------------------------------------------------------------------ */
  /*  3d. Nullish operator                                                */
  /* ------------------------------------------------------------------ */
  sub('Nullish operator: eq');

  assert(matchRuleCondition({ value: null }, { value: ['eq', null] }), 'eq null');
  assert(matchRuleCondition({ value: undefined }, { value: ['eq', undefined] }), 'eq undefined');

  /* ------------------------------------------------------------------ */
  /*  3e. Array primitive operators                                       */
  /* ------------------------------------------------------------------ */
  sub('Array operators: has, hasSome, hasEvery');

  assert(matchRuleCondition(model, { tags: ['has', 'tech'] }), 'has');
  assert(matchRuleCondition(model, { tags: ['hasSome', ['news', 'sports']] }), 'hasSome');
  assert(matchRuleCondition(model, { tags: ['hasEvery', ['news', 'tech']] }), 'hasEvery');
  assert(!matchRuleCondition(model, { tags: ['has', 'sports'] }), 'has negative');
  assert(
    !matchRuleCondition(model, { tags: ['hasSome', ['sports', 'music']] }),
    'hasSome negative',
  );
  assert(
    !matchRuleCondition(model, { tags: ['hasEvery', ['news', 'tech', 'music']] }),
    'hasEvery negative',
  );

  /* ------------------------------------------------------------------ */
  /*  3f. Case-insensitive option                                         */
  /* ------------------------------------------------------------------ */
  sub('Case-insensitive option');

  assert(
    matchRuleCondition(model, { title: ['eq', 'hello world', { caseInsensitive: true }] }),
    'eq case-insensitive',
  );
  assert(
    matchRuleCondition(model, { tags: ['has', 'TYPESCRIPT', { caseInsensitive: true }] }),
    'has case-insensitive',
  );
  assert(
    matchRuleCondition(model, { title: ['contains', 'world', { caseInsensitive: true }] }),
    'contains case-insensitive',
  );
  assert(
    matchRuleCondition(model, { title: ['startsWith', 'hello', { caseInsensitive: true }] }),
    'startsWith case-insensitive',
  );

  /* ------------------------------------------------------------------ */
  /*  3g. Nested condition objects                                        */
  /* ------------------------------------------------------------------ */
  sub('Nested condition objects');

  assert(matchRuleCondition(model, { nested: { value: ['gte', 5] } }), 'Nested object condition');
  assert(
    !matchRuleCondition(model, { nested: { value: ['eq', 100] } }),
    'Nested object condition negative',
  );

  /* ------------------------------------------------------------------ */
  /*  3h. Null/undefined model values                                     */
  /* ------------------------------------------------------------------ */
  sub('Edge cases: null/undefined model values');

  assert(
    !matchRuleCondition({ title: null }, { title: ['eq', 'anything'] }),
    'null model value returns false',
  );
  assert(
    !matchRuleCondition({ title: undefined }, { title: ['eq', 'anything'] }),
    'undefined model value returns false',
  );

  /* ------------------------------------------------------------------ */
  /*  3i. KNOWN_OPERATORS export                                          */
  /* ------------------------------------------------------------------ */
  sub('KNOWN_OPERATORS set');

  const expected = [
    'eq',
    'in',
    'contains',
    'startsWith',
    'endsWith',
    'gt',
    'gte',
    'has',
    'hasSome',
    'hasEvery',
    'some',
    'every',
    'none',
  ] as const;

  for (const op of expected) {
    assert(KNOWN_OPERATORS.has(op), `KNOWN_OPERATORS includes '${op}'`);
  }
  assert(KNOWN_OPERATORS.size === expected.length, 'No unknown operators in set');

  /* ------------------------------------------------------------------ */
  /*  Summary                                                             */
  /* ------------------------------------------------------------------ */
  info('All condition operators verified.');
}
