import type { Condition } from '../../src/index';
import type { Storage } from '../../src/storage';
/**
 * Task 11 — Storage interface and implementation tests.
 *
 * Verifies:
 * 1. InMemoryStorage stores and retrieves rules with matchCondition
 * 2. queryRules filters by action and resource correctly
 * 3. Cache set/get/has/clear operations
 * 4. getRules returns correct format with serialized matchCondition
 * 5. Custom storage implementation works
 * 6. setRules replaces all rules atomically
 * 7. Null/undefined matchCondition handled correctly
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryStorage } from '../../src/storage';

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

function makeOperatorCondition(operator: string, path: string, value: unknown): Condition {
  return {
    type: 'condition',
    node: {
      type: 'operator',
      operator,
      operands: [
        { type: 'resource', path },
        { type: 'literal', value },
      ],
    },
  } as Condition;
}

function makeLogicalCondition(operator: 'and' | 'or' | 'not', conditions: Condition[]): Condition {
  return {
    type: 'condition',
    node: {
      type: 'logical',
      operator,
      operands: conditions,
    },
  } as Condition;
}

// ---------------------------------------------------------------------------
// 1. InMemoryStorage — setRules / getRules
// ---------------------------------------------------------------------------

describe('InMemoryStorage — setRules / getRules', () => {
  let storage: InMemoryStorage;

  beforeEach(() => {
    storage = new InMemoryStorage();
  });

  it('stores and retrieves a rule with matchCondition', async () => {
    const condition = makeOperatorCondition('eq', 'status', 'published');

    await storage.setRules([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: condition,
      },
    ]);

    const rules = await storage.getRules();
    expect(rules).toHaveLength(1);
    expect(rules[0].resource).toBe('post');
    expect(rules[0].action).toBe('read');
    expect(rules[0].effect).toBe('allow');
    expect((rules[0].matchCondition as Condition).type).toBe('condition');
  });

  it('stores and retrieves multiple rules', async () => {
    await storage.setRules([
      { resource: 'post', action: 'read', effect: 'allow', matchCondition: null },
      { resource: 'post', action: 'create', effect: 'deny', matchCondition: null },
      { resource: 'comment', action: 'read', effect: 'allow', matchCondition: null },
    ]);

    const rules = await storage.getRules();
    expect(rules).toHaveLength(3);
  });

  it('getRules returns empty array when no rules set', async () => {
    const rules = await storage.getRules();
    expect(rules).toHaveLength(0);
  });

  it('setRules replaces all rules atomically', async () => {
    await storage.setRules([
      { resource: 'post', action: 'read', effect: 'allow', matchCondition: null },
    ]);

    await storage.setRules([
      { resource: 'post', action: 'update', effect: 'deny', matchCondition: null },
    ]);

    const rules = await storage.getRules();
    expect(rules).toHaveLength(1);
    expect(rules[0].action).toBe('update');
    expect(rules[0].effect).toBe('deny');
  });

  it('stores rule with complex nested condition', async () => {
    const condition = makeLogicalCondition('and', [
      makeOperatorCondition('eq', 'status', 'published'),
      makeOperatorCondition('gt', 'viewCount', 100),
    ]);

    await storage.setRules([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: condition,
      },
    ]);

    const rules = await storage.getRules();
    expect(rules).toHaveLength(1);
    const storedCondition = rules[0].matchCondition as Condition;
    expect(storedCondition.type).toBe('condition');
    expect(storedCondition.node.type).toBe('logical');
  });

  it('stores rule with undefined matchCondition', async () => {
    await storage.setRules([{ resource: 'post', action: 'read', effect: 'allow' }]);

    const rules = await storage.getRules();
    expect(rules[0].matchCondition).toBeUndefined();
  });

  it('stores rule with null matchCondition', async () => {
    await storage.setRules([
      { resource: 'post', action: 'read', effect: 'allow', matchCondition: null },
    ]);

    const rules = await storage.getRules();
    expect(rules[0].matchCondition).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. InMemoryStorage — queryRules
// ---------------------------------------------------------------------------

describe('InMemoryStorage — queryRules', () => {
  let storage: InMemoryStorage;

  beforeEach(async () => {
    storage = new InMemoryStorage();
    await storage.setRules([
      { resource: 'post', action: 'read', effect: 'allow', matchCondition: null },
      { resource: 'post', action: 'update', effect: 'allow', matchCondition: null },
      { resource: 'post', action: 'delete', effect: 'deny', matchCondition: null },
      { resource: 'comment', action: 'read', effect: 'allow', matchCondition: null },
      { resource: 'comment', action: 'delete', effect: 'deny', matchCondition: null },
    ]);
  });

  it('returns matching rules for a given action and resource', async () => {
    const rules = await storage.queryRules('read', 'post');
    expect(rules).toHaveLength(1);
    expect(rules[0].resource).toBe('post');
    expect(rules[0].action).toBe('read');
  });

  it('returns multiple rules when multiple match', async () => {
    const rules = await storage.queryRules('read', 'comment');
    expect(rules).toHaveLength(1);
  });

  it('returns empty array when no rules match action', async () => {
    const rules = await storage.queryRules('nonexistent', 'post');
    expect(rules).toHaveLength(0);
  });

  it('returns empty array when no rules match resource', async () => {
    const rules = await storage.queryRules('read', 'nonexistent');
    expect(rules).toHaveLength(0);
  });

  it('returns empty array when both action and resource mismatch', async () => {
    const rules = await storage.queryRules('nonexistent', 'nonexistent');
    expect(rules).toHaveLength(0);
  });

  it('returns multiple rules for same action+resource', async () => {
    await storage.setRules([
      { resource: 'post', action: 'read', effect: 'allow', matchCondition: null },
      { resource: 'post', action: 'read', effect: 'deny', matchCondition: null },
    ]);

    const rules = await storage.queryRules('read', 'post');
    expect(rules).toHaveLength(2);
  });

  it('queryRules returns rules with matchCondition intact', async () => {
    const condition = makeOperatorCondition('eq', 'status', 'published');
    await storage.setRules([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: condition,
      },
    ]);

    const rules = await storage.queryRules('read', 'post');
    expect(rules).toHaveLength(1);
    expect((rules[0].matchCondition as Condition).node.type).toBe('operator');
  });
});

// ---------------------------------------------------------------------------
// 3. InMemoryStorage — Cache operations
// ---------------------------------------------------------------------------

describe('InMemoryStorage — cache', () => {
  let storage: InMemoryStorage;

  beforeEach(() => {
    storage = new InMemoryStorage();
  });

  it('cache set and get', async () => {
    expect(storage.cache).toBeDefined();
    await storage.cache!.set('key1', 'value1');
    const result = await storage.cache!.get<string>('key1');
    expect(result).toBe('value1');
  });

  it('cache get returns undefined for missing key', async () => {
    const result = await storage.cache!.get<string>('nonexistent');
    expect(result).toBeUndefined();
  });

  it('cache has returns true for existing key', async () => {
    await storage.cache!.set('key1', 'value1');
    expect(await storage.cache!.has('key1')).toBe(true);
  });

  it('cache has returns false for missing key', async () => {
    expect(await storage.cache!.has('nonexistent')).toBe(false);
  });

  it('cache clear removes all entries', async () => {
    await storage.cache!.set('key1', 'value1');
    await storage.cache!.set('key2', 'value2');
    await storage.cache!.clear();
    expect(await storage.cache!.has('key1')).toBe(false);
    expect(await storage.cache!.has('key2')).toBe(false);
  });

  it('cache stores boolean values', async () => {
    await storage.cache!.set('boolKey', true);
    expect(await storage.cache!.get<boolean>('boolKey')).toBe(true);

    await storage.cache!.set('boolKey', false);
    expect(await storage.cache!.get<boolean>('boolKey')).toBe(false);
  });

  it('cache stores complex objects', async () => {
    const obj = { rules: [{ id: 1 }, { id: 2 }] };
    await storage.cache!.set('complex', obj);
    const result = await storage.cache!.get<typeof obj>('complex');
    expect(result).toEqual(obj);
  });
});

// ---------------------------------------------------------------------------
// 4. Custom storage implementation
// ---------------------------------------------------------------------------

describe('custom storage implementation', () => {
  it('custom storage implementing Storage interface works', async () => {
    type StoredRule = {
      resource: string;
      action: string;
      effect: 'allow' | 'deny';
      matchCondition?: unknown;
    };

    const store: StoredRule[] = [];
    const cacheMap = new Map<string, unknown>();

    const customStorage: Storage = {
      setRules: async (rules) => {
        store.length = 0;
        for (const rule of rules) {
          store.push({
            resource: rule.resource,
            action: rule.action,
            effect: rule.effect,
            matchCondition: rule.matchCondition,
          });
        }
      },

      getRules: async () => {
        return store.map((r) => ({
          resource: r.resource,
          action: r.action,
          effect: r.effect,
          matchCondition: r.matchCondition as Condition | undefined,
        }));
      },

      queryRules: async (action, resource) => {
        return store
          .filter((r) => r.action === action && r.resource === resource)
          .map((r) => ({
            resource: r.resource,
            action: r.action,
            effect: r.effect,
            matchCondition: r.matchCondition as Condition | undefined,
          }));
      },

      cache: {
        set: async (key, value) => {
          cacheMap.set(key, value);
        },
        get: async <T>(key: string) => {
          return cacheMap.get(key) as T | undefined;
        },
        has: async (key) => {
          return cacheMap.has(key);
        },
        clear: async () => {
          cacheMap.clear();
        },
      },
    };

    const condition = makeOperatorCondition('eq', 'status', 'published');

    await customStorage.setRules([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: condition,
      },
      {
        resource: 'post',
        action: 'delete',
        effect: 'deny',
        matchCondition: null,
      },
    ]);

    const allRules = await customStorage.getRules();
    expect(allRules).toHaveLength(2);

    const readRules = await customStorage.queryRules('read', 'post');
    expect(readRules).toHaveLength(1);
    expect(readRules[0].effect).toBe('allow');
    const mc = readRules[0].matchCondition as Condition;
    expect(mc.type).toBe('condition');

    await customStorage.cache!.set('test', 42);
    expect(await customStorage.cache!.get('test')).toBe(42);
    expect(await customStorage.cache!.has('test')).toBe(true);
    await customStorage.cache!.clear();
    expect(await customStorage.cache!.has('test')).toBe(false);
  });

  it('custom storage without cache (cache undefined) works', async () => {
    const store: Array<{
      resource: string;
      action: string;
      effect: 'allow' | 'deny';
      matchCondition?: unknown;
    }> = [];

    const storageNoCache: Storage = {
      setRules: async (rules) => {
        store.length = 0;
        for (const rule of rules) {
          store.push({
            resource: rule.resource,
            action: rule.action,
            effect: rule.effect,
            matchCondition: rule.matchCondition,
          });
        }
      },
      getRules: async () =>
        store.map((r) => ({
          resource: r.resource,
          action: r.action,
          effect: r.effect,
          matchCondition: r.matchCondition as Condition | undefined,
        })),
      queryRules: async (action, resource) =>
        store
          .filter((r) => r.action === action && r.resource === resource)
          .map((r) => ({
            resource: r.resource,
            action: r.action,
            effect: r.effect,
            matchCondition: r.matchCondition as Condition | undefined,
          })),
      // No cache property
    };

    await storageNoCache.setRules([
      { resource: 'post', action: 'read', effect: 'allow', matchCondition: null },
    ]);

    const rules = await storageNoCache.getRules();
    expect(rules).toHaveLength(1);
    expect(storageNoCache.cache).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 5. Edge cases
// ---------------------------------------------------------------------------

describe('storage edge cases', () => {
  it('setRules with empty array clears existing rules', async () => {
    const storage = new InMemoryStorage();

    await storage.setRules([
      { resource: 'post', action: 'read', effect: 'allow', matchCondition: null },
    ]);

    await storage.setRules([]);
    const rules = await storage.getRules();
    expect(rules).toHaveLength(0);
  });

  it('queryRules on empty storage returns empty array', async () => {
    const storage = new InMemoryStorage();
    const rules = await storage.queryRules('read', 'post');
    expect(rules).toHaveLength(0);
  });

  it('stores rule with context ref in condition', async () => {
    const condition: Condition = {
      type: 'condition',
      node: {
        type: 'operator',
        operator: 'eq',
        operands: [
          { type: 'resource', path: 'authorId' },
          { type: 'context', path: 'userId' },
        ],
      },
    } as Condition;

    const storage = new InMemoryStorage();
    await storage.setRules([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: condition,
      },
    ]);

    const rules = await storage.getRules();
    expect(rules).toHaveLength(1);
    const mc = rules[0].matchCondition as Condition;
    expect(mc.type).toBe('condition');
  });

  it('cache operations survive after setRules', async () => {
    const storage = new InMemoryStorage();

    await storage.cache!.set('persistent', 'data');

    await storage.setRules([
      { resource: 'post', action: 'read', effect: 'allow', matchCondition: null },
    ]);

    // Cache should still have the value since setRules doesn't clear cache
    // (the Guantr class clears cache separately before calling setRules)
    expect(await storage.cache!.get('persistent')).toBe('data');
  });
});
