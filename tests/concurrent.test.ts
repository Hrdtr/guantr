import { describe, expect, it } from 'vitest';
import { Guantr } from '../src/index';

describe('concurrent can() calls with async getContext', () => {
  it('basic concurrency: 5 concurrent can() calls with unconditional allow rule all return true', async () => {
    const getContext = () =>
      new Promise<Record<string, unknown>>((resolve) => setTimeout(() => resolve({}), 10));

    const guantr = new Guantr({ getContext });
    await guantr.setRules([{ effect: 'allow', action: 'read', resource: 'post', condition: null }]);

    const post = { id: 1, title: 'Hello World' };
    const results = await Promise.all([
      guantr.can('read', ['post', post]),
      guantr.can('read', ['post', post]),
      guantr.can('read', ['post', post]),
      guantr.can('read', ['post', post]),
      guantr.can('read', ['post', post]),
    ]);

    expect(results).toEqual([true, true, true, true, true]);
  });

  it('concurrent calls with condition that uses context: each call returns the correct result', async () => {
    const getContext = () =>
      new Promise<{ userId: number }>((resolve) => setTimeout(() => resolve({ userId: 42 }), 10));

    const guantr = new Guantr({ getContext });
    await guantr.setRules([
      {
        effect: 'allow',
        action: 'read',
        resource: 'post',
        condition: { authorId: ['eq', '$ctx.userId'] } as any,
      },
    ]);

    const matchingPost = { authorId: 42 };
    const nonMatchingPost = { authorId: 99 };

    // Fire 3 matching + 3 non-matching calls concurrently.
    const results = await Promise.all([
      guantr.can('read', ['post', matchingPost]),
      guantr.can('read', ['post', matchingPost]),
      guantr.can('read', ['post', matchingPost]),
      guantr.can('read', ['post', nonMatchingPost]),
      guantr.can('read', ['post', nonMatchingPost]),
      guantr.can('read', ['post', nonMatchingPost]),
    ]);

    // First 3 should allow (authorId 42 matches context userId 42).
    expect(results[0]).toBe(true);
    expect(results[1]).toBe(true);
    expect(results[2]).toBe(true);
    // Last 3 should deny (authorId 99 does not match context userId 42).
    expect(results[3]).toBe(false);
    expect(results[4]).toBe(false);
    expect(results[5]).toBe(false);
  });

  it('concurrent calls with different resources: each returns the correct result for its resource', async () => {
    const getContext = () =>
      new Promise<Record<string, unknown>>((resolve) => setTimeout(() => resolve({}), 10));

    const guantr = new Guantr({ getContext });
    await guantr.setRules([
      {
        effect: 'allow',
        action: 'read',
        resource: 'post',
        condition: { published: ['eq', true] } as any,
      },
      {
        effect: 'allow',
        action: 'read',
        resource: 'comment',
        condition: { approved: ['eq', true] } as any,
      },
    ]);

    const results = await Promise.all([
      guantr.can('read', ['post', { published: true }]),
      guantr.can('read', ['post', { published: false }]),
      guantr.can('read', ['comment', { approved: true }]),
      guantr.can('read', ['comment', { approved: false }]),
    ]);

    expect(results[0]).toBe(true); // published post → allowed
    expect(results[1]).toBe(false); // unpublished post → denied
    expect(results[2]).toBe(true); // approved comment → allowed
    expect(results[3]).toBe(false); // unapproved comment → denied
  });

  it('getContext call count: all results are correct regardless of how many times getContext fires', async () => {
    let callCount = 0;
    const getContext = () =>
      new Promise<{ userId: number }>((resolve) => {
        callCount++;
        setTimeout(() => resolve({ userId: 1 }), 10);
      });

    const guantr = new Guantr({ getContext });
    await guantr.setRules([
      {
        effect: 'allow',
        action: 'read',
        resource: 'post',
        condition: { authorId: ['eq', '$ctx.userId'] } as any,
      },
    ]);

    // All three posts have authorId: 1, matching context.userId.
    const results = await Promise.all([
      guantr.can('read', ['post', { authorId: 1 }]),
      guantr.can('read', ['post', { authorId: 1 }]),
      guantr.can('read', ['post', { authorId: 1 }]),
    ]);

    expect(results).toEqual([true, true, true]);
    // Caching behavior is an implementation detail — only assert that getContext
    // was called at least once (i.e., the mechanism worked at all).
    expect(callCount).toBeGreaterThanOrEqual(1);
  });

  it('concurrent cannot() calls: all return false when an unconditional allow rule exists', async () => {
    const getContext = () =>
      new Promise<Record<string, unknown>>((resolve) => setTimeout(() => resolve({}), 10));

    const guantr = new Guantr({ getContext });
    await guantr.setRules([{ effect: 'allow', action: 'read', resource: 'post', condition: null }]);

    const post = { id: 1, title: 'Hello World' };
    const results = await Promise.all([
      guantr.cannot('read', ['post', post]),
      guantr.cannot('read', ['post', post]),
      guantr.cannot('read', ['post', post]),
      guantr.cannot('read', ['post', post]),
      guantr.cannot('read', ['post', post]),
    ]);

    // cannot() is the logical negation of can() — allow rule exists, so cannot is false.
    expect(results).toEqual([false, false, false, false, false]);
  });
});
