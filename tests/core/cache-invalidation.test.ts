import { describe, expect, it } from 'vitest';
import { Guantr, createGuantr } from '../../src/index';
import { InMemoryStorage } from '../../src/storage';

describe('cache invalidation after setRules', () => {
  it('can() result updates after setRules', async () => {
    const guantr = new Guantr();
    await guantr.setRules([{ effect: 'allow', action: 'read', resource: 'post', condition: null }]);
    expect(await guantr.can('read', ['post', { id: 1 }])).toBe(true);
    await guantr.setRules([]);
    expect(await guantr.can('read', ['post', { id: 1 }])).toBe(false);
  });

  it('getRules() result updates after setRules', async () => {
    const guantr = new Guantr();
    await guantr.setRules([{ effect: 'allow', action: 'read', resource: 'post', condition: null }]);
    const rules = await guantr.getRules();
    expect(rules).toHaveLength(1);
    await guantr.setRules([]);
    const newRules = await guantr.getRules();
    expect(newRules).toHaveLength(0);
  });

  it('can.abstract() result updates after setRules', async () => {
    const guantr = new Guantr();
    await guantr.setRules([{ effect: 'allow', action: 'read', resource: 'post', condition: null }]);
    expect(await guantr.can.abstract('read', 'post')).toBe(true);
    await guantr.setRules([]);
    expect(await guantr.can.abstract('read', 'post')).toBe(false);
  });

  it('multiple setRules cycles invalidate correctly', async () => {
    const guantr = new Guantr();
    await guantr.setRules([
      { effect: 'allow', action: 'read', resource: 'post', condition: { id: ['eq', 1] } },
    ]);
    expect(await guantr.can('read', ['post', { id: 1 }])).toBe(true);
    await guantr.setRules([
      { effect: 'allow', action: 'read', resource: 'post', condition: { id: ['eq', 2] } },
    ]);
    expect(await guantr.can('read', ['post', { id: 1 }])).toBe(false);
    expect(await guantr.can('read', ['post', { id: 2 }])).toBe(true);
    await guantr.setRules([
      { effect: 'allow', action: 'read', resource: 'post', condition: { id: ['eq', 1] } },
    ]);
    expect(await guantr.can('read', ['post', { id: 1 }])).toBe(true);
  });

  it('cache.clear() is called on every setRules call', async () => {
    class TrackingStorage extends InMemoryStorage {
      clearCallCount = 0;
      constructor() {
        super();
        const originalClear = this.cache!.clear.bind(this.cache);
        this.cache!.clear = async () => {
          this.clearCallCount++;
          return originalClear();
        };
      }
    }
    const storage = new TrackingStorage();
    const guantr = new Guantr({ storage });
    await guantr.setRules([]);
    await guantr.setRules([]);
    expect(storage.clearCallCount).toBeGreaterThanOrEqual(2);
  });

  it('deny rule takes effect after setRules (previously cached allow result is gone)', async () => {
    const guantr = new Guantr();
    await guantr.setRules([{ effect: 'allow', action: 'read', resource: 'post', condition: null }]);
    expect(await guantr.can('read', ['post', { published: true }])).toBe(true);
    await guantr.setRules([{ effect: 'deny', action: 'read', resource: 'post', condition: null }]);
    expect(await guantr.can('read', ['post', { published: true }])).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Cache adapter error handling — tests that the try/catch blocks that
  // swallow cache adapter errors are exercised.
  // ---------------------------------------------------------------------------
  it('getRules swallows cache.has errors and returns uncached result', async () => {
    // Storage with cache where has() throws
    const storage = new InMemoryStorage();
    const originalHas = storage.cache!.has.bind(storage.cache);
    let hasThrowCount = 0;
    storage.cache!.has = async () => {
      hasThrowCount++;
      throw new Error('cache.has error');
    };

    const guantr = new Guantr({ storage });
    await guantr.setRules([{ effect: 'allow', action: 'read', resource: 'post', condition: null }]);

    // getRules: cache.has throws → swallowed → returns uncached rules
    const rules = await guantr.getRules();
    expect(rules).toHaveLength(1);
    expect(hasThrowCount).toBeGreaterThanOrEqual(1);

    // Restore original has for cleanup
    storage.cache!.has = originalHas;
  });

  it('getRules swallows cache.set errors and returns uncached rules', async () => {
    const storage = new InMemoryStorage();
    storage.cache!.has = async () => false;
    const originalSet = storage.cache!.set.bind(storage.cache);
    let setThrowCount = 0;
    storage.cache!.set = async () => {
      setThrowCount++;
      throw new Error('cache.set error');
    };

    const guantr = new Guantr({ storage });
    await guantr.setRules([{ effect: 'allow', action: 'read', resource: 'post', condition: null }]);

    const rules = await guantr.getRules();
    expect(rules).toHaveLength(1);
    expect(setThrowCount).toBeGreaterThanOrEqual(1);

    storage.cache!.set = originalSet;
  });

  it('can() swallows cache.has errors and evaluates the rule', async () => {
    const storage = new InMemoryStorage();
    const originalHas = storage.cache!.has.bind(storage.cache);
    storage.cache!.has = async () => {
      throw new Error('cache.has error');
    };

    const guantr = new Guantr({ storage });
    await guantr.setRules([{ effect: 'allow', action: 'read', resource: 'post', condition: null }]);

    // Even though cache.has throws, can() should still evaluate and return true
    expect(await guantr.can('read', ['post', { id: 1 }])).toBe(true);

    storage.cache!.has = originalHas;
  });

  it('can.abstract() swallows cache.has errors and evaluates the rule', async () => {
    const storage = new InMemoryStorage();
    const originalHas = storage.cache!.has.bind(storage.cache);
    storage.cache!.has = async () => {
      throw new Error('cache.has error');
    };

    const guantr = new Guantr({ storage });
    await guantr.setRules([{ effect: 'allow', action: 'read', resource: 'post', condition: null }]);

    expect(await guantr.can.abstract('read', 'post')).toBe(true);

    storage.cache!.has = originalHas;
  });

  it('applyContextualOperands swallows cache.has errors and resolves context', async () => {
    const storage = new InMemoryStorage();
    const originalHas = storage.cache!.has.bind(storage.cache);
    let hasCallCount = 0;
    storage.cache!.has = async () => {
      hasCallCount++;
      throw new Error('cache.has error');
    };

    const guantr = new Guantr({
      storage,
      getContext: () => ({ userId: 42 }),
    });
    await guantr.setRules([
      {
        effect: 'allow',
        action: 'read',
        resource: 'post',
        condition: { authorId: ['eq', '$ctx.userId'] },
      },
    ]);

    // The $ctx.userId should still resolve even though cache.has throws
    expect(await guantr.can('read', ['post', { authorId: 42 }])).toBe(true);
    expect(hasCallCount).toBeGreaterThanOrEqual(1);

    storage.cache!.has = originalHas;
  });

  it('can() works without cache at all (no cache property)', async () => {
    const guantr = await createGuantr({
      storage: {
        setRules: async () => {},
        getRules: async () => [],
        queryRules: async () => [
          { effect: 'allow', action: 'read', resource: 'post', condition: null },
        ],
      },
    });
    expect(await guantr.can('read', ['post', { id: 1 }])).toBe(true);
  });
});
