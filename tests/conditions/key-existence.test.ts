import { describe, expect, it } from 'vitest';
import { Guantr, GuantrInvalidConditionKeyError, matchRuleCondition } from '../../src/index';
import { InMemoryStorage } from '../../src/storage';

describe('Key-existence validation', () => {
  // -------------------------------------------------------------------------
  // matchRuleCondition — key-existence check
  // -------------------------------------------------------------------------
  it('throws GuantrInvalidConditionKeyError for a key that does not exist on the model', () => {
    expect(() =>
      matchRuleCondition({ title: 'hello', published: true }, { titel: ['eq', 'hello'] }),
    ).toThrow(GuantrInvalidConditionKeyError);
  });

  it('includes the missing key in the error', () => {
    let caught: unknown;
    try {
      matchRuleCondition({ title: 'hello' }, { titel: ['eq', 'hello'] });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(GuantrInvalidConditionKeyError);
    expect((caught as GuantrInvalidConditionKeyError).key).toBe('titel');
  });

  it('throws for a non-existent key in a nested condition', () => {
    expect(() =>
      matchRuleCondition({ address: { city: 'NYC' } }, { address: { citie: ['eq', 'NYC'] } }),
    ).toThrow(GuantrInvalidConditionKeyError);
  });

  it('does NOT throw when the key exists', () => {
    expect(
      matchRuleCondition({ title: 'hello', published: true }, { title: ['eq', 'hello'] }),
    ).toBe(true);
  });

  it('opts out when operand is undefined (explicit nullish check)', () => {
    const result = matchRuleCondition({ title: 'hello' }, { optionalField: ['eq', undefined] });
    // No throw — nullish check skipped key existence; undefined !== undefined is false
    // Actually, model[optionalField] is undefined, operand is undefined → eq(undefined, undefined) → true
    expect(result).toBe(true);
  });

  it('opts out when operand is null (explicit nullish check)', () => {
    const result = matchRuleCondition({ title: 'hello' }, { optionalField: ['eq', null] });
    // No throw — nullish check skipped key existence; undefined !== null → false
    expect(result).toBe(false);
  });

  it('does NOT opt out for non-nullish operands on missing keys', () => {
    expect(() => matchRuleCondition({ title: 'hello' }, { missingField: ['eq', 'value'] })).toThrow(
      GuantrInvalidConditionKeyError,
    );
  });

  it('does NOT opt out for nested conditions on missing keys', () => {
    expect(() =>
      matchRuleCondition({ title: 'hello' }, { missingField: { subKey: ['eq', 'value'] } }),
    ).toThrow(GuantrInvalidConditionKeyError);
  });

  it('does NOT throw for keys that exist with value undefined', () => {
    expect(
      matchRuleCondition(
        { title: 'hello', optionalField: undefined },
        { optionalField: ['eq', undefined] },
      ),
    ).toBe(true);
  });

  it('works with the in operator on a missing key', () => {
    // in operator accepts nullish operands? No — only eq does
    expect(() => matchRuleCondition({ title: 'hello' }, { tags: ['in', ['a', 'b']] })).toThrow(
      GuantrInvalidConditionKeyError,
    );
  });

  // -------------------------------------------------------------------------
  // Guantr.can — key-existence check at evaluation time
  // -------------------------------------------------------------------------
  it('throws GuantrInvalidConditionKeyError when rule condition references a missing key', async () => {
    const storage = new InMemoryStorage();
    await storage.setRules([
      { effect: 'allow', action: 'read', resource: 'post', condition: { titel: ['eq', 'hello'] } },
    ]);
    const guantr = new Guantr({ storage });
    const post = { id: 1, title: 'hello', published: true, tags: [], comments: [] };
    await expect(guantr.can('read', ['post', post])).rejects.toThrow(
      GuantrInvalidConditionKeyError,
    );
  });

  it('does NOT throw when key exists on the resource', async () => {
    const storage = new InMemoryStorage();
    await storage.setRules([
      { effect: 'allow', action: 'read', resource: 'post', condition: { title: ['eq', 'hello'] } },
    ]);
    const guantr = new Guantr({ storage });
    const post = { id: 1, title: 'hello', published: true, tags: [], comments: [] };
    expect(await guantr.can('read', ['post', post])).toBe(true);
  });

  it('opts out with undefined operand on a sparse resource', async () => {
    const storage = new InMemoryStorage();
    await storage.setRules([
      {
        effect: 'allow',
        action: 'read',
        resource: 'post',
        condition: { optionalField: ['eq', undefined] },
      },
    ]);
    const guantr = new Guantr({ storage });
    const post = { id: 1, title: 'hello', published: true, tags: [], comments: [] };
    // No throw because nullish check skips key existence
    expect(await guantr.can('read', ['post', post])).toBe(true);
  });

  it('throws for missing key inside a some/none/every operator', async () => {
    const storage = new InMemoryStorage();
    await storage.setRules([
      {
        effect: 'allow',
        action: 'read',
        resource: 'post',
        condition: { comments: ['some', { author: ['eq', 1] }] },
      },
    ]);
    const guantr = new Guantr({ storage });
    const post = {
      id: 1,
      title: 'hello',
      published: true,
      tags: [],
      comments: [{ authorId: 1, body: 'Great!' }],
    };
    await expect(guantr.can('read', ['post', post])).rejects.toThrow(
      GuantrInvalidConditionKeyError,
    );
  });
});
