import type { Condition, OperatorNode } from '../../src/index';
/**
 * Task 6 — Tests for complex array operators (some, every, none).
 *
 * Verifies:
 * 1. Each operator returns a `Condition` with correct AST structure
 * 2. The nested condition is recorded inside `OperatorNode.condition`
 * 3. Type-safe operand pairing (array element type flows to nested builder)
 * 4. Type mismatch with primitive arrays fails at compile time
 * 5. JSON serializability of conditions with nested operators
 * 6. Multiple nesting levels
 */
import { describe, it, expect, expectTypeOf } from 'vitest';
import { createMatchConditionBuilder } from '../../src/condition/builder';

// ---------------------------------------------------------------------------
// Sample model & context types
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
  comments: Comment[];
  tags: string[];
  scores: number[];
};

type AppContext = {
  userId: number;
  domain: string;
};

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

function createBuilder() {
  return createMatchConditionBuilder<Post, AppContext>();
}

// ---------------------------------------------------------------------------
// some — at least one element satisfies nested condition
// ---------------------------------------------------------------------------

describe('builder.some()', () => {
  it('returns a Condition with some operator and nested condition', () => {
    const b = createBuilder();
    const cond = b.some(b.resource('comments'), ({ eq, resource, literal }) =>
      eq(resource('approved'), literal(true)),
    );

    expect(cond.type).toBe('condition');
    expect(cond.node.type).toBe('operator');

    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('some');
    expect(op.operands).toHaveLength(1);
    expect(op.operands[0]).toEqual({ type: 'resource', path: 'comments' });

    expect(op.condition).toBeDefined();
    const nestedNode = op.condition!.node as OperatorNode;
    expect(nestedNode.operator).toBe('eq');
    expect(nestedNode.operands).toHaveLength(2);
    expect(nestedNode.operands[0]).toEqual({ type: 'resource', path: 'approved' });
    expect(nestedNode.operands[1]).toEqual({ type: 'literal', value: true });
  });

  it('works with deeply nested some-inside-some', () => {
    // NOTE: This test uses nested `some` to verify deeply nested conditions
    // without depending on `and`/`or` (Task 7).
    //
    // Model for this test:
    type NestedPost = { id: number; comments: { replies: { approved: boolean }[] }[] };
    const nb = createMatchConditionBuilder<NestedPost, AppContext>();

    const cond = nb.some(
      nb.resource('comments'),
      ({ some: s2, eq: _eq, resource, literal: _lit }) =>
        s2(resource('replies'), ({ eq: eq2, resource: r2, literal: l2 }) =>
          eq2(r2('approved'), l2(true)),
        ),
    );

    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('some');
    expect(op.condition).toBeDefined();
    const inner = op.condition!.node as OperatorNode;
    expect(inner.operator).toBe('some');
    expect(inner.condition).toBeDefined();
    const deepest = inner.condition!.node as OperatorNode;
    expect(deepest.operator).toBe('eq');
  });

  it('works with more complex nested equality checks', () => {
    const b = createBuilder();
    const cond = b.some(b.resource('comments'), ({ eq, resource, literal }) =>
      eq(resource('id'), literal(1)),
    );

    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('some');
    const nestedNode = op.condition!.node as OperatorNode;
    expect(nestedNode.operator).toBe('eq');
    expect(nestedNode.operands[0]).toEqual({ type: 'resource', path: 'id' });
    expect(nestedNode.operands[1]).toEqual({ type: 'literal', value: 1 });
  });

  it('type mismatch fails — primitive array passed to some', () => {
    const b = createBuilder();
    // @ts-expect-error: tags is string[], not Record<string, unknown>[]
    b.some(b.resource('tags'), (builder) => builder.eq(builder.literal(1), builder.literal(1)));
  });
});

// ---------------------------------------------------------------------------
// every — all elements satisfy nested condition
// ---------------------------------------------------------------------------

describe('builder.every()', () => {
  it('returns a Condition with every operator and nested condition', () => {
    const b = createBuilder();
    const cond = b.every(b.resource('comments'), ({ eq, resource, literal }) =>
      eq(resource('approved'), literal(true)),
    );

    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('every');
    expect(op.operands).toHaveLength(1);
    expect(op.operands[0]).toEqual({ type: 'resource', path: 'comments' });

    expect(op.condition).toBeDefined();
    const nestedNode = op.condition!.node as OperatorNode;
    expect(nestedNode.operator).toBe('eq');
    expect(nestedNode.operands[0]).toEqual({ type: 'resource', path: 'approved' });
    expect(nestedNode.operands[1]).toEqual({ type: 'literal', value: true });
  });

  it('works with nested comparison operator', () => {
    const b = createBuilder();
    const cond = b.every(b.resource('comments'), ({ gt, resource, literal }) =>
      gt(resource('id'), literal(0)),
    );

    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('every');
    const nestedNode = op.condition!.node as OperatorNode;
    expect(nestedNode.operator).toBe('gt');
    expect(nestedNode.operands[0]).toEqual({ type: 'resource', path: 'id' });
    expect(nestedNode.operands[1]).toEqual({ type: 'literal', value: 0 });
  });

  it('works with deeply nested every-inside-every', () => {
    type NestedPost = { id: number; comments: { replies: { approved: boolean }[] }[] };
    const nb = createMatchConditionBuilder<NestedPost, AppContext>();

    const cond = nb.every(
      nb.resource('comments'),
      ({ every: e2, eq: _eq, resource, literal: _lit }) =>
        e2(resource('replies'), ({ eq: eq2, resource: r2, literal: l2 }) =>
          eq2(r2('approved'), l2(true)),
        ),
    );

    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('every');
    expect(op.condition).toBeDefined();
    expect(op.condition!.node.type).toBe('operator');
  });

  it('type mismatch fails — primitive array passed to every', () => {
    const b = createBuilder();
    // @ts-expect-error: scores is number[], not Record<string, unknown>[]
    b.every(b.resource('scores'), (builder) => builder.eq(builder.literal(1), builder.literal(1)));
  });
});

// ---------------------------------------------------------------------------
// none — no element satisfies nested condition
// ---------------------------------------------------------------------------

describe('builder.none()', () => {
  it('returns a Condition with none operator and nested condition', () => {
    const b = createBuilder();
    const cond = b.none(b.resource('comments'), ({ eq, resource, literal }) =>
      eq(resource('deleted'), literal(true)),
    );

    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('none');
    expect(op.operands).toHaveLength(1);
    expect(op.operands[0]).toEqual({ type: 'resource', path: 'comments' });

    expect(op.condition).toBeDefined();
    const nestedNode = op.condition!.node as OperatorNode;
    expect(nestedNode.operator).toBe('eq');
    expect(nestedNode.operands[0]).toEqual({ type: 'resource', path: 'deleted' });
    expect(nestedNode.operands[1]).toEqual({ type: 'literal', value: true });
  });

  it('works with string comparison in nested condition', () => {
    const b = createBuilder();
    const cond = b.none(b.resource('comments'), ({ contains, resource, literal }) =>
      contains(resource('body'), literal('spam')),
    );

    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('none');
    const nestedNode = op.condition!.node as OperatorNode;
    expect(nestedNode.operator).toBe('contains');
  });

  it('works with deeply nested none-inside-none', () => {
    type NestedPost = { id: number; comments: { replies: { deleted: boolean }[] }[] };
    const nb = createMatchConditionBuilder<NestedPost, AppContext>();

    const cond = nb.none(
      nb.resource('comments'),
      ({ none: n2, eq: _eq, resource, literal: _lit }) =>
        n2(resource('replies'), ({ eq: eq2, resource: r2, literal: l2 }) =>
          eq2(r2('deleted'), l2(true)),
        ),
    );

    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('none');
    expect(op.condition).toBeDefined();
    expect(op.condition!.node.type).toBe('operator');
  });

  it('type mismatch fails — primitive array passed to none', () => {
    const b = createBuilder();
    // @ts-expect-error: scores is number[], not Record<string, unknown>[]
    b.none(b.resource('scores'), (builder) => builder.eq(builder.literal(1), builder.literal(1)));
  });
});

// ---------------------------------------------------------------------------
// Type-level tests
// ---------------------------------------------------------------------------

describe('complex array operators — type inference', () => {
  it('some return type is Condition', () => {
    const b = createBuilder();
    const cond = b.some(b.resource('comments'), ({ eq, resource, literal }) =>
      eq(resource('approved'), literal(true)),
    );
    expectTypeOf(cond).toMatchTypeOf<Condition>();
  });

  it('every return type is Condition', () => {
    const b = createBuilder();
    const cond = b.every(b.resource('comments'), ({ eq, resource, literal }) =>
      eq(resource('approved'), literal(true)),
    );
    expectTypeOf(cond).toMatchTypeOf<Condition>();
  });

  it('none return type is Condition', () => {
    const b = createBuilder();
    const cond = b.none(b.resource('comments'), ({ eq, resource, literal }) =>
      eq(resource('deleted'), literal(true)),
    );
    expectTypeOf(cond).toMatchTypeOf<Condition>();
  });
});

// ---------------------------------------------------------------------------
// JSON serializability
// ---------------------------------------------------------------------------

describe('complex array operators — serializability', () => {
  it('some with nested eq serializes to JSON', () => {
    const b = createBuilder();
    const cond = b.some(b.resource('comments'), ({ eq, resource, literal }) =>
      eq(resource('approved'), literal(true)),
    );
    const json = JSON.stringify(cond);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const node = parsed.node as Record<string, unknown>;
    expect(node.operator).toBe('some');
    expect(node.condition).toBeDefined();
    const nested = node.condition as Record<string, unknown>;
    const nestedNode = nested.node as Record<string, unknown>;
    expect(nestedNode.operator).toBe('eq');
  });

  it('every with nested condition serializes to JSON', () => {
    const b = createBuilder();
    const cond = b.every(b.resource('comments'), ({ gt, resource, literal }) =>
      gt(resource('id'), literal(0)),
    );
    const json = JSON.stringify(cond);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const node = parsed.node as Record<string, unknown>;
    expect(node.operator).toBe('every');
    expect(node.condition).toBeDefined();
  });

  it('none with nested condition serializes to JSON', () => {
    const b = createBuilder();
    const cond = b.none(b.resource('comments'), ({ eq, resource, literal }) =>
      eq(resource('deleted'), literal(true)),
    );
    const json = JSON.stringify(cond);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const node = parsed.node as Record<string, unknown>;
    expect(node.operator).toBe('none');
    expect(node.condition).toBeDefined();
  });

  it('some with nested some serializes to JSON preserving full structure', () => {
    type NestedPost = { id: number; comments: { replies: { approved: boolean }[] }[] };
    const nb = createMatchConditionBuilder<NestedPost, AppContext>();

    const cond = nb.some(
      nb.resource('comments'),
      ({ some: s2, eq: _eq, resource, literal: _lit }) =>
        s2(resource('replies'), ({ eq: eq2, resource: r2, literal: l2 }) =>
          eq2(r2('approved'), l2(true)),
        ),
    );

    const json = JSON.stringify(cond);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const node = parsed.node as Record<string, unknown>;
    expect(node.operator).toBe('some');
    const nested = node.condition as Record<string, unknown>;
    const nestedNode = nested.node as Record<string, unknown>;
    expect(nestedNode.operator).toBe('some');
    const nestedOp = nestedNode as Record<string, unknown>;
    const inner = nestedOp.condition as Record<string, unknown>;
    const innerNode = inner.node as Record<string, unknown>;
    expect(innerNode.operator).toBe('eq');
  });

  it('round-trip serialization preserves structure', () => {
    const b = createBuilder();
    const cond = b.some(b.resource('comments'), ({ eq, resource, literal }) =>
      eq(resource('approved'), literal(true)),
    );
    const json = JSON.stringify(cond);
    const parsed = JSON.parse(json);
    const reserialized = JSON.stringify(parsed);
    expect(reserialized).toBe(json);
  });
});

// ---------------------------------------------------------------------------
// Nested condition type safety — inside some/every/none, resource paths
// refer to the array element type, not the outer model
// ---------------------------------------------------------------------------

describe('complex array operators — nested builder scope', () => {
  it('nested resource() resolves to array item fields', () => {
    const b = createBuilder();
    b.some(b.resource('comments'), ({ eq, resource, literal }) =>
      // 'approved' exists on Comment, should compile
      eq(resource('approved'), literal(true)),
    );
  });

  it('nested resource() rejects outer model fields', () => {
    const b = createBuilder();
    b.some(b.resource('comments'), ({ eq, resource, literal }) =>
      // @ts-expect-error: 'title' exists on Post, not on Comment
      eq(resource('title'), literal('hello')),
    );
  });

  it('nested resource() rejects invalid paths', () => {
    const b = createBuilder();
    b.some(b.resource('comments'), ({ eq, resource, literal }) =>
      // @ts-expect-error: 'bogus' does not exist on Comment
      eq(resource('bogus'), literal(true)),
    );
  });
});
