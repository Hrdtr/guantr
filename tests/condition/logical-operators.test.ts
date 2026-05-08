import type { Condition, LogicalNode, OperatorNode } from '../../src/index';
/**
 * Task 7 — Tests for logical operators (and, or, not).
 *
 * Verifies:
 * 1. Each operator returns a `Condition` with correct AST structure (LogicalNode)
 * 2. Arbitrary nesting of logical operators
 * 3. Combining logical operators with comparison/array/complex operators
 * 4. Edge cases: empty argument lists
 * 5. Type-level return type inference
 * 6. JSON serializability
 * 7. Round-trip serialization
 */
import { describe, it, expect, expectTypeOf } from 'vitest';
import { createMatchConditionBuilder } from '../../src/condition/builder';

// ---------------------------------------------------------------------------
// Sample model & context types
// ---------------------------------------------------------------------------

type Post = {
  id: number;
  title: string;
  status: string;
  published: boolean;
  viewCount: number;
  tags: string[];
};

type AppContext = {
  userId: number;
  role: string;
};

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

function createBuilder() {
  return createMatchConditionBuilder<Post, AppContext>();
}

// ---------------------------------------------------------------------------
// and — logical conjunction
// ---------------------------------------------------------------------------

describe('builder.and()', () => {
  it('returns a Condition with logical and node', () => {
    const b = createBuilder();
    const cond = b.and(
      b.eq(b.resource('status'), b.literal('published')),
      b.gt(b.resource('viewCount'), b.literal(0)),
    );

    expect(cond.type).toBe('condition');
    expect(cond.node.type).toBe('logical');

    const logical = cond.node as LogicalNode;
    expect(logical.operator).toBe('and');
    expect(logical.operands).toHaveLength(2);
    expect(logical.operands[0].type).toBe('condition');
    expect(logical.operands[1].type).toBe('condition');
  });

  it('records correct child conditions', () => {
    const b = createBuilder();
    const cond = b.and(
      b.eq(b.resource('status'), b.literal('published')),
      b.eq(b.resource('published'), b.literal(true)),
    );

    const logical = cond.node as LogicalNode;
    const firstOp = logical.operands[0].node as OperatorNode;
    expect(firstOp.operator).toBe('eq');
    expect(firstOp.operands[0]).toEqual({ type: 'resource', path: 'status' });

    const secondOp = logical.operands[1].node as OperatorNode;
    expect(secondOp.operator).toBe('eq');
    expect(secondOp.operands[0]).toEqual({ type: 'resource', path: 'published' });
  });

  it('works with a single condition', () => {
    const b = createBuilder();
    const cond = b.and(b.eq(b.resource('id'), b.literal(1)));

    const logical = cond.node as LogicalNode;
    expect(logical.operator).toBe('and');
    expect(logical.operands).toHaveLength(1);
  });

  it('works with empty argument list', () => {
    const b = createBuilder();
    const cond = b.and();

    const logical = cond.node as LogicalNode;
    expect(logical.operator).toBe('and');
    expect(logical.operands).toHaveLength(0);
  });

  it('works with many conditions', () => {
    const b = createBuilder();
    const cond = b.and(
      b.eq(b.resource('status'), b.literal('published')),
      b.gt(b.resource('viewCount'), b.literal(0)),
      b.eq(b.resource('published'), b.literal(true)),
      b.ne(b.resource('id'), b.literal(0)),
    );

    const logical = cond.node as LogicalNode;
    expect(logical.operator).toBe('and');
    expect(logical.operands).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// or — logical disjunction
// ---------------------------------------------------------------------------

describe('builder.or()', () => {
  it('returns a Condition with logical or node', () => {
    const b = createBuilder();
    const cond = b.or(
      b.eq(b.resource('status'), b.literal('published')),
      b.eq(b.resource('status'), b.literal('draft')),
    );

    const logical = cond.node as LogicalNode;
    expect(logical.operator).toBe('or');
    expect(logical.operands).toHaveLength(2);
  });

  it('records correct child conditions', () => {
    const b = createBuilder();
    const cond = b.or(
      b.eq(b.resource('status'), b.literal('admin')),
      b.eq(b.resource('status'), b.literal('editor')),
    );

    const logical = cond.node as LogicalNode;
    const firstOp = logical.operands[0].node as OperatorNode;
    expect(firstOp.operator).toBe('eq');

    const secondOp = logical.operands[1].node as OperatorNode;
    expect(secondOp.operator).toBe('eq');
  });

  it('works with a single condition', () => {
    const b = createBuilder();
    const cond = b.or(b.eq(b.resource('id'), b.literal(1)));

    const logical = cond.node as LogicalNode;
    expect(logical.operator).toBe('or');
    expect(logical.operands).toHaveLength(1);
  });

  it('works with empty argument list', () => {
    const b = createBuilder();
    const cond = b.or();

    const logical = cond.node as LogicalNode;
    expect(logical.operator).toBe('or');
    expect(logical.operands).toHaveLength(0);
  });

  it('works with many conditions', () => {
    const b = createBuilder();
    const cond = b.or(
      b.eq(b.resource('status'), b.literal('a')),
      b.eq(b.resource('status'), b.literal('b')),
      b.eq(b.resource('status'), b.literal('c')),
      b.eq(b.resource('status'), b.literal('d')),
      b.eq(b.resource('status'), b.literal('e')),
    );

    const logical = cond.node as LogicalNode;
    expect(logical.operands).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// not — logical negation
// ---------------------------------------------------------------------------

describe('builder.not()', () => {
  it('returns a Condition with logical not node', () => {
    const b = createBuilder();
    const cond = b.not(b.eq(b.resource('status'), b.literal('deleted')));

    const logical = cond.node as LogicalNode;
    expect(logical.operator).toBe('not');
    expect(logical.operands).toHaveLength(1);
  });

  it('records correct child condition', () => {
    const b = createBuilder();
    const cond = b.not(b.eq(b.resource('published'), b.literal(true)));

    const logical = cond.node as LogicalNode;
    const inner = logical.operands[0].node as OperatorNode;
    expect(inner.operator).toBe('eq');
    expect(inner.operands[0]).toEqual({ type: 'resource', path: 'published' });
    expect(inner.operands[1]).toEqual({ type: 'literal', value: true });
  });

  it('works with not(not(...))', () => {
    const b = createBuilder();
    const cond = b.not(b.not(b.eq(b.resource('status'), b.literal('ok'))));

    const logical = cond.node as LogicalNode;
    expect(logical.operator).toBe('not');
    const inner = logical.operands[0].node as LogicalNode;
    expect(inner.operator).toBe('not');
  });
});

// ---------------------------------------------------------------------------
// Arbitrary nesting — and(or(...), not(...))
// ---------------------------------------------------------------------------

describe('logical operators — arbitrary nesting', () => {
  it('and(or(...), not(...))', () => {
    const b = createBuilder();
    const cond = b.and(
      b.or(
        b.eq(b.resource('status'), b.literal('published')),
        b.eq(b.resource('status'), b.literal('draft')),
      ),
      b.not(b.eq(b.resource('published'), b.literal(false))),
    );

    const root = cond.node as LogicalNode;
    expect(root.operator).toBe('and');
    expect(root.operands).toHaveLength(2);

    const firstChild = root.operands[0].node as LogicalNode;
    expect(firstChild.operator).toBe('or');
    expect(firstChild.operands).toHaveLength(2);

    const secondChild = root.operands[1].node as LogicalNode;
    expect(secondChild.operator).toBe('not');
    expect(secondChild.operands).toHaveLength(1);
  });

  it('or(and(...), and(...))', () => {
    const b = createBuilder();
    const cond = b.or(
      b.and(
        b.eq(b.resource('status'), b.literal('published')),
        b.gt(b.resource('viewCount'), b.literal(100)),
      ),
      b.and(
        b.eq(b.resource('status'), b.literal('featured')),
        b.gt(b.resource('viewCount'), b.literal(50)),
      ),
    );

    const root = cond.node as LogicalNode;
    expect(root.operator).toBe('or');
    expect(root.operands).toHaveLength(2);
    expect((root.operands[0].node as LogicalNode).operator).toBe('and');
    expect((root.operands[1].node as LogicalNode).operator).toBe('and');
  });

  it('not(and(...))', () => {
    const b = createBuilder();
    const cond = b.not(
      b.and(
        b.eq(b.resource('status'), b.literal('deleted')),
        b.eq(b.resource('published'), b.literal(false)),
      ),
    );

    const root = cond.node as LogicalNode;
    expect(root.operator).toBe('not');
    const inner = root.operands[0].node as LogicalNode;
    expect(inner.operator).toBe('and');
    expect(inner.operands).toHaveLength(2);
  });

  it('deeply nested — 4 levels', () => {
    const b = createBuilder();
    const cond = b.and(
      b.or(
        b.eq(b.resource('status'), b.literal('a')),
        b.not(b.and(b.eq(b.resource('id'), b.literal(1)), b.eq(b.resource('id'), b.literal(2)))),
      ),
      b.eq(b.resource('published'), b.literal(true)),
    );

    const root = cond.node as LogicalNode;
    expect(root.operator).toBe('and');
    expect(root.operands).toHaveLength(2);

    const orNode = root.operands[0].node as LogicalNode;
    expect(orNode.operator).toBe('or');
    expect(orNode.operands).toHaveLength(2);

    const notNode = orNode.operands[1].node as LogicalNode;
    expect(notNode.operator).toBe('not');

    const andNode = notNode.operands[0].node as LogicalNode;
    expect(andNode.operator).toBe('and');
    expect(andNode.operands).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Combining logical operators with complex array operators
// ---------------------------------------------------------------------------

describe('logical operators + complex array operators', () => {
  it('and with some()', () => {
    type PostWithComments = {
      id: number;
      comments: { approved: boolean; body: string }[];
      status: string;
    };
    const b = createMatchConditionBuilder<PostWithComments, AppContext>();

    const cond = b.and(
      b.eq(b.resource('status'), b.literal('published')),
      b.some(b.resource('comments'), ({ eq, resource, literal }) =>
        eq(resource('approved'), literal(true)),
      ),
    );

    const root = cond.node as LogicalNode;
    expect(root.operator).toBe('and');
    expect(root.operands).toHaveLength(2);

    const secondChild = root.operands[1].node as OperatorNode;
    expect(secondChild.operator).toBe('some');
    expect(secondChild.condition).toBeDefined();
  });

  it('not with some()', () => {
    type PostWithComments = {
      id: number;
      comments: { deleted: boolean }[];
    };
    const b = createMatchConditionBuilder<PostWithComments, AppContext>();

    const cond = b.not(
      b.some(b.resource('comments'), ({ eq, resource, literal }) =>
        eq(resource('deleted'), literal(true)),
      ),
    );

    const root = cond.node as LogicalNode;
    expect(root.operator).toBe('not');
    const inner = root.operands[0].node as OperatorNode;
    expect(inner.operator).toBe('some');
  });

  it('or with every()', () => {
    type PostWithItems = {
      id: number;
      items: { price: number }[];
      isFree: boolean;
    };
    const b = createMatchConditionBuilder<PostWithItems, AppContext>();

    const cond = b.or(
      b.eq(b.resource('isFree'), b.literal(true)),
      b.every(b.resource('items'), ({ gt, resource, literal }) =>
        gt(resource('price'), literal(0)),
      ),
    );

    const root = cond.node as LogicalNode;
    expect(root.operator).toBe('or');
    expect(root.operands).toHaveLength(2);
    expect((root.operands[1].node as OperatorNode).operator).toBe('every');
  });
});

// ---------------------------------------------------------------------------
// Type-level tests
// ---------------------------------------------------------------------------

describe('logical operators — type inference', () => {
  it('and return type is Condition', () => {
    const b = createBuilder();
    const cond = b.and(b.eq(b.resource('id'), b.literal(1)));
    expectTypeOf(cond).toMatchTypeOf<Condition>();
  });

  it('or return type is Condition', () => {
    const b = createBuilder();
    const cond = b.or(b.eq(b.resource('id'), b.literal(1)));
    expectTypeOf(cond).toMatchTypeOf<Condition>();
  });

  it('not return type is Condition', () => {
    const b = createBuilder();
    const cond = b.not(b.eq(b.resource('id'), b.literal(1)));
    expectTypeOf(cond).toMatchTypeOf<Condition>();
  });

  it('empty and return type is Condition', () => {
    const b = createBuilder();
    const cond = b.and();
    expectTypeOf(cond).toMatchTypeOf<Condition>();
  });

  it('empty or return type is Condition', () => {
    const b = createBuilder();
    const cond = b.or();
    expectTypeOf(cond).toMatchTypeOf<Condition>();
  });
});

// ---------------------------------------------------------------------------
// JSON serializability
// ---------------------------------------------------------------------------

describe('logical operators — serializability', () => {
  it('and serializes to JSON', () => {
    const b = createBuilder();
    const cond = b.and(
      b.eq(b.resource('status'), b.literal('published')),
      b.gt(b.resource('viewCount'), b.literal(0)),
    );

    const json = JSON.stringify(cond);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const node = parsed.node as Record<string, unknown>;
    expect(node.type).toBe('logical');
    expect(node.operator).toBe('and');
  });

  it('or serializes to JSON', () => {
    const b = createBuilder();
    const cond = b.or(
      b.eq(b.resource('status'), b.literal('a')),
      b.eq(b.resource('status'), b.literal('b')),
    );

    const json = JSON.stringify(cond);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const node = parsed.node as Record<string, unknown>;
    expect(node.type).toBe('logical');
    expect(node.operator).toBe('or');
  });

  it('not serializes to JSON', () => {
    const b = createBuilder();
    const cond = b.not(b.eq(b.resource('published'), b.literal(false)));

    const json = JSON.stringify(cond);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const node = parsed.node as Record<string, unknown>;
    expect(node.type).toBe('logical');
    expect(node.operator).toBe('not');
  });

  it('nested structure serializes to JSON preserving full tree', () => {
    const b = createBuilder();
    const cond = b.and(
      b.or(
        b.eq(b.resource('status'), b.literal('published')),
        b.eq(b.resource('status'), b.literal('draft')),
      ),
      b.not(b.eq(b.resource('published'), b.literal(false))),
    );

    const json = JSON.stringify(cond);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const node = parsed.node as Record<string, unknown>;
    expect(node.type).toBe('logical');
    expect(node.operator).toBe('and');

    const operands = node.operands as Array<Record<string, unknown>>;
    expect(operands).toHaveLength(2);

    const orNode = operands[0].node as Record<string, unknown>;
    expect(orNode.operator).toBe('or');

    const notNode = operands[1].node as Record<string, unknown>;
    expect(notNode.operator).toBe('not');
  });

  it('round-trip serialization preserves structure', () => {
    const b = createBuilder();
    const cond = b.and(
      b.eq(b.resource('status'), b.literal('published')),
      b.gt(b.resource('viewCount'), b.literal(0)),
    );

    const json = JSON.stringify(cond);
    const parsed = JSON.parse(json);
    const reserialized = JSON.stringify(parsed);
    expect(reserialized).toBe(json);
  });

  it('empty and round-trip', () => {
    const b = createBuilder();
    const cond = b.and();
    const json = JSON.stringify(cond);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const node = parsed.node as Record<string, unknown>;
    expect(node.operator).toBe('and');
    expect(Array.isArray(node.operands)).toBe(true);
    expect(node.operands as unknown[]).toHaveLength(0);
  });

  it('empty or round-trip', () => {
    const b = createBuilder();
    const cond = b.or();
    const json = JSON.stringify(cond);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const node = parsed.node as Record<string, unknown>;
    expect(node.operator).toBe('or');
    expect(Array.isArray(node.operands)).toBe(true);
    expect(node.operands as unknown[]).toHaveLength(0);
  });
});
