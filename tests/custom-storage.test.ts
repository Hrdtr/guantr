import type { Storage } from '../src/storage/types';
import type { GuantrRule } from '../src/types';
import { describe, expect, it } from 'vitest';
import { createGuantr, Guantr } from '../src/index';

// ---------------------------------------------------------------------------
// Custom storage with no cache — implements the Storage interface minimally.
// Note: setRules atomically replaces the internal array.
// ---------------------------------------------------------------------------
class CustomArrayStorage implements Storage {
  private rules: GuantrRule[] = [];

  async setRules(rules: GuantrRule[]) {
    this.rules = [...rules];
  }

  async getRules() {
    return [...this.rules];
  }

  async queryRules(action: string, resource: string) {
    return this.rules.filter((r) => r.action === action && r.resource === resource);
  }
  // No `cache` property — tests that Guantr handles the absence of a cache correctly.
}

// ---------------------------------------------------------------------------
// Custom storage WITH optional cache — extends CustomArrayStorage and adds a
// Map-backed cache that exposes the `has` method, exercising the cache.has
// branch inside Guantr._can / _canAbstract.
// ---------------------------------------------------------------------------
class CustomStorageWithCache extends CustomArrayStorage {
  private cacheMap = new Map<string, unknown>();

  readonly cache = {
    set: async <T>(key: string, value: T): Promise<void> => {
      this.cacheMap.set(key, value);
    },
    get: async <T>(key: string): Promise<T | undefined> => this.cacheMap.get(key) as T | undefined,
    has: async (key: string): Promise<boolean> => this.cacheMap.has(key),
    clear: async (): Promise<void> => {
      this.cacheMap.clear();
    },
  };
}

describe('custom storage adapter integration', () => {
  it('basic can(): allow rule stored in custom storage grants access', async () => {
    const guantr = new Guantr({ storage: new CustomArrayStorage() });
    await guantr.setRules([
      {
        resource: 'post',
        action: 'read',
        condition: { authorId: ['eq', 1] } as any,
        effect: 'allow',
      },
    ]);

    expect(await guantr.can('read', ['post', { authorId: 1 }])).toBe(true);
    expect(await guantr.can('read', ['post', { authorId: 99 }])).toBe(false);
  });

  it('deny rule: cannot() returns true and can() returns false when only a deny rule exists', async () => {
    const guantr = new Guantr({ storage: new CustomArrayStorage() });
    await guantr.setRules([
      {
        resource: 'post',
        action: 'delete',
        condition: null,
        effect: 'deny',
      },
    ]);

    expect(await guantr.cannot('delete', ['post', { id: 1 }])).toBe(true);
    expect(await guantr.can('delete', ['post', { id: 1 }])).toBe(false);
  });

  it('can.abstract(): returns true when at least one allow rule exists for the action+resource', async () => {
    const guantr = new Guantr({ storage: new CustomArrayStorage() });
    await guantr.setRules([
      {
        resource: 'post',
        action: 'read',
        condition: { published: ['eq', true] } as any,
        effect: 'allow',
      },
    ]);

    expect(await guantr.can.abstract('read', 'post')).toBe(true);
    expect(await guantr.can.abstract('delete', 'post')).toBe(false);
  });

  it('getRules(): returns all rules that were stored via setRules()', async () => {
    const guantr = new Guantr({ storage: new CustomArrayStorage() });
    const rules: GuantrRule[] = [
      { resource: 'post', action: 'read', condition: null, effect: 'allow' },
      { resource: 'post', action: 'delete', condition: null, effect: 'deny' },
    ];
    await guantr.setRules(rules);

    const stored = await guantr.getRules();
    expect(stored).toHaveLength(2);
    expect(stored).toContainEqual(rules[0]);
    expect(stored).toContainEqual(rules[1]);
  });

  it('setRules() replaces previous rules: second call overwrites the first', async () => {
    // setRules() atomically replaces all rules, so a second call must discard
    // the first batch and store only the new rules.
    const guantr = new Guantr({ storage: new CustomArrayStorage() });

    await guantr.setRules([{ resource: 'post', action: 'read', condition: null, effect: 'allow' }]);
    await guantr.setRules([
      { resource: 'post', action: 'create', condition: null, effect: 'allow' },
    ]);

    const stored = await guantr.getRules();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ action: 'create', resource: 'post', effect: 'allow' });
  });

  it('custom storage without cache: can() returns correct result on every call (no stale cache)', async () => {
    const storage = new CustomArrayStorage();
    const guantr = new Guantr({ storage });

    await guantr.setRules([
      {
        resource: 'post',
        action: 'read',
        condition: { status: ['eq', 'published'] } as any,
        effect: 'allow',
      },
    ]);

    // With no cache each evaluation goes directly to storage.
    expect(await guantr.can('read', ['post', { status: 'published' }])).toBe(true);
    expect(await guantr.can('read', ['post', { status: 'draft' }])).toBe(false);
    // Re-evaluate the first case to confirm consistency without caching.
    expect(await guantr.can('read', ['post', { status: 'published' }])).toBe(true);
  });

  it('custom storage with optional cache: can() uses the cache.has path and still returns correct results', async () => {
    const storage = new CustomStorageWithCache();
    const guantr = new Guantr({ storage });

    await guantr.setRules([
      {
        resource: 'post',
        action: 'read',
        condition: null,
        effect: 'allow',
      },
    ]);

    const post = { id: 1, title: 'Cached Post' };

    // First call: cache miss → evaluates rule → caches true.
    expect(await guantr.can('read', ['post', post])).toBe(true);
    // Second call: cache hit via cache.has → returns cached true.
    expect(await guantr.can('read', ['post', post])).toBe(true);

    // cannot() should correctly negate the cached/evaluated result.
    expect(await guantr.cannot('read', ['post', post])).toBe(false);
  });

  it('createGuantr with custom storage: rules passed at construction time are respected', async () => {
    const storage = new CustomArrayStorage();
    const guantr = await createGuantr(
      [{ resource: 'post', action: 'read', condition: null, effect: 'allow' }],
      { storage },
    );

    expect(await guantr.can('read', ['post', { id: 1 }])).toBe(true);
    expect(await guantr.can('delete', ['post', { id: 1 }])).toBe(false);
  });
});
