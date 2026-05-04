import { describe, expect, it } from 'vitest';
import { Guantr, GuantrCircuitBreakerError } from '../../src/index';

describe('Guantr.cannot', () => {
  it('returns true when no rules exist', async () => {
    const guantr = new Guantr();
    expect(await guantr.cannot('read', ['post', { id: 1 }])).toBe(true);
  });

  it('returns false when unconditional allow rule matches', async () => {
    const guantr = new Guantr();
    await guantr.setRules([{ effect: 'allow', action: 'read', resource: 'post', condition: null }]);
    expect(await guantr.cannot('read', ['post', { id: 1 }])).toBe(false);
  });

  it('returns true when only unconditional deny rule exists', async () => {
    const guantr = new Guantr();
    await guantr.setRules([{ effect: 'deny', action: 'read', resource: 'post', condition: null }]);
    expect(await guantr.cannot('read', ['post', { id: 1 }])).toBe(true);
  });

  it('returns true when a conditional deny overrides an allow', async () => {
    const guantr = new Guantr();
    await guantr.setRules([
      { effect: 'allow', action: 'read', resource: 'post', condition: null },
      { effect: 'deny', action: 'read', resource: 'post', condition: { published: ['eq', true] } },
    ]);
    expect(await guantr.cannot('read', ['post', { published: true }])).toBe(true);
    expect(await guantr.cannot('read', ['post', { published: false }])).toBe(false);
  });

  it('conditional cannot — only matching allow rule', async () => {
    const guantr = new Guantr();
    await guantr.setRules([
      { effect: 'allow', action: 'read', resource: 'post', condition: { published: ['eq', true] } },
    ]);
    expect(await guantr.cannot('read', ['post', { published: true }])).toBe(false);
    expect(await guantr.cannot('read', ['post', { published: false }])).toBe(true);
  });

  it('is the logical negation of can()', async () => {
    const guantr = new Guantr();
    await guantr.setRules([
      { effect: 'allow', action: 'read', resource: 'post', condition: { id: ['eq', 1] } },
    ]);

    const canId1 = await guantr.can('read', ['post', { id: 1 }]);
    const cannotId1 = await guantr.cannot('read', ['post', { id: 1 }]);
    expect(canId1).toBe(!cannotId1);

    const canId2 = await guantr.can('read', ['post', { id: 2 }]);
    const cannotId2 = await guantr.cannot('read', ['post', { id: 2 }]);
    expect(canId2).toBe(!cannotId2);
  });

  it('works with context-dependent conditions', async () => {
    const guantr = new Guantr({ getContext: () => ({ userId: 5 }) });
    await guantr.setRules([
      {
        effect: 'allow',
        action: 'update',
        resource: 'post',
        condition: { authorId: ['eq', '$ctx.userId'] },
      },
    ]);
    expect(await guantr.cannot('update', ['post', { authorId: 5 }])).toBe(false);
    expect(await guantr.cannot('update', ['post', { authorId: 6 }])).toBe(true);
  });

  it('throws GuantrCircuitBreakerError when limit exceeded', async () => {
    const guantr = new Guantr({ maxRuleIterations: 1 });
    await guantr.setRules([
      { effect: 'allow', action: 'read', resource: 'post', condition: null },
      { effect: 'allow', action: 'read', resource: 'post', condition: { title: ['eq', 'Test'] } },
    ]);
    await expect(guantr.cannot('read', ['post', { id: 1 }])).rejects.toThrow(
      GuantrCircuitBreakerError,
    );
  });

  it('works with setRules callback form', async () => {
    const guantr = new Guantr();
    await guantr.setRules((allow, deny) => {
      allow('read', 'post');
      deny('delete', 'post');
    });
    expect(await guantr.cannot('read', ['post', { id: 1 }])).toBe(false);
    expect(await guantr.cannot.abstract('delete', 'post')).toBe(true);
  });

  it('works with the async setRules callback', async () => {
    const guantr = new Guantr();
    await guantr.setRules(async (allow) => {
      await new Promise((r) => setTimeout(r, 0));
      allow('read', ['post', { published: ['eq', true] }]);
    });
    expect(await guantr.cannot('read', ['post', { published: true }])).toBe(false);
    expect(await guantr.cannot('read', ['post', { published: false }])).toBe(true);
  });
});
