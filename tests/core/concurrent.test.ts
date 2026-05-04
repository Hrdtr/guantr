import { describe, expect, it } from 'vitest';
import { Guantr } from '../../src/index';

describe('concurrent can() calls with async getContext', () => {
  it('5 concurrent can() calls with unconditional allow rule all return true', async () => {
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

  it('concurrent calls with condition using context each return correct result', async () => {
    const getContext = () =>
      new Promise<{ userId: number }>((resolve) => setTimeout(() => resolve({ userId: 42 }), 10));
    const guantr = new Guantr({ getContext });
    await guantr.setRules([
      {
        effect: 'allow',
        action: 'read',
        resource: 'post',
        condition: { authorId: ['eq', '$ctx.userId'] },
      },
    ]);
    const results = await Promise.all([
      guantr.can('read', ['post', { authorId: 42 }]),
      guantr.can('read', ['post', { authorId: 42 }]),
      guantr.can('read', ['post', { authorId: 42 }]),
      guantr.can('read', ['post', { authorId: 99 }]),
      guantr.can('read', ['post', { authorId: 99 }]),
      guantr.can('read', ['post', { authorId: 99 }]),
    ]);
    expect(results[0]).toBe(true);
    expect(results[1]).toBe(true);
    expect(results[2]).toBe(true);
    expect(results[3]).toBe(false);
    expect(results[4]).toBe(false);
    expect(results[5]).toBe(false);
  });

  it('concurrent calls with different resources return correct results', async () => {
    const getContext = () =>
      new Promise<Record<string, unknown>>((resolve) => setTimeout(() => resolve({}), 10));
    const guantr = new Guantr({ getContext });
    await guantr.setRules([
      { effect: 'allow', action: 'read', resource: 'post', condition: { published: ['eq', true] } },
      {
        effect: 'allow',
        action: 'read',
        resource: 'comment',
        condition: { approved: ['eq', true] },
      },
    ]);
    const results = await Promise.all([
      guantr.can('read', ['post', { published: true }]),
      guantr.can('read', ['post', { published: false }]),
      guantr.can('read', ['comment', { approved: true }]),
      guantr.can('read', ['comment', { approved: false }]),
    ]);
    expect(results[0]).toBe(true);
    expect(results[1]).toBe(false);
    expect(results[2]).toBe(true);
    expect(results[3]).toBe(false);
  });

  it('concurrent cannot() calls all return false when unconditional allow exists', async () => {
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
    expect(results).toEqual([false, false, false, false, false]);
  });
});
