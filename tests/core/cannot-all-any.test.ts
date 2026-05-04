import { describe, expect, it } from 'vitest';
import { createGuantr, Guantr, GuantrCircuitBreakerError } from '../../src/index';

describe('Guantr.cannot.all', () => {
  it('returns true when all checks are denied', async () => {
    const guantr = await createGuantr();
    await guantr.setRules([
      { effect: 'deny', action: 'delete', resource: 'post', condition: null },
      { effect: 'deny', action: 'update', resource: 'post', condition: null },
    ]);
    const post = { id: 1 };
    const result = await guantr.cannot.all([
      ['delete', ['post', post]],
      ['update', ['post', post]],
    ]);
    expect(result).toBe(true);
  });

  it('returns false when any single check is allowed', async () => {
    const guantr = await createGuantr();
    await guantr.setRules([
      { effect: 'allow', action: 'read', resource: 'post', condition: null },
      { effect: 'deny', action: 'delete', resource: 'post', condition: null },
    ]);
    const post = { id: 1 };
    const result = await guantr.cannot.all([
      ['read', ['post', post]],
      ['delete', ['post', post]],
    ]);
    // Read is allowed, so NOT all are denied
    expect(result).toBe(false);
  });

  it('short-circuits on first true (granted permission)', async () => {
    const guantr = await createGuantr();
    let deleteEvaluated = false;
    await guantr.setRules([
      { effect: 'allow', action: 'read', resource: 'post', condition: null },
      { effect: 'deny', action: 'delete', resource: 'post', condition: null },
    ]);
    const post = { id: 1 };
    const originalQueryRules = guantr['_storage'].queryRules.bind(guantr['_storage']);
    guantr['_storage'].queryRules = async (action: string, resource: string) => {
      if (action === 'delete') {
        deleteEvaluated = true;
      }
      return originalQueryRules(action, resource);
    };
    const result = await guantr.cannot.all([
      ['read', ['post', post]],
      ['delete', ['post', post]],
    ]);
    // Read is allowed, so cannot.all is false — and delete isn't evaluated
    expect(result).toBe(false);
    expect(deleteEvaluated).toBe(false);
  });

  it('returns true when no rules exist (implicitly denied)', async () => {
    const guantr = await createGuantr();
    const post = { id: 1 };
    const result = await guantr.cannot.all([
      ['read', ['post', post]],
      ['delete', ['post', post]],
    ]);
    // No rules → everything is implicitly denied
    expect(result).toBe(true);
  });

  it('handles empty checks array', async () => {
    const guantr = await createGuantr();
    // Vacuous truth: all zero checks are denied
    expect(await guantr.cannot.all([])).toBe(true);
  });

  it('works with context-dependent conditions', async () => {
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
        action: 'update',
        resource: 'post',
        condition: { authorId: ['eq', '$ctx.userId'] },
      },
    ]);
    const otherPost = { id: 2, authorId: 2 };
    const result = await guantr.cannot.all([['update', ['post', otherPost]]]);
    // update not allowed for otherPost → it is denied → all denied = true
    expect(result).toBe(true);
    expect(contextResolveCount).toBe(1);
  });

  it('throws circuit breaker when iteration limit exceeded', async () => {
    const guantr = new Guantr({ maxRuleIterations: 2 });
    await guantr.setRules([
      { effect: 'allow', action: 'read', resource: 'post', condition: null },
      { effect: 'allow', action: 'read', resource: 'post', condition: { id: ['eq', 1] } },
      { effect: 'allow', action: 'read', resource: 'post', condition: { id: ['eq', 2] } },
    ]);
    const post = { id: 999 };
    await expect(guantr.cannot.all([['read', ['post', post]]])).rejects.toThrow(
      GuantrCircuitBreakerError,
    );
  });
});

describe('Guantr.cannot.any', () => {
  it('returns true when at least one check is denied', async () => {
    const guantr = await createGuantr();
    await guantr.setRules([
      { effect: 'allow', action: 'read', resource: 'post', condition: null },
      { effect: 'deny', action: 'delete', resource: 'post', condition: null },
    ]);
    const post = { id: 1 };
    const result = await guantr.cannot.any([
      ['read', ['post', post]],
      ['delete', ['post', post]],
    ]);
    // Delete is denied, so cannot.any = true
    expect(result).toBe(true);
  });

  it('returns false when no check is denied (all allowed)', async () => {
    const guantr = await createGuantr();
    await guantr.setRules([
      { effect: 'allow', action: 'read', resource: 'post', condition: null },
      { effect: 'allow', action: 'delete', resource: 'post', condition: null },
    ]);
    const post = { id: 1 };
    const result = await guantr.cannot.any([
      ['read', ['post', post]],
      ['delete', ['post', post]],
    ]);
    expect(result).toBe(false);
  });

  it('short-circuits on first true (denied permission)', async () => {
    const guantr = await createGuantr();
    let deleteEvaluated = false;
    await guantr.setRules([
      { effect: 'deny', action: 'read', resource: 'post', condition: null },
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
    const result = await guantr.cannot.any([
      ['read', ['post', post]],
      ['delete', ['post', post]],
    ]);
    // Read is denied, so cannot.any is true — and delete isn't evaluated
    expect(result).toBe(true);
    expect(deleteEvaluated).toBe(false);
  });

  it('returns false when no rules exist (implicitly denied but ...)', async () => {
    // With no rules, everything is implicitly denied.
    // So "any check is denied" = true because all are denied.
    const guantr = await createGuantr();
    const post = { id: 1 };
    const result = await guantr.cannot.any([
      ['read', ['post', post]],
      ['delete', ['post', post]],
    ]);
    expect(result).toBe(true);
  });

  it('handles empty checks array', async () => {
    const guantr = await createGuantr();
    // Vacuous false: no check in an empty set is denied
    expect(await guantr.cannot.any([])).toBe(false);
  });

  it('works with context-dependent conditions', async () => {
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
        action: 'update',
        resource: 'post',
        condition: { authorId: ['eq', '$ctx.userId'] },
      },
    ]);
    const ownPost = { id: 1, authorId: 1 };
    const otherPost = { id: 2, authorId: 2 };
    const result = await guantr.cannot.any([
      ['update', ['post', ownPost]],
      ['update', ['post', otherPost]],
    ]);
    // ownPost is allowed, but otherPost is denied → any denied = true
    expect(result).toBe(true);
    expect(contextResolveCount).toBe(1);
  });

  it('throws circuit breaker when iteration limit exceeded', async () => {
    const guantr = new Guantr({ maxRuleIterations: 2 });
    await guantr.setRules([
      { effect: 'allow', action: 'read', resource: 'post', condition: null },
      { effect: 'allow', action: 'read', resource: 'post', condition: { id: ['eq', 1] } },
      { effect: 'allow', action: 'read', resource: 'post', condition: { id: ['eq', 2] } },
    ]);
    const post = { id: 999 };
    await expect(guantr.cannot.any([['read', ['post', post]]])).rejects.toThrow(
      GuantrCircuitBreakerError,
    );
  });
});
