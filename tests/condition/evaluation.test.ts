import type { Condition } from '../../src/index';
/**
 * Task 9 — Tests for condition evaluation (AST → runtime boolean).
 *
 * Verifies:
 * 1. Simple conditions evaluate correctly (all operators)
 * 2. Nested conditions evaluate correctly (logical + operator nesting)
 * 3. Context values resolve from the provided context object
 * 4. Nullish values: null, undefined handled correctly
 * 5. Optional paths don't throw on null/undefined intermediates
 * 6. Missing key throws GuantrInvalidConditionKeyError (unless nullish opt-out)
 * 7. All operators produce correct boolean results
 * 8. Logical operators (and, or, not) short-circuit and compose correctly
 * 9. Complex array operators (some, every, none) iterate correctly
 * 10. caseInsensitive option works for string/array operators
 */
import { describe, it, expect } from 'vitest';
import {
  evaluateCondition,
  createMatchConditionBuilder,
  GuantrInvalidConditionKeyError,
} from '../../src/index';

// ---------------------------------------------------------------------------
// Sample types
// ---------------------------------------------------------------------------

type Comment = {
  id: number;
  body: string;
  approved: boolean;
  deleted: boolean;
};

type Post = {
  id: number;
  title: string;
  status: string;
  published: boolean;
  viewCount: number;
  tags: string[];
  scores: number[];
  comments: Comment[];
  metadata: {
    views: number;
    featured: boolean;
  };
  author?: {
    name: string;
    email: string;
  };
  description: string | null;
};

type AppContext = {
  userId: number;
  role: string;
  domain: string;
};

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

function createBuilder() {
  return createMatchConditionBuilder<Post, AppContext>();
}

// Sample resource
const samplePost: Post = {
  id: 1,
  title: 'Hello World',
  status: 'published',
  published: true,
  viewCount: 500,
  tags: ['tech', 'news', 'featured'],
  scores: [10, 20, 30],
  comments: [
    { id: 1, body: 'Great post', approved: true, deleted: false },
    { id: 2, body: 'Needs work', approved: false, deleted: false },
    { id: 3, body: 'Spam content', approved: false, deleted: true },
  ],
  metadata: {
    views: 1000,
    featured: true,
  },
  author: {
    name: 'Alice',
    email: 'alice@example.com',
  },
  description: 'A sample post',
};

const sampleContext: AppContext = {
  userId: 1,
  role: 'editor',
  domain: 'example.com',
};

// ---------------------------------------------------------------------------
// 1. Comparison operators (eq, ne, gt, gte, lt, lte)
// ---------------------------------------------------------------------------

describe('evaluation — comparison operators', () => {
  it('eq returns true when values match', () => {
    const b = createBuilder();
    const cond = b.eq(b.resource('id'), b.literal(1));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('eq returns false when values differ', () => {
    const b = createBuilder();
    const cond = b.eq(b.resource('id'), b.literal(999));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(false);
  });

  it('eq with context', () => {
    const b = createBuilder();
    const cond = b.eq(b.resource('id'), b.context('userId'));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('ne returns false when values match', () => {
    const b = createBuilder();
    const cond = b.ne(b.resource('id'), b.literal(1));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(false);
  });

  it('ne returns true when values differ', () => {
    const b = createBuilder();
    const cond = b.ne(b.resource('id'), b.literal(999));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('gt returns true when left > right', () => {
    const b = createBuilder();
    const cond = b.gt(b.resource('viewCount'), b.literal(100));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('gt returns false when left < right', () => {
    const b = createBuilder();
    const cond = b.gt(b.resource('viewCount'), b.literal(1000));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(false);
  });

  it('gte returns true when equal', () => {
    const b = createBuilder();
    const cond = b.gte(b.resource('viewCount'), b.literal(500));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('lt returns true when left < right', () => {
    const b = createBuilder();
    const cond = b.lt(b.resource('viewCount'), b.literal(1000));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('lte returns true when equal', () => {
    const b = createBuilder();
    const cond = b.lte(b.resource('viewCount'), b.literal(500));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('eq with boolean values', () => {
    const b = createBuilder();
    const cond = b.eq(b.resource('published'), b.literal(true));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('eq with resource ↔ resource', () => {
    const b = createBuilder();
    const cond = b.eq(b.resource('viewCount'), b.resource('id'));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. String operators (contains, startsWith, endsWith)
// ---------------------------------------------------------------------------

describe('evaluation — string operators', () => {
  it('contains returns true when substring found', () => {
    const b = createBuilder();
    const cond = b.contains(b.resource('title'), b.literal('Hello'));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('contains returns false when substring not found', () => {
    const b = createBuilder();
    const cond = b.contains(b.resource('title'), b.literal('xyz'));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(false);
  });

  it('contains case-insensitive', () => {
    const b = createBuilder();
    const cond = b.contains(b.resource('title'), b.literal('hello'), {
      caseInsensitive: true,
    });
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('contains case-insensitive mismatch', () => {
    const b = createBuilder();
    const cond = b.contains(b.resource('title'), b.literal('HELLO'), {
      caseInsensitive: false,
    });
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(false);
  });

  it('startsWith returns true', () => {
    const b = createBuilder();
    const cond = b.startsWith(b.resource('title'), b.literal('Hello'));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('startsWith returns false', () => {
    const b = createBuilder();
    const cond = b.startsWith(b.resource('title'), b.literal('World'));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(false);
  });

  it('startsWith case-insensitive', () => {
    const b = createBuilder();
    const cond = b.startsWith(b.resource('title'), b.literal('hello'), {
      caseInsensitive: true,
    });
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('endsWith returns true', () => {
    const b = createBuilder();
    const cond = b.endsWith(b.resource('title'), b.literal('World'));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('endsWith returns false', () => {
    const b = createBuilder();
    const cond = b.endsWith(b.resource('title'), b.literal('Hello'));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(false);
  });

  it('endsWith case-insensitive', () => {
    const b = createBuilder();
    const cond = b.endsWith(b.resource('title'), b.literal('world'), {
      caseInsensitive: true,
    });
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Array membership operators (in, has, hasSome, hasEvery)
// ---------------------------------------------------------------------------

describe('evaluation — array membership operators', () => {
  it('in returns true when value in array', () => {
    const b = createBuilder();
    const cond = b.in(b.literal('tech'), b.resource('tags'));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('in returns false when value not in array', () => {
    const b = createBuilder();
    const cond = b.in(b.literal('gaming'), b.resource('tags'));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(false);
  });

  it('in with numbers', () => {
    const b = createBuilder();
    const cond = b.in(b.literal(10), b.resource('scores'));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('in case-insensitive', () => {
    const b = createBuilder();
    const cond = b.in(b.literal('TECH'), b.resource('tags'), {
      caseInsensitive: true,
    });
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('has returns true when array contains element', () => {
    const b = createBuilder();
    const cond = b.has(b.resource('tags'), b.literal('featured'));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('has returns false when array does not contain element', () => {
    const b = createBuilder();
    const cond = b.has(b.resource('tags'), b.literal('gaming'));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(false);
  });

  it('has case-insensitive', () => {
    const b = createBuilder();
    const cond = b.has(b.resource('tags'), b.literal('FEATURED'), {
      caseInsensitive: true,
    });
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('hasSome returns true when some elements match', () => {
    const b = createBuilder();
    const cond = b.hasSome(b.resource('tags'), b.literal(['tech', 'gaming']));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('hasSome returns false when no elements match', () => {
    const b = createBuilder();
    const cond = b.hasSome(b.resource('tags'), b.literal(['x', 'y']));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(false);
  });

  it('hasEvery returns true when all elements found', () => {
    const b = createBuilder();
    const cond = b.hasEvery(b.resource('tags'), b.literal(['tech', 'news']));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('hasEvery returns false when not all elements found', () => {
    const b = createBuilder();
    const cond = b.hasEvery(b.resource('tags'), b.literal(['tech', 'gaming']));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. Complex array operators (some, every, none)
// ---------------------------------------------------------------------------

describe('evaluation — complex array operators', () => {
  it('some returns true when at least one element satisfies', () => {
    const b = createBuilder();
    const cond = b.some(b.resource('comments'), ({ eq, resource, literal }) =>
      eq(resource('approved'), literal(true)),
    );
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('some returns false when no elements satisfy', () => {
    const b = createBuilder();
    const cond = b.some(b.resource('comments'), ({ eq, resource, literal }) =>
      eq(resource('id'), literal(999)),
    );
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(false);
  });

  it('every returns true when all elements satisfy', () => {
    const b = createBuilder();
    const cond = b.every(b.resource('comments'), ({ gt, resource, literal }) =>
      gt(resource('id'), literal(0)),
    );
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('every returns false when not all elements satisfy', () => {
    const b = createBuilder();
    const cond = b.every(b.resource('comments'), ({ eq, resource, literal }) =>
      eq(resource('approved'), literal(true)),
    );
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(false);
  });

  it('none returns true when no elements satisfy', () => {
    const b = createBuilder();
    const cond = b.none(b.resource('comments'), ({ eq, resource, literal }) =>
      eq(resource('id'), literal(999)),
    );
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('none returns false when some elements satisfy', () => {
    const b = createBuilder();
    const cond = b.none(b.resource('comments'), ({ eq, resource, literal }) =>
      eq(resource('approved'), literal(true)),
    );
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(false);
  });

  it('some with empty array returns false', () => {
    const emptyPost = { ...samplePost, comments: [] };
    const b = createBuilder();
    const cond = b.some(b.resource('comments'), ({ eq, resource, literal }) =>
      eq(resource('approved'), literal(true)),
    );
    expect(evaluateCondition(cond, emptyPost, sampleContext)).toBe(false);
  });

  it('every with empty array returns false (deny by default)', () => {
    const emptyPost = { ...samplePost, comments: [] };
    const b = createBuilder();
    const cond = b.every(b.resource('comments'), ({ eq, resource, literal }) =>
      eq(resource('approved'), literal(true)),
    );
    expect(evaluateCondition(cond, emptyPost, sampleContext)).toBe(false);
  });

  it('none with empty array returns true', () => {
    const emptyPost = { ...samplePost, comments: [] };
    const b = createBuilder();
    const cond = b.none(b.resource('comments'), ({ eq, resource, literal }) =>
      eq(resource('deleted'), literal(true)),
    );
    expect(evaluateCondition(cond, emptyPost, sampleContext)).toBe(true);
  });

  it('some with non-array returns false', () => {
    const cond = {
      type: 'condition',
      node: {
        type: 'operator',
        operator: 'some',
        operands: [{ type: 'resource' as const, path: 'title' }],
        condition: {
          type: 'condition',
          node: {
            type: 'operator',
            operator: 'eq' as const,
            operands: [
              { type: 'resource' as const, path: 'id' },
              { type: 'literal' as const, value: 1 },
            ],
          },
        },
      },
    } as Condition;
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(false);
  });

  it('some without nested condition returns false', () => {
    const cond: Condition = {
      type: 'condition',
      node: {
        type: 'operator',
        operator: 'some',
        operands: [{ type: 'resource' as const, path: 'comments' }],
      },
    };
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(false);
  });

  it('every without nested condition returns false', () => {
    const cond: Condition = {
      type: 'condition',
      node: {
        type: 'operator',
        operator: 'every',
        operands: [{ type: 'resource' as const, path: 'comments' }],
      },
    };
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(false);
  });

  it('none without nested condition returns true', () => {
    const cond: Condition = {
      type: 'condition',
      node: {
        type: 'operator',
        operator: 'none',
        operands: [{ type: 'resource' as const, path: 'comments' }],
      },
    };
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('some with primitive array elements returns false', () => {
    const cond: Condition = {
      type: 'condition',
      node: {
        type: 'operator',
        operator: 'some',
        operands: [{ type: 'resource' as const, path: 'scores' }],
        condition: {
          type: 'condition',
          node: {
            type: 'operator',
            operator: 'eq' as const,
            operands: [
              { type: 'resource' as const, path: 'id' },
              { type: 'literal' as const, value: 1 },
            ],
          },
        },
      },
    };
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. Logical operators (and, or, not)
// ---------------------------------------------------------------------------

describe('evaluation — logical operators', () => {
  it('and returns true when all conditions true', () => {
    const b = createBuilder();
    const cond = b.and(
      b.eq(b.resource('status'), b.literal('published')),
      b.gt(b.resource('viewCount'), b.literal(0)),
    );
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('and returns false when one condition false', () => {
    const b = createBuilder();
    const cond = b.and(
      b.eq(b.resource('status'), b.literal('published')),
      b.gt(b.resource('viewCount'), b.literal(1000)),
    );
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(false);
  });

  it('empty and returns true', () => {
    const b = createBuilder();
    const cond = b.and();
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('or returns true when one condition true', () => {
    const b = createBuilder();
    const cond = b.or(
      b.eq(b.resource('status'), b.literal('draft')),
      b.eq(b.resource('status'), b.literal('published')),
    );
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('or returns false when all conditions false', () => {
    const b = createBuilder();
    const cond = b.or(
      b.eq(b.resource('status'), b.literal('draft')),
      b.eq(b.resource('status'), b.literal('archived')),
    );
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(false);
  });

  it('empty or returns false', () => {
    const b = createBuilder();
    const cond = b.or();
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(false);
  });

  it('not returns true when condition false', () => {
    const b = createBuilder();
    const cond = b.not(b.eq(b.resource('status'), b.literal('draft')));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('not returns false when condition true', () => {
    const b = createBuilder();
    const cond = b.not(b.eq(b.resource('status'), b.literal('published')));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(false);
  });

  it('nested and(or, not)', () => {
    const b = createBuilder();
    const cond = b.and(
      b.or(
        b.eq(b.resource('status'), b.literal('published')),
        b.eq(b.resource('status'), b.literal('draft')),
      ),
      b.not(b.eq(b.resource('published'), b.literal(false))),
    );
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('not(not(condition))', () => {
    const b = createBuilder();
    const cond = b.not(b.not(b.eq(b.resource('status'), b.literal('published'))));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('and with single condition', () => {
    const b = createBuilder();
    const cond = b.and(b.eq(b.resource('id'), b.literal(1)));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('or with single condition', () => {
    const b = createBuilder();
    const cond = b.or(b.eq(b.resource('id'), b.literal(999)));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 6. Context value resolution
// ---------------------------------------------------------------------------

describe('evaluation — context value resolution', () => {
  it('resolves context value for comparison', () => {
    const b = createBuilder();
    const cond = b.eq(b.resource('id'), b.context('userId'));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('resolves context value for string operator', () => {
    const b = createBuilder();
    const cond = b.startsWith(b.resource('title'), b.context('role'));
    expect(evaluateCondition(cond, samplePost, { ...sampleContext, role: 'Hell' })).toBe(true);
  });

  it('resolves context for array operator', () => {
    const b = createBuilder();
    const cond = b.eq(b.resource('id'), b.context('userId'));
    expect(evaluateCondition(cond, samplePost, { ...sampleContext, userId: 1 })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7. Nullish value handling
// ---------------------------------------------------------------------------

describe('evaluation — nullish values', () => {
  it('eq with null literal matches null resource value', () => {
    const b = createBuilder();
    const postWithNullDesc = { ...samplePost, description: null };
    const cond = b.eq(b.resource('description'), b.literal(null));
    expect(evaluateCondition(cond, postWithNullDesc, sampleContext)).toBe(true);
  });

  it('eq with null literal does not match non-null value', () => {
    const b = createBuilder();
    const cond = b.eq(b.resource('description'), b.literal(null));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(false);
  });

  it('ne with null literal', () => {
    const b = createBuilder();
    const cond = b.ne(b.resource('description'), b.literal(null));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('eq with undefined literal', () => {
    const b = createBuilder();
    const cond = b.eq(b.resource('title'), b.literal(undefined));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 8. Optional path handling
// ---------------------------------------------------------------------------

describe('evaluation — optional paths', () => {
  it('optional path with existing value returns the value', () => {
    const b = createBuilder();
    const cond = b.eq(b.resource('author?.name'), b.literal('Alice'));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('optional path with null author returns undefined', () => {
    const b = createBuilder();
    const postWithoutAuthor = { ...samplePost, author: undefined } as Post;
    const cond = b.eq(b.resource('author?.name'), b.literal('Alice'));
    expect(evaluateCondition(cond, postWithoutAuthor, sampleContext)).toBe(false);
  });

  it('optional path with null author does not throw', () => {
    const b = createBuilder();
    const postWithNullAuthor = { ...samplePost, author: null } as unknown as Post;
    const cond = b.eq(b.resource('author?.name'), b.literal('Alice'));
    expect(evaluateCondition(cond, postWithNullAuthor, sampleContext)).toBe(false);
  });

  it('optional path does not throw when key missing', () => {
    const b = createBuilder();
    const postNoAuthor = { ...samplePost, author: undefined } as Post;
    const cond = b.eq(b.resource('author?.name'), b.literal('Alice'));
    expect(() => evaluateCondition(cond, postNoAuthor, sampleContext)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 9. Missing key throws error
// ---------------------------------------------------------------------------

describe('evaluation — missing key', () => {
  it('throws GuantrInvalidConditionKeyError for missing resource key', () => {
    const cond = {
      type: 'condition',
      node: {
        type: 'operator',
        operator: 'eq',
        operands: [
          { type: 'resource', path: 'nonexistentField' },
          { type: 'literal', value: 'test' },
        ],
      },
    } as Condition;

    expect(() => evaluateCondition(cond, samplePost, sampleContext)).toThrow(
      GuantrInvalidConditionKeyError,
    );
  });

  it('includes the key in error message', () => {
    const cond = {
      type: 'condition',
      node: {
        type: 'operator',
        operator: 'eq',
        operands: [
          { type: 'resource', path: 'bogusPath' },
          { type: 'literal', value: 42 },
        ],
      },
    } as Condition;

    try {
      evaluateCondition(cond, samplePost, sampleContext);
      expect.fail('Expected error was not thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(GuantrInvalidConditionKeyError);
      expect((err as GuantrInvalidConditionKeyError).key).toBe('bogusPath');
    }
  });

  it('throws for missing context key', () => {
    const cond = {
      type: 'condition',
      node: {
        type: 'operator',
        operator: 'eq',
        operands: [
          { type: 'context', path: 'nonexistent' },
          { type: 'literal', value: 'test' },
        ],
      },
    } as Condition;

    expect(() => evaluateCondition(cond, samplePost, sampleContext)).toThrow(
      GuantrInvalidConditionKeyError,
    );
  });

  it('throws when traversing into a primitive value', () => {
    const cond: Condition = {
      type: 'condition',
      node: {
        type: 'operator',
        operator: 'eq',
        operands: [
          { type: 'resource', path: 'title.nonexistent' },
          { type: 'literal', value: 'test' },
        ],
      },
    };

    expect(() => evaluateCondition(cond, samplePost, sampleContext)).toThrow(
      GuantrInvalidConditionKeyError,
    );
  });
});

// ---------------------------------------------------------------------------
// 10. Nullish opt-out
// ---------------------------------------------------------------------------

describe('evaluation — nullish opt-out', () => {
  it('null literal in operands skips key check', () => {
    const b = createBuilder();
    const cond = b.eq(b.resource('description'), b.literal(null));
    const resourceWithoutDesc = {
      id: 1,
      title: 'Hi',
      status: 'published',
      published: true,
      viewCount: 0,
      tags: [],
      scores: [],
      comments: [],
      metadata: { views: 0, featured: false },
    } as unknown as Post;
    expect(() => evaluateCondition(cond, resourceWithoutDesc, sampleContext)).not.toThrow();
  });

  it('undefined literal in operands skips key check', () => {
    const b = createBuilder();
    const cond = b.eq(b.resource('description'), b.literal(undefined));
    const resourceWithoutDesc = {
      id: 1,
      title: 'Hi',
      status: 'published',
      published: true,
      viewCount: 0,
      tags: [],
      scores: [],
      comments: [],
      metadata: { views: 0, featured: false },
    } as unknown as Post;
    expect(() => evaluateCondition(cond, resourceWithoutDesc, sampleContext)).not.toThrow();
  });

  it('nullish opt-out works for ne operator', () => {
    const b = createBuilder();
    const cond = b.ne(b.resource('description'), b.literal(null));
    const resourceWithoutDesc = {
      id: 1,
      title: 'Hi',
      status: 'published',
      published: true,
      viewCount: 0,
      tags: [],
      scores: [],
      comments: [],
      metadata: { views: 0, featured: false },
    } as unknown as Post;
    expect(() => evaluateCondition(cond, resourceWithoutDesc, sampleContext)).not.toThrow();
  });

  it('nullish opt-out does not apply to other conditions', () => {
    const cond: Condition = {
      type: 'condition',
      node: {
        type: 'logical',
        operator: 'or',
        operands: [
          {
            type: 'condition',
            node: {
              type: 'operator',
              operator: 'eq',
              operands: [
                { type: 'resource', path: 'missingKey' },
                { type: 'literal', value: null },
              ],
            },
          },
          {
            type: 'condition',
            node: {
              type: 'operator',
              operator: 'eq',
              operands: [
                { type: 'resource', path: 'anotherMissingKey' },
                { type: 'literal', value: 'test' },
              ],
            },
          },
        ],
      },
    };

    expect(() => evaluateCondition(cond, samplePost, sampleContext)).toThrow(
      GuantrInvalidConditionKeyError,
    );
  });
});

// ---------------------------------------------------------------------------
// 11. Nested path evaluation
// ---------------------------------------------------------------------------

describe('evaluation — nested paths', () => {
  it('evaluates nested resource paths correctly', () => {
    const b = createBuilder();
    const cond = b.eq(b.resource('metadata.views'), b.literal(1000));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('evaluates nested resource paths for boolean', () => {
    const b = createBuilder();
    const cond = b.eq(b.resource('metadata.featured'), b.literal(true));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('throws for deeply nested missing key', () => {
    const cond: Condition = {
      type: 'condition',
      node: {
        type: 'operator',
        operator: 'eq',
        operands: [
          { type: 'resource', path: 'metadata.nonexistent' },
          { type: 'literal', value: 1 },
        ],
      },
    };

    expect(() => evaluateCondition(cond, samplePost, sampleContext)).toThrow(
      GuantrInvalidConditionKeyError,
    );
  });
});

// ---------------------------------------------------------------------------
// 12. Cross-source operand evaluation
// ---------------------------------------------------------------------------

describe('evaluation — cross-source operands', () => {
  it('resource ↔ literal', () => {
    const b = createBuilder();
    const cond = b.eq(b.resource('title'), b.literal('Hello World'));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('resource ↔ context', () => {
    const b = createBuilder();
    const cond = b.eq(b.resource('id'), b.context('userId'));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('context ↔ literal', () => {
    const b = createBuilder();
    const cond = b.eq(b.context('role'), b.literal('editor'));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('resource ↔ resource', () => {
    const b = createBuilder();
    const cond = b.eq(b.resource('viewCount'), b.resource('id'));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 13. Edge cases
// ---------------------------------------------------------------------------

describe('evaluation — edge cases', () => {
  it('empty array literal works with hasSome', () => {
    const b = createBuilder();
    const cond = b.hasSome(b.resource('tags'), b.literal([]));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(false);
  });

  it('empty array literal works with hasEvery', () => {
    const b = createBuilder();
    const cond = b.hasEvery(b.resource('tags'), b.literal([]));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('in with non-array second operand returns false', () => {
    const cond: Condition = {
      type: 'condition',
      node: {
        type: 'operator',
        operator: 'in',
        operands: [
          { type: 'literal', value: 'test' },
          { type: 'literal', value: 'not-an-array' },
        ],
      },
    };
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(false);
  });

  it('has with non-array operand returns false', () => {
    const cond: Condition = {
      type: 'condition',
      node: {
        type: 'operator',
        operator: 'has',
        operands: [
          { type: 'literal', value: 'not-an-array' },
          { type: 'literal', value: 'test' },
        ],
      },
    };
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(false);
  });

  it('hasSome with non-array operand returns false', () => {
    const cond: Condition = {
      type: 'condition',
      node: {
        type: 'operator',
        operator: 'hasSome',
        operands: [
          { type: 'literal', value: 'not-an-array' },
          { type: 'literal', value: ['a'] },
        ],
      },
    };
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(false);
  });

  it('hasEvery with non-array operand returns false', () => {
    const cond: Condition = {
      type: 'condition',
      node: {
        type: 'operator',
        operator: 'hasEvery',
        operands: [
          { type: 'literal', value: 'not-an-array' },
          { type: 'literal', value: ['a'] },
        ],
      },
    };
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(false);
  });

  it('hasSome case-insensitive', () => {
    const b = createBuilder();
    const cond = b.hasSome(b.resource('tags'), b.literal(['TECH', 'GAMING']), {
      caseInsensitive: true,
    });
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('hasEvery case-insensitive', () => {
    const b = createBuilder();
    const cond = b.hasEvery(b.resource('tags'), b.literal(['TECH', 'NEWS']), {
      caseInsensitive: true,
    });
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('startsWith with null resource value (left side null-ish)', () => {
    const b = createBuilder();
    const postWithNullDesc = { ...samplePost, description: null } as Post;
    const cond = b.startsWith(b.resource('description'), b.literal('Hello'));
    expect(evaluateCondition(cond, postWithNullDesc, sampleContext)).toBe(false);
  });

  it('startsWith with null right operand coalesces to empty string', () => {
    const b = createBuilder();
    const cond = b.startsWith(b.resource('title'), b.literal(null));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('endsWith with null resource value (left side null-ish)', () => {
    const b = createBuilder();
    const postWithNullDesc = { ...samplePost, description: null } as Post;
    const cond = b.endsWith(b.resource('description'), b.literal('World'));
    expect(evaluateCondition(cond, postWithNullDesc, sampleContext)).toBe(false);
  });

  it('endsWith with null right operand coalesces to empty string', () => {
    const b = createBuilder();
    const cond = b.endsWith(b.resource('title'), b.literal(null));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('not with empty operands throws', () => {
    const cond: Condition = {
      type: 'condition',
      node: {
        type: 'logical',
        operator: 'not',
        operands: [],
      },
    };
    expect(() => evaluateCondition(cond, samplePost, sampleContext)).toThrow();
  });

  it('contains with null resource value coalesces to empty string', () => {
    const b = createBuilder();
    const cond = b.contains(b.resource('title'), b.literal(null));
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('contains with null left resource value coalesces to empty string', () => {
    const b = createBuilder();
    const postWithNullDesc = { ...samplePost, description: null } as Post;
    const cond = b.contains(b.resource('description'), b.literal('test'));
    expect(evaluateCondition(cond, postWithNullDesc, sampleContext)).toBe(false);
  });

  it('eq with caseInsensitive option (raw condition)', () => {
    const cond: Condition = {
      type: 'condition',
      node: {
        type: 'operator',
        operator: 'eq',
        operands: [
          { type: 'resource', path: 'title' },
          { type: 'literal', value: 'hello world' },
        ],
        options: { caseInsensitive: true },
      },
    };
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });

  it('ne with caseInsensitive option (raw condition)', () => {
    const cond: Condition = {
      type: 'condition',
      node: {
        type: 'operator',
        operator: 'ne',
        operands: [
          { type: 'resource', path: 'title' },
          { type: 'literal', value: 'HELLO WORLD' },
        ],
        options: { caseInsensitive: true },
      },
    };
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(false);
  });

  it('caseInsensitive with non-string values falls back to strict equality', () => {
    const cond: Condition = {
      type: 'condition',
      node: {
        type: 'operator',
        operator: 'eq',
        operands: [
          { type: 'literal', value: 42 },
          { type: 'literal', value: 42 },
        ],
        options: { caseInsensitive: true },
      },
    };
    expect(evaluateCondition(cond, samplePost, sampleContext)).toBe(true);
  });
});
