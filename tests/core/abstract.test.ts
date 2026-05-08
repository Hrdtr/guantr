import { describe, expect, it } from 'vitest';
import { createGuantr, Guantr } from '../../src/index';

describe('can.abstract / cannot.abstract', () => {
  it('can.abstract should return true if any allow rule exists (ignores deny rules)', async () => {
    const guantr = await createGuantr();
    await guantr.setRules([
      { effect: 'allow', action: 'read', resource: 'post' },
      { effect: 'deny', action: 'read', resource: 'post' },
    ]);
    expect(await guantr.can.abstract('read', 'post')).toBe(true);
  });

  it('can.abstract should return false when no allow rule exists', async () => {
    const guantr = await createGuantr();
    await guantr.setRules([{ effect: 'deny', action: 'read', resource: 'post' }]);
    expect(await guantr.can.abstract('read', 'post')).toBe(false);
  });

  it('can.abstract should return false when no rules exist at all', async () => {
    const guantr = await createGuantr();
    expect(await guantr.can.abstract('read', 'post')).toBe(false);
  });

  it('can.abstract should be resource-key scoped (does not bleed across resources)', async () => {
    const guantr = await createGuantr();
    await guantr.setRules([{ effect: 'allow', action: 'read', resource: 'post' }]);
    expect(await guantr.can.abstract('read', 'post')).toBe(true);
    expect(await guantr.can.abstract('read', 'user')).toBe(false);
  });

  it('cannot.abstract returns true when no allow rule exists', async () => {
    const guantr = new Guantr();
    expect(await guantr.cannot.abstract('read', 'post')).toBe(true);
  });

  it('cannot.abstract returns false when an allow rule exists', async () => {
    const guantr = new Guantr();
    await guantr.setRules([{ effect: 'allow', action: 'read', resource: 'post' }]);
    expect(await guantr.cannot.abstract('read', 'post')).toBe(false);
  });

  it('cannot.abstract ignores deny rules', async () => {
    const guantr = new Guantr();
    await guantr.setRules([
      { effect: 'allow', action: 'read', resource: 'post' },
      { effect: 'deny', action: 'read', resource: 'post' },
    ]);
    expect(await guantr.cannot.abstract('read', 'post')).toBe(false);
  });

  it('cannot.abstract is the logical negation of can.abstract', async () => {
    const guantr = new Guantr();
    const canAbstractNoRule = await guantr.can.abstract('read', 'post');
    const cannotAbstractNoRule = await guantr.cannot.abstract('read', 'post');
    expect(canAbstractNoRule).toBe(!cannotAbstractNoRule);

    const guantr2 = new Guantr();
    await guantr2.setRules([{ effect: 'allow', action: 'read', resource: 'post' }]);
    const canAbstractWithRule = await guantr2.can.abstract('read', 'post');
    const cannotAbstractWithRule = await guantr2.cannot.abstract('read', 'post');
    expect(canAbstractWithRule).toBe(!cannotAbstractWithRule);
  });
});
