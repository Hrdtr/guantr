import type { GuantrAnyRule } from '../src/types';
import { describe, expect, it } from 'vitest';
import { Guantr } from '../src/index';
import { InMemoryStorage } from '../src/storage';

describe('cache invalidation after setRules', () => {
  // 1. can() result updates after setRules
  it('can() result updates after setRules', async () => {
    const guantr = new Guantr();

    await guantr.setRules([{ effect: 'allow', action: 'read', resource: 'post', condition: null }]);

    // Warm the cache
    expect(await guantr.can('read', ['post', { id: 1 }])).toBe(true);

    // Replace rules with empty set
    await guantr.setRules([]);

    // Stale cache must be gone — should now return false
    expect(await guantr.can('read', ['post', { id: 1 }])).toBe(false);
  });

  // 2. getRules() result updates after setRules
  it('getRules() result updates after setRules', async () => {
    const guantr = new Guantr();

    await guantr.setRules([{ effect: 'allow', action: 'read', resource: 'post', condition: null }]);

    // Warm the getRules cache
    const rules = await guantr.getRules();
    expect(rules).toHaveLength(1);

    // Replace rules with empty set
    await guantr.setRules([]);

    // Cache must be cleared — length should now be 0
    const newRules = await guantr.getRules();
    expect(newRules).toHaveLength(0);
  });

  // 3. can.abstract() result updates after setRules
  it('can.abstract() result updates after setRules', async () => {
    const guantr = new Guantr();

    await guantr.setRules([{ effect: 'allow', action: 'read', resource: 'post', condition: null }]);

    // Warm the abstract cache
    expect(await guantr.can.abstract('read', 'post')).toBe(true);

    // Replace rules with empty set
    await guantr.setRules([]);

    // Cache must be cleared — no allow rule exists anymore
    expect(await guantr.can.abstract('read', 'post')).toBe(false);
  });

  // 4. Multiple setRules cycles work correctly
  it('multiple setRules cycles invalidate correctly', async () => {
    const guantr = new Guantr();

    // Rule A: allow read on post with id=1
    await guantr.setRules([
      {
        effect: 'allow',
        action: 'read',
        resource: 'post',
        condition: { id: ['eq', 1] } as GuantrAnyRule['condition'],
      },
    ]);
    expect(await guantr.can('read', ['post', { id: 1 }])).toBe(true);

    // Rule B: allow read on post with id=2
    await guantr.setRules([
      {
        effect: 'allow',
        action: 'read',
        resource: 'post',
        condition: { id: ['eq', 2] } as GuantrAnyRule['condition'],
      },
    ]);
    expect(await guantr.can('read', ['post', { id: 1 }])).toBe(false);
    expect(await guantr.can('read', ['post', { id: 2 }])).toBe(true);

    // Rule A again
    await guantr.setRules([
      {
        effect: 'allow',
        action: 'read',
        resource: 'post',
        condition: { id: ['eq', 1] } as GuantrAnyRule['condition'],
      },
    ]);
    expect(await guantr.can('read', ['post', { id: 1 }])).toBe(true);
  });

  // 5. cache.clear() is called each time setRules is invoked
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

  // 6. deny rule takes effect after setRules (previously cached allow result is gone)
  it('deny rule takes effect after setRules', async () => {
    const guantr = new Guantr();

    // Set unconditional allow rule and warm the cache
    await guantr.setRules([{ effect: 'allow', action: 'read', resource: 'post', condition: null }]);
    expect(await guantr.can('read', ['post', { published: true }])).toBe(true);

    // Replace with an unconditional deny rule — allow rule no longer exists
    await guantr.setRules([{ effect: 'deny', action: 'read', resource: 'post', condition: null }]);

    // The stale cached "true" must be gone; unconditional deny triggers early exit → false
    expect(await guantr.can('read', ['post', { published: true }])).toBe(false);
  });
});
