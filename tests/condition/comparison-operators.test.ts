import type { Condition, OperatorNode } from '../../src/index';
/**
 * Task 3 — Tests for comparison operators (eq, ne, gt, gte, lt, lte).
 *
 * Verifies:
 * 1. Each operator returns a `Condition` with correct AST structure
 * 2. Type-safe operand pairing (mismatched types fail at compile time)
 * 3. Nullish values are accepted for eq/ne
 * 4. Numeric-only operators reject non-numeric operands
 * 5. Operators work with resource, context, and literal refs
 */
import { describe, it, expect, expectTypeOf } from 'vitest';
import { createMatchConditionBuilder } from '../../src/condition/builder';

// ---------------------------------------------------------------------------
// Sample model & context types
// ---------------------------------------------------------------------------

type Post = {
  id: number;
  title: string;
  status: 'draft' | 'published';
  viewCount: number;
  metadata: {
    score: number;
    featured: boolean;
  };
  description: string | null;
};

type AppContext = {
  userId: number;
  role: string;
  limit: number;
};

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

function createBuilder() {
  return createMatchConditionBuilder<Post, AppContext>();
}

// ---------------------------------------------------------------------------
// eq — equality operator
// ---------------------------------------------------------------------------

describe('builder.eq()', () => {
  it('returns a Condition with eq operator and two operands', () => {
    const b = createBuilder();
    const cond = b.eq(b.resource('id'), b.literal(42));

    expect(cond.type).toBe('condition');
    expect(cond.node.type).toBe('operator');

    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('eq');
    expect(op.operands).toHaveLength(2);
    expect(op.operands[0]).toEqual({ type: 'resource', path: 'id' });
    expect(op.operands[1]).toEqual({ type: 'literal', value: 42 });
  });

  it('works with resource ↔ resource', () => {
    const b = createBuilder();
    const cond = b.eq(b.resource('id'), b.resource('viewCount'));
    expect(cond.node.type).toBe('operator');

    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('eq');
  });

  it('works with resource ↔ context', () => {
    const b = createBuilder();
    const cond = b.eq(b.resource('id'), b.context('userId'));
    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('eq');
  });

  it('works with context ↔ literal', () => {
    const b = createBuilder();
    const cond = b.eq(b.context('userId'), b.literal(1));
    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('eq');
  });

  it('works with null literal on right side', () => {
    const b = createBuilder();
    const cond = b.eq(b.resource('description'), b.literal(null));
    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('eq');
    expect(op.operands[1]).toEqual({ type: 'literal', value: null });
  });

  it('works with undefined literal on right side', () => {
    const b = createBuilder();
    const cond = b.eq(b.resource('description'), b.literal(undefined));
    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('eq');
    expect(op.operands[1]).toEqual({ type: 'literal', value: undefined });
  });

  it('works with boolean comparison', () => {
    const b = createBuilder();
    const cond = b.eq(b.resource('metadata.featured'), b.literal(true));
    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('eq');
  });

  it('type mismatch fails — string vs number', () => {
    const b = createBuilder();
    // @ts-expect-error: resource('id') is number, literal('hello') is string
    b.eq(b.resource('id'), b.literal('hello'));
  });

  it('type mismatch fails — number vs boolean', () => {
    const b = createBuilder();
    // @ts-expect-error: resource('id') is number, literal(true) is boolean
    b.eq(b.resource('id'), b.literal(true));
  });

  it('serializes to JSON correctly', () => {
    const b = createBuilder();
    const cond = b.eq(b.resource('title'), b.literal('Hello'));

    const json = JSON.stringify(cond);
    const parsed = JSON.parse(json) as Record<string, unknown>;

    expect(parsed.type).toBe('condition');
    const node = parsed.node as Record<string, unknown>;
    expect(node.type).toBe('operator');
    expect(node.operator).toBe('eq');
    expect(Array.isArray(node.operands)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ne — not-equal operator
// ---------------------------------------------------------------------------

describe('builder.ne()', () => {
  it('returns a Condition with ne operator', () => {
    const b = createBuilder();
    const cond = b.ne(b.resource('id'), b.literal(42));

    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('ne');
    expect(op.operands).toHaveLength(2);
  });

  it('works with resource ↔ context', () => {
    const b = createBuilder();
    const cond = b.ne(b.resource('title'), b.context('role'));
    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('ne');
  });

  it('works with null literal', () => {
    const b = createBuilder();
    const cond = b.ne(b.resource('description'), b.literal(null));
    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('ne');
  });

  it('type mismatch fails — number vs string', () => {
    const b = createBuilder();
    // @ts-expect-error: resource('viewCount') is number, literal('hello') is string
    b.ne(b.resource('viewCount'), b.literal('hello'));
  });
});

// ---------------------------------------------------------------------------
// gt — greater-than operator
// ---------------------------------------------------------------------------

describe('builder.gt()', () => {
  it('returns a Condition with gt operator', () => {
    const b = createBuilder();
    const cond = b.gt(b.resource('viewCount'), b.literal(0));

    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('gt');
    expect(op.operands).toHaveLength(2);
  });

  it('works with resource ↔ resource (both numeric)', () => {
    const b = createBuilder();
    const cond = b.gt(b.resource('viewCount'), b.resource('id'));
    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('gt');
  });

  it('works with resource ↔ context', () => {
    const b = createBuilder();
    const cond = b.gt(b.resource('viewCount'), b.context('limit'));
    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('gt');
  });

  it('works with context ↔ literal', () => {
    const b = createBuilder();
    const cond = b.gt(b.context('limit'), b.literal(10));
    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('gt');
  });

  it('works with metadata numeric paths', () => {
    const b = createBuilder();
    const cond = b.gt(b.resource('metadata.score'), b.literal(50));
    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('gt');
  });

  it('type mismatch fails — string left operand', () => {
    const b = createBuilder();
    // @ts-expect-error: resource('title') is string, not numeric
    b.gt(b.resource('title'), b.literal(5));
  });

  it('type mismatch fails — string right operand', () => {
    const b = createBuilder();
    // @ts-expect-error: literal('hello') is string, not numeric
    b.gt(b.resource('id'), b.literal('hello'));
  });

  it('type mismatch fails — boolean operand', () => {
    const b = createBuilder();
    // @ts-expect-error: literal(true) is boolean, not numeric
    b.gt(b.resource('id'), b.literal(true));
  });
});

// ---------------------------------------------------------------------------
// gte — greater-than-or-equal operator
// ---------------------------------------------------------------------------

describe('builder.gte()', () => {
  it('returns a Condition with gte operator', () => {
    const b = createBuilder();
    const cond = b.gte(b.resource('viewCount'), b.literal(100));

    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('gte');
    expect(op.operands).toHaveLength(2);
  });

  it('works with resource ↔ context', () => {
    const b = createBuilder();
    const cond = b.gte(b.resource('id'), b.context('userId'));
    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('gte');
  });

  it('type mismatch fails — string left operand', () => {
    const b = createBuilder();
    // @ts-expect-error: resource('title') is string, not numeric
    b.gte(b.resource('title'), b.literal(10));
  });
});

// ---------------------------------------------------------------------------
// lt — less-than operator
// ---------------------------------------------------------------------------

describe('builder.lt()', () => {
  it('returns a Condition with lt operator', () => {
    const b = createBuilder();
    const cond = b.lt(b.resource('viewCount'), b.literal(1000));

    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('lt');
    expect(op.operands).toHaveLength(2);
  });

  it('works with context ↔ resource', () => {
    const b = createBuilder();
    const cond = b.lt(b.context('limit'), b.resource('id'));
    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('lt');
  });

  it('type mismatch fails — string operand', () => {
    const b = createBuilder();
    // @ts-expect-error: resource('status') is string, not numeric
    b.lt(b.resource('status'), b.literal(5));
  });
});

// ---------------------------------------------------------------------------
// lte — less-than-or-equal operator
// ---------------------------------------------------------------------------

describe('builder.lte()', () => {
  it('returns a Condition with lte operator', () => {
    const b = createBuilder();
    const cond = b.lte(b.resource('metadata.score'), b.literal(100));

    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('lte');
    expect(op.operands).toHaveLength(2);
  });

  it('works with resource ↔ resource', () => {
    const b = createBuilder();
    const cond = b.lte(b.resource('viewCount'), b.resource('metadata.score'));
    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('lte');
  });

  it('type mismatch fails — string operand', () => {
    const b = createBuilder();
    // @ts-expect-error: resource('title') is string, not numeric
    b.lte(b.resource('title'), b.literal(5));
  });
});

// ---------------------------------------------------------------------------
// Type-level tests
// ---------------------------------------------------------------------------

describe('comparison operators — type inference', () => {
  it('InferValueRef works through eq operands', () => {
    const b = createBuilder();
    const left = b.resource('id');
    const right = b.literal(42);

    // Verify both operands are numeric
    expectTypeOf<(typeof left)['type']>().toEqualTypeOf<'resource'>();
    expectTypeOf<(typeof right)['type']>().toEqualTypeOf<'literal'>();
  });

  it('eq return type is Condition', () => {
    const b = createBuilder();
    const cond = b.eq(b.resource('title'), b.literal('hello'));
    expectTypeOf(cond).toMatchTypeOf<Condition>();
  });

  it('gt return type is Condition', () => {
    const b = createBuilder();
    const cond = b.gt(b.resource('viewCount'), b.literal(10));
    expectTypeOf(cond).toMatchTypeOf<Condition>();
  });

  it('ne return type is Condition', () => {
    const b = createBuilder();
    const cond = b.ne(b.resource('id'), b.literal(99));
    expectTypeOf(cond).toMatchTypeOf<Condition>();
  });
});
