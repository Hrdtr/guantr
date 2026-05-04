import { describe, expect, it } from 'vitest';
import { createGuantr, Guantr, GuantrCircuitBreakerError } from '../../src/index';

describe('Guantr.can.all', () => {
  it('returns true when all checks pass', async () => {
    const guantr = await createGuantr();
    await guantr.setRules([
      { effect: 'allow', action: 'read', resource: 'post', condition: null },
      { effect: 'allow', action: 'update', resource: 'post', condition: null },
      { effect: 'allow', action: 'delete', resource: 'post', condition: null },
    ]);
    const post = { id: 1, title: 'Test' };
    const result = await guantr.can.all([
      ['read', ['post', post]],
      ['update', ['post', post]],
      ['delete', ['post', post]],
    ]);
    expect(result).toBe(true);
  });

  it('returns false when any single check fails', async () => {
    const guantr = await createGuantr();
    await guantr.setRules([
      { effect: 'allow', action: 'read', resource: 'post', condition: null },
      { effect: 'deny', action: 'delete', resource: 'post', condition: null },
    ]);
    const post = { id: 1, title: 'Test' };
    const result = await guantr.can.all([
      ['read', ['post', post]],
      ['delete', ['post', post]],
    ]);
    expect(result).toBe(false);
  });

  it('short-circuits on first false and does not evaluate remaining checks', async () => {
    const guantr = await createGuantr();
    let deleteEvaluated = false;
    await guantr.setRules([
      { effect: 'deny', action: 'read', resource: 'post', condition: null },
      {
        effect: 'allow',
        action: 'delete',
        resource: 'post',
        condition: { id: ['eq', 999] },
      },
    ]);
    const post = { id: 1, title: 'Test' };
    // Monkey-patch queryRules to track calls
    const originalQueryRules = guantr['_storage'].queryRules.bind(guantr['_storage']);
    guantr['_storage'].queryRules = async (action: string, resource: string) => {
      if (action === 'delete') {
        deleteEvaluated = true;
      }
      return originalQueryRules(action, resource);
    };
    const result = await guantr.can.all([
      ['read', ['post', post]],
      ['delete', ['post', post]],
    ]);
    expect(result).toBe(false);
    expect(deleteEvaluated).toBe(false);
  });

  it('returns false when no rules exist for any check', async () => {
    const guantr = await createGuantr();
    await guantr.setRules([{ effect: 'allow', action: 'read', resource: 'post', condition: null }]);
    const post = { id: 1 };
    const result = await guantr.can.all([
      ['read', ['post', post]],
      ['update', ['post', post]],
    ]);
    expect(result).toBe(false);
  });

  it('handles overlapping allow/deny rules correctly', async () => {
    const guantr = await createGuantr();
    await guantr.setRules([
      { effect: 'allow', action: 'read', resource: 'post', condition: null },
      { effect: 'deny', action: 'read', resource: 'post', condition: { published: ['eq', true] } },
      { effect: 'allow', action: 'delete', resource: 'post', condition: { authorId: ['eq', 1] } },
    ]);
    const draftPost = { id: 1, title: 'Draft', published: false, authorId: 1 };
    // Read passes (no deny), delete passes (author matches)
    expect(
      await guantr.can.all([
        ['read', ['post', draftPost]],
        ['delete', ['post', draftPost]],
      ]),
    ).toBe(true);

    const publishedPost = { id: 2, title: 'Published', published: true, authorId: 1 };
    // Read denied (published), so all should fail
    expect(
      await guantr.can.all([
        ['read', ['post', publishedPost]],
        ['delete', ['post', publishedPost]],
      ]),
    ).toBe(false);
  });

  it('works with context-dependent conditions (context resolved once)', async () => {
    let contextResolveCount = 0;
    const guantr = await createGuantr({
      getContext: () => {
        contextResolveCount++;
        return { userId: 1 };
      },
    });
    await guantr.setRules([
      {
        effect: 'allow',
        action: 'read',
        resource: 'post',
        condition: { authorId: ['eq', '$ctx.userId'] },
      },
      {
        effect: 'allow',
        action: 'update',
        resource: 'post',
        condition: { authorId: ['eq', '$ctx.userId'] },
      },
    ]);
    const post = { id: 1, title: 'Test', authorId: 1 };
    const result = await guantr.can.all([
      ['read', ['post', post]],
      ['update', ['post', post]],
    ]);
    expect(result).toBe(true);
    // Context should be resolved only once for the batch
    expect(contextResolveCount).toBe(1);
  });

  it('handles empty checks array', async () => {
    const guantr = await createGuantr();
    // Vacuous truth: all zero checks pass
    expect(await guantr.can.all([])).toBe(true);
  });

  it('throws circuit breaker when iteration limit exceeded in one check', async () => {
    const guantr = new Guantr({ maxRuleIterations: 2 });
    await guantr.setRules([
      { effect: 'allow', action: 'read', resource: 'post', condition: null },
      { effect: 'allow', action: 'read', resource: 'post', condition: { id: ['eq', 1] } },
      { effect: 'allow', action: 'read', resource: 'post', condition: { id: ['eq', 2] } },
    ]);
    const post = { id: 999 };
    await expect(guantr.can.all([['read', ['post', post]]])).rejects.toThrow(
      GuantrCircuitBreakerError,
    );
  });
});

describe('Guantr.can.any', () => {
  it('returns true when at least one check passes', async () => {
    const guantr = await createGuantr();
    await guantr.setRules([{ effect: 'allow', action: 'read', resource: 'post', condition: null }]);
    const post = { id: 1, title: 'Test' };
    const result = await guantr.can.any([
      ['read', ['post', post]],
      ['delete', ['post', post]],
    ]);
    expect(result).toBe(true);
  });

  it('returns false when no check passes', async () => {
    const guantr = await createGuantr();
    await guantr.setRules([
      { effect: 'allow', action: 'read', resource: 'post', condition: { published: ['eq', true] } },
    ]);
    const unpublishedPost = { id: 1, title: 'Draft', published: false };
    const result = await guantr.can.any([
      ['read', ['post', unpublishedPost]],
      ['delete', ['post', unpublishedPost]],
    ]);
    expect(result).toBe(false);
  });

  it('short-circuits on first true and does not evaluate remaining checks', async () => {
    const guantr = await createGuantr();
    let deleteEvaluated = false;
    await guantr.setRules([
      { effect: 'allow', action: 'read', resource: 'post', condition: null },
      { effect: 'allow', action: 'delete', resource: 'post', condition: null },
    ]);
    const post = { id: 1 };
    const originalQueryRules = guantr['_storage'].queryRules.bind(guantr['_storage']);
    guantr['_storage'].queryRules = async (action: string, resource: string) => {
      if (action === 'delete') {
        deleteEvaluated = true;
      }
      return originalQueryRules(action, resource);
    };
    const result = await guantr.can.any([
      ['read', ['post', post]],
      ['delete', ['post', post]],
    ]);
    expect(result).toBe(true);
    expect(deleteEvaluated).toBe(false);
  });

  it('returns false when no rules exist for any check', async () => {
    const guantr = await createGuantr();
    const post = { id: 1 };
    const result = await guantr.can.any([
      ['read', ['post', post]],
      ['update', ['post', post]],
    ]);
    expect(result).toBe(false);
  });

  it('works with overlapping allow/deny rules', async () => {
    const guantr = await createGuantr();
    await guantr.setRules([
      { effect: 'allow', action: 'read', resource: 'post', condition: { authorId: ['eq', 1] } },
      { effect: 'deny', action: 'read', resource: 'post', condition: { published: ['eq', true] } },
    ]);
    // Deny rule for published posts overrides allow rule for authorId=1
    const post = { id: 1, title: 'Published', published: true, authorId: 1 };
    // published=true triggers the deny, so read is denied
    expect(await guantr.can.any([['read', ['post', post]]])).toBe(false);

    const draftPost = { id: 2, title: 'Draft', published: false, authorId: 1 };
    // published=false doesn't trigger deny, allow rule applies
    expect(await guantr.can.any([['read', ['post', draftPost]]])).toBe(true);
  });

  it('works with context-dependent conditions (context resolved once)', async () => {
    let contextResolveCount = 0;
    const guantr = await createGuantr({
      getContext: () => {
        contextResolveCount++;
        return { userId: 1 };
      },
    });
    await guantr.setRules([
      {
        effect: 'allow',
        action: 'delete',
        resource: 'post',
        condition: { authorId: ['eq', '$ctx.userId'] },
      },
    ]);
    const ownPost = { id: 1, title: 'Mine', authorId: 1 };
    const otherPost = { id: 2, title: 'Theirs', authorId: 2 };
    const result = await guantr.can.any([
      ['delete', ['post', ownPost]],
      ['delete', ['post', otherPost]],
    ]);
    expect(result).toBe(true);
    expect(contextResolveCount).toBe(1);
  });

  it('handles empty checks array', async () => {
    const guantr = await createGuantr();
    // Vacuous false: no check in an empty set passes
    expect(await guantr.can.any([])).toBe(false);
  });

  it('throws circuit breaker when iteration limit exceeded in one check', async () => {
    const guantr = new Guantr({ maxRuleIterations: 2 });
    await guantr.setRules([
      { effect: 'allow', action: 'read', resource: 'post', condition: null },
      { effect: 'allow', action: 'read', resource: 'post', condition: { id: ['eq', 1] } },
      { effect: 'allow', action: 'read', resource: 'post', condition: { id: ['eq', 2] } },
    ]);
    const post = { id: 999 };
    await expect(guantr.can.any([['read', ['post', post]]])).rejects.toThrow(
      GuantrCircuitBreakerError,
    );
  });
});

describe('Guantr.can.all + can.any with mixed resource types', () => {
  it('can.all works with different resource keys', async () => {
    const guantr = await createGuantr();
    await guantr.setRules([
      { effect: 'allow', action: 'read', resource: 'post', condition: null },
      { effect: 'allow', action: 'read', resource: 'user', condition: null },
    ]);
    const post = { id: 1 };
    const user = { id: 1, name: 'Alice' };
    expect(
      await guantr.can.all([
        ['read', ['post', post]],
        ['read', ['user', user]],
      ]),
    ).toBe(true);
  });

  it('can.any works with different resource keys', async () => {
    const guantr = await createGuantr();
    await guantr.setRules([{ effect: 'allow', action: 'read', resource: 'post', condition: null }]);
    const post = { id: 1 };
    const user = { id: 1, name: 'Alice' };
    expect(
      await guantr.can.any([
        ['read', ['post', post]],
        ['read', ['user', user]],
      ]),
    ).toBe(true);
  });
});
