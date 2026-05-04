/**
 * Demo 10: Key-Existence Validation (New in v2.0)
 * ================================================
 *
 * Demonstrates the new key-existence check that throws
 * `GuantrInvalidConditionKeyError` when a condition references a key
 * that doesn't exist on the resource instance.
 *
 * Also shows the opt-out pattern using nullish operands for sparse objects.
 */

import { Guantr, GuantrInvalidConditionKeyError, matchRuleCondition } from '../../src/index';
import { InMemoryStorage } from '../../src/storage';
import { heading, sub, assert, info, pass, fail } from '../utils';

export async function demoKeyCheck(): Promise<void> {
  heading('10. Key-Existence Validation (New in v2.0)');

  /* ------------------------------------------------------------------ */
  /*  10a. Typo in condition key — throws instead of silent false         */
  /* ------------------------------------------------------------------ */
  sub('Typo detection');

  info('A typo like "titel" instead of "title" now throws immediately.');

  const model = { title: 'Hello World', published: true };

  // ❌ This throws GuantrInvalidConditionKeyError
  try {
    matchRuleCondition(model, { titel: ['eq', 'Hello World'] });
    fail('Should have thrown GuantrInvalidConditionKeyError');
  } catch (e) {
    if (e instanceof GuantrInvalidConditionKeyError) {
      pass(`Typo caught! Key "${e.key}" does not exist on the resource.`);
      assert(e.key === 'titel', 'Error contains the missing key name');
    } else {
      throw e;
    }
  }

  // ✅ Correct key works fine
  const result = matchRuleCondition(model, { title: ['eq', 'Hello World'] });
  assert(result === true, 'Correct key evaluates normally');

  /* ------------------------------------------------------------------ */
  /*  10b. Sparse object opt-out                                          */
  /* ------------------------------------------------------------------ */
  sub('Opt-out for sparse objects');

  info(
    'Use an explicit nullish operand (null or undefined) to signal\n' +
      '  that a key may be intentionally absent.',
  );

  // No 'optionalTag' on model — but operand is undefined, so no throw
  const sparseResult = matchRuleCondition(
    { title: 'Hello' }, // no optionalTag
    { optionalTag: ['eq', undefined] },
  );
  assert(sparseResult === true, 'Opt-out: undefined operand → key-existence check skipped');

  // Also works with null operand
  const sparseResultNull = matchRuleCondition(
    { title: 'Hello' }, // no optionalTag
    { optionalTag: ['eq', null] },
  );
  // undefined !== null → false
  assert(sparseResultNull === false, 'Opt-out with null: undefined !== null → false');

  /* ------------------------------------------------------------------ */
  /*  10c. Nested condition key check                                     */
  /* ------------------------------------------------------------------ */
  sub('Nested condition key check');

  const nestedModel = { address: { city: 'NYC', zip: '10001' } };

  // ✅ Correct nested keys
  const nestedOk = matchRuleCondition(nestedModel, {
    address: { city: ['eq', 'NYC'] },
  });
  assert(nestedOk === true, 'Correct nested keys evaluate normally');

  // ❌ Typo in nested key
  try {
    matchRuleCondition(nestedModel, { address: { citie: ['eq', 'NYC'] } });
    fail('Should have thrown GuantrInvalidConditionKeyError for nested key typo');
  } catch (e) {
    if (e instanceof GuantrInvalidConditionKeyError) {
      pass(`Nested typo caught! Key "${e.key}" does not exist.`);
      assert(e.key === 'citie', 'Error contains the nested missing key name');
    } else {
      throw e;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  10d. Array operators (some/every/none)                              */
  /* ------------------------------------------------------------------ */
  sub('Array operators (some/every/none)');

  const comments = [
    { authorId: 1, body: 'Great!' },
    { authorId: 2, body: 'Thanks!' },
  ];

  // ✅ Correct key
  const someOk = matchRuleCondition({ comments }, { comments: ['some', { authorId: ['eq', 1] }] });
  assert(someOk === true, 'Correct key inside some operator works');

  // ❌ Typo inside some operator
  try {
    matchRuleCondition({ comments }, { comments: ['some', { author: ['eq', 1] }] });
    fail('Should have thrown GuantrInvalidConditionKeyError for typo in some operator');
  } catch (e) {
    if (e instanceof GuantrInvalidConditionKeyError) {
      pass(`Array operator typo caught! Key "${e.key}" does not exist on array items.`);
      assert(e.key === 'author', 'Error contains the missing key inside some operand');
    } else {
      throw e;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  10e. End-to-end with Guantr.can                                    */
  /* ------------------------------------------------------------------ */
  sub('End-to-end with Guantr.can');

  info('Key-existence check works end-to-end with the full Guantr pipeline.');

  const storage = new InMemoryStorage();
  await storage.setRules([
    {
      effect: 'allow',
      action: 'read',
      resource: 'post',
      condition: { published: ['eq', true] },
    },
    {
      effect: 'deny',
      action: 'delete',
      resource: 'post',
      condition: { archvied: ['eq', true] }, // typo in deny rule!
    },
  ]);

  const guantr = new Guantr({ storage });
  const post = { title: 'Hello', published: true };

  // Allow rule with correct key works
  const canRead = await guantr.can('read', ['post', post]);
  assert(canRead === true, 'Allow rule with correct key works');

  // Deny rule with typo'd key throws — preventing a silent security hole
  try {
    await guantr.can('delete', ['post', post]);
    fail('Should have thrown — typo in deny rule');
  } catch (e) {
    if (e instanceof GuantrInvalidConditionKeyError) {
      pass('Deny rule typo caught at evaluation time — preventing silent security hole!');
      assert(e.key === 'archvied', 'Error identifies the exact typo');
    } else {
      throw e;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Summary                                                             */
  /* ------------------------------------------------------------------ */
  info('Key-existence validation complete. Typos no longer cause silent failures.');
}
