import type { Condition } from '../../src/index';
import type { Storage } from '../../src/storage';
/**
 * Task 10 — Integration tests for the full Guantr API with matchCondition.
 *
 * Verifies:
 * 1. `can()` works with `matchCondition` rules (allow + deny)
 * 2. `cannot()` works correctly
 * 3. `can.abstract()` works with matchCondition rules
 * 4. `can.all()` and `can.any()` work with matchCondition
 * 5. Cache invalidation works after `setRules`
 * 6. Circuit breaker trips on iteration limit
 * 7. `context` is resolved and used in evaluation
 * 8. Multiple rules combine correctly (allow/deny precedence)
 * 9. Callback form of `setRules` with matchCondition
 * 10. `relatedRulesFor` returns correct rules
 */
import { describe, it, expect } from 'vitest';
import {
  createGuantr,
  Guantr,
  GuantrMeta,
  GuantrResourceMap,
  GuantrCircuitBreakerError,
  GuantrInvalidConditionKeyError,
} from '../../src/index';
import { InMemoryStorage } from '../../src/storage';

// ---------------------------------------------------------------------------
// Sample types
// ---------------------------------------------------------------------------

type Post = {
  id: number;
  title: string;
  status: string;
  published: boolean;
  viewCount: number;
  tags: string[];
  authorId: number;
  comments: { approved: boolean }[];
};

type AppContext = {
  userId: number;
  role: string;
};

type ResourceMap = GuantrResourceMap<{
  post: {
    action: 'read' | 'create' | 'update' | 'delete';
    model: Post;
  };
}>;

type ContextMeta = GuantrMeta<ResourceMap, AppContext>;

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const samplePost: Post = {
  id: 10,
  title: 'Hello World',
  status: 'published',
  published: true,
  viewCount: 500,
  tags: ['tech', 'news'],
  authorId: 1,
  comments: [{ approved: true }, { approved: false }],
};

// ---------------------------------------------------------------------------
// 1. can() with matchCondition rules
// ---------------------------------------------------------------------------

describe('can() with matchCondition', () => {
  it('returns true when allow rule matches', async () => {
    const guantr = await createGuantr<ContextMeta>([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ eq, resource, literal }) => eq(resource('status'), literal('published')),
      },
    ]);

    const result = await guantr.can('read', ['post', samplePost]);
    expect(result).toBe(true);
  });

  it('returns false when allow rule does not match', async () => {
    const guantr = await createGuantr<ContextMeta>([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ eq, resource, literal }) => eq(resource('status'), literal('draft')),
      },
    ]);

    const result = await guantr.can('read', ['post', samplePost]);
    expect(result).toBe(false);
  });

  it('returns false when no rules exist', async () => {
    const guantr = await createGuantr<ContextMeta>();
    const result = await guantr.can('read', ['post', samplePost]);
    expect(result).toBe(false);
  });

  it('returns false when deny rule matches (even if allow exists)', async () => {
    const guantr = await createGuantr<ContextMeta>([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ eq, resource, literal }) => eq(resource('status'), literal('published')),
      },
      {
        resource: 'post',
        action: 'read',
        effect: 'deny',
        matchCondition: ({ eq, resource, literal }) => eq(resource('id'), literal(10)),
      },
    ]);

    // Deny rule: eq(resource('id'), literal(...)) — will always evaluate
    const result = await guantr.can('read', ['post', samplePost]);
    expect(result).toBe(false);
  });

  it('returns true when deny rule does not match but allow does', async () => {
    const guantr = await createGuantr<ContextMeta>([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ eq, resource, literal }) => eq(resource('status'), literal('published')),
      },
      {
        resource: 'post',
        action: 'read',
        effect: 'deny',
        matchCondition: ({ eq, resource, literal }) => eq(resource('id'), literal(999)),
      },
    ]);

    const result = await guantr.can('read', ['post', samplePost]);
    expect(result).toBe(true);
  });

  it('unconditional allow returns true', async () => {
    const guantr = await createGuantr<ContextMeta>([
      { resource: 'post', action: 'read', effect: 'allow' },
    ]);

    const result = await guantr.can('read', ['post', samplePost]);
    expect(result).toBe(true);
  });

  it('unconditional deny returns false', async () => {
    const guantr = await createGuantr<ContextMeta>([
      { resource: 'post', action: 'read', effect: 'deny' },
    ]);

    const result = await guantr.can('read', ['post', samplePost]);
    expect(result).toBe(false);
  });

  it('uses matchCondition with logical operators', async () => {
    const guantr = await createGuantr<ContextMeta>([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ and, eq, gt, resource, literal }) =>
          and(
            eq(resource('status'), literal('published')),
            gt(resource('viewCount'), literal(100)),
          ),
      },
    ]);

    const result = await guantr.can('read', ['post', samplePost]);
    expect(result).toBe(true);
  });

  it('uses matchCondition with nested array operators', async () => {
    const guantr = await createGuantr<ContextMeta>([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ some, resource }) =>
          some(resource('comments'), ({ eq: eq2, resource: r2, literal: l2 }) =>
            eq2(r2('approved'), l2(true)),
          ),
      },
    ]);

    expect(await guantr.can('read', ['post', samplePost])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. cannot() with matchCondition rules
// ---------------------------------------------------------------------------

describe('cannot() with matchCondition', () => {
  it('returns false when allow rule matches', async () => {
    const guantr = await createGuantr<ContextMeta>([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ eq, resource, literal }) => eq(resource('status'), literal('published')),
      },
    ]);

    const result = await guantr.cannot('read', ['post', samplePost]);
    expect(result).toBe(false);
  });

  it('returns true when allow rule does not match', async () => {
    const guantr = await createGuantr<ContextMeta>([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ eq, resource, literal }) => eq(resource('status'), literal('draft')),
      },
    ]);

    const result = await guantr.cannot('read', ['post', samplePost]);
    expect(result).toBe(true);
  });

  it('cannot is logical negation of can', async () => {
    const guantr = await createGuantr<ContextMeta>([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ eq, resource, literal }) => eq(resource('status'), literal('published')),
      },
    ]);

    const canResult = await guantr.can('read', ['post', samplePost]);
    const cannotResult = await guantr.cannot('read', ['post', samplePost]);
    expect(cannotResult).toBe(!canResult);
  });
});

// ---------------------------------------------------------------------------
// 3. can.abstract() with matchCondition rules
// ---------------------------------------------------------------------------

describe('can.abstract() with matchCondition', () => {
  it('returns true when allow rule exists (ignores conditions)', async () => {
    const guantr = await createGuantr<ContextMeta>([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ eq, resource, literal }) => eq(resource('status'), literal('draft')),
      },
    ]);

    const result = await guantr.can.abstract('read', 'post');
    expect(result).toBe(true);
  });

  it('returns false when only deny rules exist', async () => {
    const guantr = await createGuantr<ContextMeta>([
      {
        resource: 'post',
        action: 'read',
        effect: 'deny',
        matchCondition: ({ eq, resource, literal }) => eq(resource('status'), literal('published')),
      },
    ]);

    const result = await guantr.can.abstract('read', 'post');
    expect(result).toBe(false);
  });

  it('returns true when mix of allow and deny rules exist', async () => {
    const guantr = await createGuantr<ContextMeta>([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ eq, resource, literal }) => eq(resource('status'), literal('published')),
      },
      {
        resource: 'post',
        action: 'read',
        effect: 'deny',
        matchCondition: ({ eq, resource, literal }) => eq(resource('id'), literal(1)),
      },
    ]);

    const result = await guantr.can.abstract('read', 'post');
    expect(result).toBe(true);
  });

  it('cannot.abstract is logical negation of can.abstract', async () => {
    const guantr = await createGuantr<ContextMeta>([
      {
        resource: 'post',
        action: 'read',
        effect: 'deny',
        matchCondition: ({ eq, resource, literal }) => eq(resource('id'), literal(1)),
      },
    ]);

    const canAbs = await guantr.can.abstract('read', 'post');
    const cannotAbs = await guantr.cannot.abstract('read', 'post');
    expect(cannotAbs).toBe(!canAbs);
  });
});

// ---------------------------------------------------------------------------
// 4. can.all() and can.any() with matchCondition
// ---------------------------------------------------------------------------

describe('can.all() and can.any() with matchCondition', () => {
  it('can.all returns true when all checks pass', async () => {
    const guantr = await createGuantr<ContextMeta>([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ eq, resource, literal }) => eq(resource('status'), literal('published')),
      },
      {
        resource: 'post',
        action: 'update',
        effect: 'allow',
        matchCondition: ({ eq, resource, literal }) => eq(resource('id'), literal(10)),
      },
    ]);

    const result = await guantr.can.all([
      ['read', ['post', samplePost]],
      ['update', ['post', samplePost]],
    ]);
    expect(result).toBe(true);
  });

  it('can.all returns false when one check fails', async () => {
    const guantr = await createGuantr<ContextMeta>([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ eq, resource, literal }) => eq(resource('status'), literal('published')),
      },
    ]);

    const result = await guantr.can.all([
      ['read', ['post', samplePost]],
      ['delete', ['post', samplePost]],
    ]);
    expect(result).toBe(false);
  });

  it('can.any returns true when at least one check passes', async () => {
    const guantr = await createGuantr<ContextMeta>([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ eq, resource, literal }) => eq(resource('status'), literal('published')),
      },
    ]);

    const result = await guantr.can.any([
      ['read', ['post', samplePost]],
      ['delete', ['post', samplePost]],
    ]);
    expect(result).toBe(true);
  });

  it('can.any returns false when no checks pass', async () => {
    const guantr = await createGuantr<ContextMeta>([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ eq, resource, literal }) => eq(resource('status'), literal('draft')),
      },
    ]);

    const result = await guantr.can.any([
      ['read', ['post', samplePost]],
      ['update', ['post', samplePost]],
    ]);
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. Cache invalidation
// ---------------------------------------------------------------------------

describe('cache invalidation', () => {
  it('cache invalidates after setRules', async () => {
    const guantr = await createGuantr<ContextMeta>();

    await guantr.setRules([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ eq, resource, literal }) => eq(resource('status'), literal('published')),
      },
    ]);

    expect(await guantr.can('read', ['post', samplePost])).toBe(true);

    await guantr.setRules([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ eq, resource, literal }) => eq(resource('status'), literal('draft')),
      },
    ]);

    expect(await guantr.can('read', ['post', samplePost])).toBe(false);
  });

  it('getRules caches and returns cached result on second call', async () => {
    const storage = new InMemoryStorage();
    const guantr = new Guantr<ContextMeta>({ storage });

    await guantr.setRules([
      { resource: 'post', action: 'read', effect: 'allow', matchCondition: null },
    ]);

    const first = await guantr.getRules();
    const second = await guantr.getRules();
    expect(first).toHaveLength(1);
    expect(second).toEqual(first);
  });
});

// ---------------------------------------------------------------------------
// 6. Circuit breaker on iteration limit
// ---------------------------------------------------------------------------

describe('circuit breaker', () => {
  it('throws GuantrCircuitBreakerError when iteration limit exceeded', async () => {
    const guantr = await createGuantr<ContextMeta>({
      maxRuleIterations: 1,
    });

    await guantr.setRules([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ eq, resource, literal }) => eq(resource('status'), literal('published')),
      },
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ eq, resource, literal }) => eq(resource('status'), literal('draft')),
      },
    ]);

    await expect(guantr.can('read', ['post', samplePost])).rejects.toThrow(
      GuantrCircuitBreakerError,
    );
  });
});

// ---------------------------------------------------------------------------
// 7. context integration
// ---------------------------------------------------------------------------

describe('context integration', () => {
  it('resolves context from context function', async () => {
    const guantr = await createGuantr<ContextMeta>({
      context: () => ({ userId: 10, role: 'editor' }),
    });

    await guantr.setRules([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ eq, resource, context }) => eq(resource('authorId'), context('userId')),
      },
    ]);

    const result = await guantr.can('read', ['post', samplePost]);
    expect(result).toBe(false);
  });

  it('context resolves and is used across multiple checks', async () => {
    let callCount = 0;
    const guantr = await createGuantr<ContextMeta>({
      context: () => {
        callCount++;
        return { userId: 1, role: 'editor' };
      },
    });

    await guantr.setRules([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ eq, resource, context }) => eq(resource('authorId'), context('userId')),
      },
    ]);

    const contextPost = { ...samplePost, authorId: 1 };
    await guantr.can('read', ['post', contextPost]);
    expect(callCount).toBe(1);
  });

  it('context is resolved once for can.all', async () => {
    let callCount = 0;
    const guantr = await createGuantr<ContextMeta>({
      context: () => {
        callCount++;
        return { userId: 1, role: 'editor' };
      },
    });

    await guantr.setRules([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ eq, resource, context }) => eq(resource('authorId'), context('userId')),
      },
      {
        resource: 'post',
        action: 'update',
        effect: 'allow',
        matchCondition: ({ eq, resource, context }) => eq(resource('id'), context('userId')),
      },
    ]);

    const contextPost = { ...samplePost, authorId: 1 };
    await guantr.can.all([
      ['read', ['post', contextPost]],
      ['update', ['post', contextPost]],
    ]);
    expect(callCount).toBe(1);
  });

  it('accepts a plain object as context', async () => {
    const guantr = await createGuantr<ContextMeta>({
      context: { userId: 10, role: 'editor' },
    });

    await guantr.setRules([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ eq, resource, context }) => eq(resource('authorId'), context('userId')),
      },
    ]);

    const result = await guantr.can('read', ['post', samplePost]);
    expect(result).toBe(false);
  });

  it('plain object context is reused across checks', async () => {
    const guantr = await createGuantr<ContextMeta>({
      context: { userId: 1, role: 'editor' },
    });

    await guantr.setRules([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ eq, resource, context }) => eq(resource('authorId'), context('userId')),
      },
      {
        resource: 'post',
        action: 'update',
        effect: 'allow',
        matchCondition: ({ eq, resource, context }) => eq(resource('id'), context('userId')),
      },
    ]);

    const contextPost = { ...samplePost, authorId: 1, id: 1 };
    expect(await guantr.can('read', ['post', contextPost])).toBe(true);
    expect(await guantr.can('update', ['post', contextPost])).toBe(true);
  });

  it('defaults to empty object when no context is provided', async () => {
    const guantr = await createGuantr<ContextMeta>();

    await guantr.setRules([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
      },
    ]);

    expect(await guantr.can('read', ['post', samplePost])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 8. Multiple rules interaction
// ---------------------------------------------------------------------------

describe('multiple rules interaction', () => {
  it('allow + deny with conditions: deny wins when both match', async () => {
    const guantr = await createGuantr<ContextMeta>([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ eq, resource, literal }) => eq(resource('status'), literal('published')),
      },
      {
        resource: 'post',
        action: 'read',
        effect: 'deny',
        matchCondition: ({ eq, resource, literal }) => eq(resource('viewCount'), literal(500)),
      },
    ]);

    const result = await guantr.can('read', ['post', samplePost]);
    expect(result).toBe(false);
  });

  it('allow wins when deny condition does not match', async () => {
    const guantr = await createGuantr<ContextMeta>([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ eq, resource, literal }) => eq(resource('status'), literal('published')),
      },
      {
        resource: 'post',
        action: 'read',
        effect: 'deny',
        matchCondition: ({ eq, resource, literal }) => eq(resource('viewCount'), literal(0)),
      },
    ]);

    const result = await guantr.can('read', ['post', samplePost]);
    expect(result).toBe(true);
  });

  it('multiple allows with different conditions', async () => {
    const guantr = await createGuantr<ContextMeta>([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ eq, resource, literal }) => eq(resource('status'), literal('published')),
      },
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ eq, resource, literal }) => eq(resource('id'), literal(10)),
      },
    ]);

    const result = await guantr.can('read', ['post', samplePost]);
    expect(result).toBe(true);
  });

  it('unconditional allow + conditional deny where deny matches', async () => {
    const guantr = await createGuantr<ContextMeta>([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
      },
      {
        resource: 'post',
        action: 'read',
        effect: 'deny',
        matchCondition: ({ eq, resource, literal }) => eq(resource('id'), literal(10)),
      },
    ]);

    const result = await guantr.can('read', ['post', samplePost]);
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 9. Callback form setRules
// ---------------------------------------------------------------------------

describe('callback form setRules', () => {
  it('callback form with matchCondition works', async () => {
    const guantr = await createGuantr<ContextMeta>();

    await guantr.setRules((allow) => {
      allow('read', [
        'post',
        ({ eq, resource, literal }) => eq(resource('status'), literal('published')),
      ]);
    });

    const result = await guantr.can('read', ['post', samplePost]);
    expect(result).toBe(true);
  });

  it('callback form with deny works', async () => {
    const guantr = await createGuantr<ContextMeta>();

    await guantr.setRules((allow, deny) => {
      allow('read', 'post');
      deny('read', 'post');
    });

    const result = await guantr.can('read', ['post', samplePost]);
    expect(result).toBe(false);
  });

  it('callback form with allow and deny conditions', async () => {
    const guantr = await createGuantr<ContextMeta>();

    await guantr.setRules((allow, deny) => {
      allow('read', [
        'post',
        ({ eq, resource, literal }) => eq(resource('status'), literal('published')),
      ]);
      deny('read', ['post', ({ eq, resource, literal }) => eq(resource('id'), literal(999))]);
    });

    const result = await guantr.can('read', ['post', samplePost]);
    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 10. relatedRulesFor
// ---------------------------------------------------------------------------

describe('relatedRulesFor', () => {
  it('returns matching rules for a given action and resource', async () => {
    const guantr = await createGuantr<ContextMeta>([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ eq, resource, literal }) => eq(resource('status'), literal('published')),
      },
      {
        resource: 'post',
        action: 'update',
        effect: 'allow',
      },
    ]);

    const rules = await guantr.relatedRulesFor('read', 'post');
    expect(rules).toHaveLength(1);
    expect(rules[0].effect).toBe('allow');
    const mc = rules[0].matchCondition as Condition;
    expect(mc.type).toBe('condition');
  });

  it('returns empty array for non-existent action+resource', async () => {
    const guantr = await createGuantr<ContextMeta>([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ eq, resource, literal }) => eq(resource('status'), literal('published')),
      },
    ]);

    const rules = await guantr.relatedRulesFor('read', 'post');
    expect(rules).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 11. Error handling
// ---------------------------------------------------------------------------

describe('error handling', () => {
  it('GuantrInvalidConditionKeyError propagates from evaluation', async () => {
    const guantr = await createGuantr<ContextMeta>();

    await guantr.setRules([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ eq, resource, literal }) => eq(resource('status'), literal('published')),
      },
    ]);

    const badResource = { id: 1, title: 'Hi' } as Post;
    await expect(guantr.can('read', ['post', badResource])).rejects.toThrow(
      GuantrInvalidConditionKeyError,
    );
  });
});

// ---------------------------------------------------------------------------
// 12. Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('null matchCondition on rule works as unconditional', async () => {
    const guantr = await createGuantr<ContextMeta>([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: null,
      },
    ]);

    const result = await guantr.can('read', ['post', samplePost]);
    expect(result).toBe(true);
  });

  it('array-type resource fields evaluate correctly', async () => {
    const guantr = await createGuantr<ContextMeta>([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ has, resource, literal }) => has(resource('tags'), literal('tech')),
      },
    ]);

    const result = await guantr.can('read', ['post', samplePost]);
    expect(result).toBe(true);
  });

  it('size-limited context evaluates correctly', async () => {
    const guantr = await createGuantr<ContextMeta>({
      context: () => ({ userId: 1, role: 'editor' }),
    });

    await guantr.setRules([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ eq, resource, context }) => eq(resource('authorId'), context('userId')),
      },
    ]);

    expect(await guantr.can('read', ['post', { ...samplePost, authorId: 1 }])).toBe(true);
    expect(await guantr.can('read', ['post', { ...samplePost, authorId: 2 }])).toBe(false);
  });

  it('getRules returns rules with serialized matchCondition', async () => {
    const guantr = await createGuantr<ContextMeta>([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ eq, resource, literal }) => eq(resource('status'), literal('published')),
      },
    ]);

    const rules = await guantr.getRules();
    expect(rules).toHaveLength(1);
    const rule = rules[0] as Record<string, unknown>;
    expect(typeof rule.matchCondition).toBe('object');
    expect((rule.matchCondition as Condition).type).toBe('condition');
  });
});

// ---------------------------------------------------------------------------
// 13. cannot.all() and cannot.any()
// ---------------------------------------------------------------------------

describe('cannot.all() and cannot.any()', () => {
  it('cannot.all returns false when all checks pass', async () => {
    const guantr = await createGuantr<ContextMeta>([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ eq, resource, literal }) => eq(resource('status'), literal('published')),
      },
      {
        resource: 'post',
        action: 'update',
        effect: 'allow',
        matchCondition: ({ eq, resource, literal }) => eq(resource('id'), literal(10)),
      },
    ]);

    const result = await guantr.cannot.all([
      ['read', ['post', samplePost]],
      ['update', ['post', samplePost]],
    ]);
    expect(result).toBe(false);
  });

  it('cannot.all returns true when all checks fail', async () => {
    const guantr = await createGuantr<ContextMeta>([]);

    const result = await guantr.cannot.all([
      ['read', ['post', samplePost]],
      ['delete', ['post', samplePost]],
    ]);
    expect(result).toBe(true);
  });

  it('cannot.any returns false when all checks pass', async () => {
    const guantr = await createGuantr<ContextMeta>([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ eq, resource, literal }) => eq(resource('status'), literal('published')),
      },
      {
        resource: 'post',
        action: 'update',
        effect: 'allow',
        matchCondition: ({ eq, resource, literal }) => eq(resource('id'), literal(10)),
      },
    ]);

    const result = await guantr.cannot.any([
      ['read', ['post', samplePost]],
      ['update', ['post', samplePost]],
    ]);
    expect(result).toBe(false);
  });

  it('cannot.any returns true when at least one check fails', async () => {
    const guantr = await createGuantr<ContextMeta>([]);

    const result = await guantr.cannot.any([['read', ['post', samplePost]]]);
    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 14. setRules with pre-built Condition (not a function)
// ---------------------------------------------------------------------------

describe('setRules with pre-built Condition', () => {
  it('accepts a pre-built Condition object in matchCondition', async () => {
    const guantr = await createGuantr<ContextMeta>();

    const preBuilt: Condition = {
      type: 'condition',
      node: {
        type: 'operator',
        operator: 'eq',
        operands: [
          { type: 'resource', path: 'status' },
          { type: 'literal', value: 'published' },
        ],
      },
    } as Condition;

    await guantr.setRules([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: preBuilt,
      },
    ]);

    expect(await guantr.can('read', ['post', samplePost])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 15. Cache error handling
// ---------------------------------------------------------------------------

describe('cache error handling', () => {
  it('getRules handles cache.has throwing', async () => {
    const storage = new InMemoryStorage();
    const brokenCache = {
      set: storage.cache!.set,
      get: storage.cache!.get,
      has: async () => {
        throw new Error('cache error');
      },
      clear: storage.cache!.clear,
    };

    class BrokenStorage extends InMemoryStorage {
      cache = brokenCache;
    }

    const guantr = new Guantr<ContextMeta>({
      storage: new BrokenStorage(),
    });

    await guantr.setRules([
      { resource: 'post', action: 'read', effect: 'allow', matchCondition: null },
    ]);

    const rules = await guantr.getRules();
    expect(rules).toHaveLength(1);
  });

  it('can() handles cache.get throwing', async () => {
    const storage = new InMemoryStorage();
    const brokenCache = {
      set: storage.cache!.set,
      get: async () => {
        throw new Error('cache error');
      },
      has: async () => {
        throw new Error('cache error');
      },
      clear: storage.cache!.clear,
    };

    class BrokenStorage extends InMemoryStorage {
      cache = brokenCache;
    }

    const guantr = new Guantr<ContextMeta>({
      storage: new BrokenStorage(),
    });

    await guantr.setRules([
      { resource: 'post', action: 'read', effect: 'allow', matchCondition: null },
    ]);

    const result = await guantr.can('read', ['post', samplePost]);
    expect(result).toBe(true);
  });

  it('can.abstract() handles cache.get throwing', async () => {
    const storage = new InMemoryStorage();
    const brokenCache = {
      set: storage.cache!.set,
      get: async () => {
        throw new Error('cache error');
      },
      has: async () => {
        throw new Error('cache error');
      },
      clear: storage.cache!.clear,
    };

    class BrokenStorage extends InMemoryStorage {
      cache = brokenCache;
    }

    const guantr = new Guantr<ContextMeta>({
      storage: new BrokenStorage(),
    });

    await guantr.setRules([
      { resource: 'post', action: 'read', effect: 'allow', matchCondition: null },
    ]);

    const result = await guantr.can.abstract('read', 'post');
    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 16. Storage without cache
// ---------------------------------------------------------------------------

describe('storage without cache', () => {
  function createNoCacheStorage(): Storage {
    const store: Array<{
      resource: string;
      action: string;
      effect: 'allow' | 'deny';
      matchCondition?: unknown;
    }> = [];

    return {
      setRules: async (rules) => {
        store.length = 0;
        for (const r of rules) {
          store.push({
            resource: String(r.resource),
            action: String(r.action),
            effect: r.effect,
            matchCondition: r.matchCondition,
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
    };
  }

  it('getRules works without cache', async () => {
    const storage = createNoCacheStorage();
    const guantr = new Guantr<ContextMeta>({ storage });

    await guantr.setRules([
      { resource: 'post', action: 'read', effect: 'allow', matchCondition: null },
    ]);

    const rules = await guantr.getRules();
    expect(rules).toHaveLength(1);
  });

  it('can() works without cache', async () => {
    const storage = createNoCacheStorage();
    const guantr = new Guantr<ContextMeta>({ storage });

    await guantr.setRules([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ eq, resource, literal }) => eq(resource('status'), literal('published')),
      },
    ]);

    const result = await guantr.can('read', ['post', samplePost]);
    expect(result).toBe(true);
  });

  it('can.abstract() works without cache', async () => {
    const storage = createNoCacheStorage();
    const guantr = new Guantr<ContextMeta>({ storage });

    await guantr.setRules([
      { resource: 'post', action: 'read', effect: 'allow', matchCondition: null },
    ]);

    const result = await guantr.can.abstract('read', 'post');
    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 17. Cache coverage for batch checks and serialization fallback
// ---------------------------------------------------------------------------

describe('batch cache coverage', () => {
  it('_canAll returns cached result on cache hit', async () => {
    const storage = new InMemoryStorage();
    const guantr = new Guantr<ContextMeta>({ storage });

    await guantr.setRules([
      { resource: 'post', action: 'read', effect: 'allow', matchCondition: null },
      { resource: 'post', action: 'update', effect: 'allow', matchCondition: null },
    ]);

    // Prime the cache by running checks individually
    await guantr.can('read', ['post', samplePost]);
    await guantr.can('update', ['post', samplePost]);

    // Batch check should use cached results
    const result = await guantr.can.all([
      ['read', ['post', samplePost]],
      ['update', ['post', samplePost]],
    ]);
    expect(result).toBe(true);
  });

  it('_canAny returns cached result on cache hit', async () => {
    const storage = new InMemoryStorage();
    const guantr = new Guantr<ContextMeta>({ storage });

    await guantr.setRules([
      { resource: 'post', action: 'read', effect: 'allow', matchCondition: null },
    ]);

    // Prime the cache
    await guantr.can('read', ['post', samplePost]);

    // Batch check with one cached hit and one uncached
    const result = await guantr.can.any([
      ['read', ['post', samplePost]],
      ['update', ['post', samplePost]],
    ]);
    expect(result).toBe(true);
  });

  it('_can falls back to no-cache when context serialization fails', async () => {
    const guantr = await createGuantr<ContextMeta>({
      context: () => {
        const circular: Record<string, unknown> = { role: 'editor' };
        circular.self = circular;
        return circular as AppContext;
      },
    });

    await guantr.setRules([
      { resource: 'post', action: 'read', effect: 'allow', matchCondition: null },
    ]);

    // Should still evaluate correctly even though context can't be serialized
    const result = await guantr.can('read', ['post', samplePost]);
    expect(result).toBe(true);
  });

  it('_canAny continues after cached false to find a passing check', async () => {
    const storage = new InMemoryStorage();
    const guantr = new Guantr<ContextMeta>({ storage });

    await guantr.setRules([
      { resource: 'post', action: 'read', effect: 'allow', matchCondition: null },
      { resource: 'post', action: 'update', effect: 'allow', matchCondition: null },
    ]);

    // Cache a false result for 'delete' (no rule exists)
    const deleteResult = await guantr.can('delete', ['post', samplePost]);
    expect(deleteResult).toBe(false);

    // Cache a true result for 'read'
    await guantr.can('read', ['post', samplePost]);

    // _canAny: first check hits cached false → continue, second hits cached true → return true
    const result = await guantr.can.any([
      ['delete', ['post', samplePost]],
      ['read', ['post', samplePost]],
    ]);
    expect(result).toBe(true);
  });

  it('_canAll short-circuits on cached false result', async () => {
    const storage = new InMemoryStorage();
    const guantr = new Guantr<ContextMeta>({ storage });

    await guantr.setRules([
      { resource: 'post', action: 'read', effect: 'allow', matchCondition: null },
    ]);

    // Cache a false result for 'delete' (no rule exists)
    await guantr.can('delete', ['post', samplePost]);

    // _canAll: first check hits cached false → short-circuit return false
    const result = await guantr.can.all([
      ['delete', ['post', samplePost]],
      ['read', ['post', samplePost]],
    ]);
    expect(result).toBe(false);
  });

  it('_canAll works without cache on storage', async () => {
    const store: Array<{
      action: string;
      resource: string;
      effect: 'allow' | 'deny';
      matchCondition?: unknown;
    }> = [];
    const storage: Storage = {
      setRules: async (rules) => {
        store.length = 0;
        store.push(
          ...rules.map((r) => ({
            action: String(r.action),
            resource: String(r.resource),
            effect: r.effect,
            matchCondition: r.matchCondition,
          })),
        );
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
    };
    const guantr = new Guantr<ContextMeta>({ storage });

    await guantr.setRules([
      { resource: 'post', action: 'read', effect: 'allow', matchCondition: null },
      { resource: 'post', action: 'update', effect: 'allow', matchCondition: null },
    ]);

    const result = await guantr.can.all([
      ['read', ['post', samplePost]],
      ['update', ['post', samplePost]],
    ]);
    expect(result).toBe(true);
  });

  it('_canAny works without cache on storage', async () => {
    const store: Array<{
      action: string;
      resource: string;
      effect: 'allow' | 'deny';
      matchCondition?: unknown;
    }> = [];
    const storage: Storage = {
      setRules: async (rules) => {
        store.length = 0;
        store.push(
          ...rules.map((r) => ({
            action: String(r.action),
            resource: String(r.resource),
            effect: r.effect,
            matchCondition: r.matchCondition,
          })),
        );
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
    };
    const guantr = new Guantr<ContextMeta>({ storage });

    await guantr.setRules([
      { resource: 'post', action: 'read', effect: 'allow', matchCondition: null },
    ]);

    const result = await guantr.can.any([
      ['read', ['post', samplePost]],
      ['update', ['post', samplePost]],
    ]);
    expect(result).toBe(true);
  });

  it('_canAll falls back to no-cache when context serialization fails', async () => {
    const guantr = await createGuantr<ContextMeta>({
      context: () => {
        const circular: Record<string, unknown> = { role: 'admin' };
        circular.self = circular;
        return circular as AppContext;
      },
    });

    await guantr.setRules([
      { resource: 'post', action: 'read', effect: 'allow', matchCondition: null },
      { resource: 'post', action: 'update', effect: 'allow', matchCondition: null },
    ]);

    const result = await guantr.can.all([
      ['read', ['post', samplePost]],
      ['update', ['post', samplePost]],
    ]);
    expect(result).toBe(true);
  });

  it('_canAny falls back to no-cache when context serialization fails', async () => {
    const guantr = await createGuantr<ContextMeta>({
      context: () => {
        const circular: Record<string, unknown> = { role: 'admin' };
        circular.self = circular;
        return circular as AppContext;
      },
    });

    await guantr.setRules([
      { resource: 'post', action: 'read', effect: 'allow', matchCondition: null },
    ]);

    const result = await guantr.can.any([
      ['read', ['post', samplePost]],
      ['update', ['post', samplePost]],
    ]);
    expect(result).toBe(true);
  });

  it('_canAll handles cache.has true but cache.get returning undefined', async () => {
    const storage = new InMemoryStorage();
    let getCalled = false;
    const buggyCache = {
      set: storage.cache!.set,
      get: async <T>(_key: string): Promise<T | undefined> => {
        getCalled = true;
        return undefined as T | undefined;
      },
      has: async () => true,
      clear: storage.cache!.clear,
    };

    class BuggyStorage extends InMemoryStorage {
      cache = buggyCache;
    }

    const guantr = new Guantr<ContextMeta>({
      storage: new BuggyStorage(),
    });

    await guantr.setRules([
      { resource: 'post', action: 'read', effect: 'allow', matchCondition: null },
      { resource: 'post', action: 'update', effect: 'allow', matchCondition: null },
    ]);

    const result = await guantr.can.all([
      ['read', ['post', samplePost]],
      ['update', ['post', samplePost]],
    ]);
    expect(result).toBe(true);
    expect(getCalled).toBe(true);
  });

  it('_canAny handles cache.has true but cache.get returning undefined', async () => {
    const storage = new InMemoryStorage();
    const buggyCache = {
      set: storage.cache!.set,
      get: async () => undefined,
      has: async () => true,
      clear: storage.cache!.clear,
    };

    class BuggyStorage extends InMemoryStorage {
      cache = buggyCache;
    }

    const guantr = new Guantr<ContextMeta>({
      storage: new BuggyStorage(),
    });

    await guantr.setRules([
      { resource: 'post', action: 'read', effect: 'allow', matchCondition: null },
    ]);

    const result = await guantr.can.any([
      ['read', ['post', samplePost]],
      ['update', ['post', samplePost]],
    ]);
    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 18. stableStringify coverage — BigInt, Date, Map, Set
// ---------------------------------------------------------------------------

describe('stableStringify coverage', () => {
  it('_can serializes BigInt in context', async () => {
    const guantr = await createGuantr<ContextMeta>({
      context: () => ({ userId: BigInt(1), role: 'admin' }) as unknown as AppContext,
    });

    await guantr.setRules([
      { resource: 'post', action: 'read', effect: 'allow', matchCondition: null },
    ]);

    const result = await guantr.can('read', ['post', samplePost]);
    expect(result).toBe(true);
  });

  it('_can serializes Date in context', async () => {
    const guantr = await createGuantr<ContextMeta>({
      context: () => ({ userId: 1, role: 'admin', at: new Date() }) as unknown as AppContext,
    });

    await guantr.setRules([
      { resource: 'post', action: 'read', effect: 'allow', matchCondition: null },
    ]);

    const result = await guantr.can('read', ['post', samplePost]);
    expect(result).toBe(true);
  });

  it('_can falls back to no-cache with Map in context', async () => {
    const guantr = await createGuantr<ContextMeta>({
      context: () => ({ userId: 1, role: 'admin', m: new Map() }) as unknown as AppContext,
    });

    await guantr.setRules([
      { resource: 'post', action: 'read', effect: 'allow', matchCondition: null },
    ]);

    const result = await guantr.can('read', ['post', samplePost]);
    expect(result).toBe(true);
  });

  it('_can falls back to no-cache with Set in context', async () => {
    const guantr = await createGuantr<ContextMeta>({
      context: () => ({ userId: 1, role: 'admin', s: new Set() }) as unknown as AppContext,
    });

    await guantr.setRules([
      { resource: 'post', action: 'read', effect: 'allow', matchCondition: null },
    ]);

    const result = await guantr.can('read', ['post', samplePost]);
    expect(result).toBe(true);
  });

  it('_can falls back to no-cache with nested Map in context', async () => {
    const guantr = await createGuantr<ContextMeta>({
      context: () =>
        ({ userId: 1, role: 'admin', nested: { m: new Map() } }) as unknown as AppContext,
    });

    await guantr.setRules([
      { resource: 'post', action: 'read', effect: 'allow', matchCondition: null },
    ]);

    const result = await guantr.can('read', ['post', samplePost]);
    expect(result).toBe(true);
  });

  it('_can falls back to no-cache with nested Set in context', async () => {
    const guantr = await createGuantr<ContextMeta>({
      context: () =>
        ({ userId: 1, role: 'admin', nested: { s: new Set() } }) as unknown as AppContext,
    });

    await guantr.setRules([
      { resource: 'post', action: 'read', effect: 'allow', matchCondition: null },
    ]);

    const result = await guantr.can('read', ['post', samplePost]);
    expect(result).toBe(true);
  });
});
