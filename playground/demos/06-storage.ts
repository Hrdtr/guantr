/**
 * Demo 6: Custom Storage Adapter
 * ===============================
 *
 * Demonstrates implementing the Storage interface for custom backends.
 * Covers array-based storage, cache integration, and error handling.
 */

import type { Storage } from '../../src/storage/types';
import { createGuantr, Guantr, GuantrRule, GuantrMeta, GuantrResourceMap } from '../../src/index';
import { InMemoryStorage } from '../../src/storage';
import { heading, sub, assert, assertRejects, info } from '../utils';

/* ------------------------------------------------------------------ */
/*  Typed resource map for storage demos                               */
/* ------------------------------------------------------------------ */

type StorageResourceMap = GuantrResourceMap<{
  post: {
    action: 'read' | 'delete' | 'view';
    model: { id: number };
  };
  dashboard: {
    action: 'view';
    model: Record<string, unknown>;
  };
  reports: {
    action: 'read';
    model: Record<string, unknown>;
  };
}>;

type StorageMeta = GuantrMeta<StorageResourceMap>;

/* ------------------------------------------------------------------ */
/*  6a. Custom array-based storage (no cache)                           */
/* ------------------------------------------------------------------ */

class ArrayStorage implements Storage {
  private _rules: GuantrRule[] = [];

  async setRules(rules: GuantrRule[]): Promise<void> {
    this._rules = [...rules];
  }

  async getRules(): Promise<GuantrRule[]> {
    return [...this._rules];
  }

  async queryRules(action: string, resource: string): Promise<GuantrRule[]> {
    return this._rules.filter((r) => r.action === action && r.resource === resource);
  }
}

/* ------------------------------------------------------------------ */
/*  6b. Custom storage with cache                                      */
/* ------------------------------------------------------------------ */

class CachedArrayStorage implements Storage {
  private _rules: GuantrRule[] = [];
  private _cache = new Map<string, unknown>();

  async setRules(rules: GuantrRule[]): Promise<void> {
    this._rules = [...rules];
    this._cache.clear(); // Invalidate cache on rule change
  }

  async getRules(): Promise<GuantrRule[]> {
    return [...this._rules];
  }

  async queryRules(action: string, resource: string): Promise<GuantrRule[]> {
    return this._rules.filter((r) => r.action === action && r.resource === resource);
  }

  cache = {
    set: async <T>(key: string, value: T) => {
      this._cache.set(key, value);
    },
    get: async <T>(key: string): Promise<T | undefined> => this._cache.get(key) as T | undefined,
    has: async (key: string) => this._cache.has(key),
    clear: async () => {
      this._cache.clear();
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Demo                                                                */
/* ------------------------------------------------------------------ */

export async function demoStorage(): Promise<void> {
  heading('6. Custom Storage Adapter');

  /* ------------------------------------------------------------------ */
  /*  6c. Basic array storage                                             */
  /* ------------------------------------------------------------------ */
  sub('ArrayStorage (no cache)');

  const guantr = await createGuantr<StorageMeta>({ storage: new ArrayStorage() });

  await guantr.setRules([
    { effect: 'allow', action: 'read', resource: 'post', condition: null },
    { effect: 'deny', action: 'delete', resource: 'post', condition: null },
  ]);

  assert(await guantr.can('read', ['post', { id: 1 }]), 'Custom storage (no cache): can() works');
  assert(
    !(await guantr.can('delete', ['post', { id: 1 }])),
    'Custom storage (no cache): deny overrides allow',
  );

  /* ------------------------------------------------------------------ */
  /*  6d. InMemoryStorage (built-in) with cache                           */
  /* ------------------------------------------------------------------ */
  sub('InMemoryStorage (built-in, with cache)');

  const guantr2 = await createGuantr<StorageMeta>({ storage: new InMemoryStorage() });

  await guantr2.setRules([{ effect: 'allow', action: 'read', resource: 'post', condition: null }]);

  // First call — populates cache
  assert(await guantr2.can('read', ['post', { id: 1 }]), 'InMemoryStorage: first call works');

  // Second call — serves from cache
  assert(await guantr2.can('read', ['post', { id: 2 }]), 'InMemoryStorage: subsequent call works');

  // getRules
  const stored = await guantr2.getRules();
  assert(stored.length === 1, 'InMemoryStorage: getRules returns stored rules');

  /* ------------------------------------------------------------------ */
  /*  6e. CachedArrayStorage                                              */
  /* ------------------------------------------------------------------ */
  sub('CachedArrayStorage');

  const cachedStorage = new CachedArrayStorage();
  const guantr3 = await createGuantr<StorageMeta>({ storage: cachedStorage });

  await guantr3.setRules([
    { effect: 'allow', action: 'view', resource: 'dashboard', condition: null },
  ]);

  assert(await guantr3.can('view', ['dashboard', {}]), 'CachedArrayStorage: can() works');

  // setRules should invalidate cache
  await guantr3.setRules([
    { effect: 'allow', action: 'view', resource: 'dashboard', condition: null },
    { effect: 'deny', action: 'view', resource: 'dashboard', condition: null },
  ]);

  assert(
    !(await guantr3.can('view', ['dashboard', {}])),
    'CachedArrayStorage: cache invalidated after setRules',
  );

  /* ------------------------------------------------------------------ */
  /*  6f. Circuit breaker with custom storage                             */
  /* ------------------------------------------------------------------ */
  sub('Circuit breaker with custom storage');

  const breakerGuantr = await createGuantr<StorageMeta>({
    storage: new InMemoryStorage(),
    maxRuleIterations: 50,
  });

  // Create 51 rules — exceed the limit
  const manyRules: GuantrRule<StorageMeta>[] = [];
  for (let i = 0; i < 51; i++) {
    manyRules.push({
      effect: 'allow',
      action: 'read',
      resource: 'post',
      condition: { id: ['eq', i] },
    });
  }
  await breakerGuantr.setRules(manyRules);

  await assertRejects(
    () => breakerGuantr.can('read', ['post', { id: 999 }]),
    'Circuit breaker trips when iteration limit exceeded',
  );

  /* ------------------------------------------------------------------ */
  /*  6g. Create Guantr with options only (no rules)                     */
  /* ------------------------------------------------------------------ */
  sub('new Guantr(options) — direct constructor');

  const direct = new Guantr<StorageMeta>({ storage: new InMemoryStorage() });
  await direct.setRules([
    { effect: 'allow', action: 'read', resource: 'reports', condition: null },
  ]);

  assert(
    await direct.can('read', ['reports', {}]),
    'new Guantr(options) works with custom storage',
  );

  /* ------------------------------------------------------------------ */
  /*  Summary                                                             */
  /* ------------------------------------------------------------------ */
  info('Custom storage and circuit breaker verified.');
}
