import type { Condition, OperatorNode } from '../../src/index';
/**
 * Task 4 — Tests for string operators (contains, startsWith, endsWith).
 *
 * Verifies:
 * 1. Each operator returns a `Condition` with correct AST structure
 * 2. Type-safe operand pairing (non-string operands fail at compile time)
 * 3. Optional `caseInsensitive` option is recorded in AST
 * 4. Operators work with resource, context, and literal refs
 * 5. JSON serializability
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

// ---------------------------------------------------------------------------
// contains
// ---------------------------------------------------------------------------

describe('builder.contains()', () => {
  it('returns a Condition with contains operator and two operands', () => {
    const b = createBuilder();
    const cond = b.contains(b.resource('title'), b.literal('hello'));

    expect(cond.type).toBe('condition');
    expect(cond.node.type).toBe('operator');

    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('contains');
    expect(op.operands).toHaveLength(2);
    expect(op.operands[0]).toEqual({ type: 'resource', path: 'title' });
    expect(op.operands[1]).toEqual({ type: 'literal', value: 'hello' });
  });

  it('works with resource ↔ context', () => {
    const b = createBuilder();
    const cond = b.contains(b.resource('title'), b.context('role'));
    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('contains');
  });

  it('works with context ↔ literal', () => {
    const b = createBuilder();
    const cond = b.contains(b.context('role'), b.literal('admin'));
    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('contains');
  });

  it('works with literal ↔ resource', () => {
    const b = createBuilder();
    const cond = b.contains(b.literal('needle'), b.resource('title'));
    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('contains');
  });

  it('accepts caseInsensitive option', () => {
    const b = createBuilder();
    const cond = b.contains(b.resource('title'), b.literal('HELLO'), {
      caseInsensitive: true,
    });

    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('contains');
    expect(op.options).toEqual({ caseInsensitive: true });
  });

  it('caseInsensitive: false is recorded', () => {
    const b = createBuilder();
    const cond = b.contains(b.resource('title'), b.literal('hello'), {
      caseInsensitive: false,
    });

    const op = cond.node as OperatorNode;
    expect(op.options).toEqual({ caseInsensitive: false });
  });

  it('omits options from AST when not provided', () => {
    const b = createBuilder();
    const cond = b.contains(b.resource('title'), b.literal('hello'));

    const op = cond.node as OperatorNode;
    expect(op.options).toBeUndefined();
  });

  it('type mismatch fails — number operand', () => {
    const b = createBuilder();
    // @ts-expect-error: resource('viewCount') is number, not string
    b.contains(b.resource('viewCount'), b.literal('hello'));
  });

  it('type mismatch fails — number right operand', () => {
    const b = createBuilder();
    // @ts-expect-error: literal(42) is number, not string
    b.contains(b.resource('title'), b.literal(42));
  });

  it('serializes to JSON with options', () => {
    const b = createBuilder();
    const cond = b.contains(b.resource('title'), b.literal('hello'), {
      caseInsensitive: true,
    });

    const json = JSON.stringify(cond);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const node = parsed.node as Record<string, unknown>;

    expect(parsed.type).toBe('condition');
    expect(node.type).toBe('operator');
    expect(node.operator).toBe('contains');
    expect(node.options).toEqual({ caseInsensitive: true });
  });
});

// ---------------------------------------------------------------------------
// startsWith
// ---------------------------------------------------------------------------

describe('builder.startsWith()', () => {
  it('returns a Condition with startsWith operator', () => {
    const b = createBuilder();
    const cond = b.startsWith(b.resource('title'), b.literal('Hello'));

    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('startsWith');
    expect(op.operands).toHaveLength(2);
  });

  it('works with context on right side', () => {
    const b = createBuilder();
    const cond = b.startsWith(b.resource('title'), b.context('domain'));
    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('startsWith');
  });

  it('works with context on left side', () => {
    const b = createBuilder();
    const cond = b.startsWith(b.context('role'), b.literal('admin'));
    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('startsWith');
  });

  it('accepts caseInsensitive option', () => {
    const b = createBuilder();
    const cond = b.startsWith(b.resource('title'), b.literal('hello'), {
      caseInsensitive: true,
    });

    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('startsWith');
    expect(op.options).toEqual({ caseInsensitive: true });
  });

  it('type mismatch fails — number operand', () => {
    const b = createBuilder();
    // @ts-expect-error: resource('viewCount') is number, not string
    b.startsWith(b.resource('viewCount'), b.literal('hello'));
  });

  it('type mismatch fails — boolean operand', () => {
    const b = createBuilder();
    // @ts-expect-error: literal(true) is boolean, not string
    b.startsWith(b.resource('title'), b.literal(true));
  });
});

// ---------------------------------------------------------------------------
// endsWith
// ---------------------------------------------------------------------------

describe('builder.endsWith()', () => {
  it('returns a Condition with endsWith operator', () => {
    const b = createBuilder();
    const cond = b.endsWith(b.resource('title'), b.literal('World'));

    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('endsWith');
    expect(op.operands).toHaveLength(2);
  });

  it('works with context on right side', () => {
    const b = createBuilder();
    const cond = b.endsWith(b.resource('title'), b.context('domain'));
    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('endsWith');
  });

  it('works with literal ↔ resource', () => {
    const b = createBuilder();
    const cond = b.endsWith(b.literal('.com'), b.resource('title'));
    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('endsWith');
  });

  it('accepts caseInsensitive option', () => {
    const b = createBuilder();
    const cond = b.endsWith(b.resource('title'), b.literal('.COM'), {
      caseInsensitive: true,
    });

    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('endsWith');
    expect(op.options).toEqual({ caseInsensitive: true });
  });

  it('type mismatch fails — number operand', () => {
    const b = createBuilder();
    // @ts-expect-error: resource('id') is number, not string
    b.endsWith(b.resource('id'), b.literal('.com'));
  });
});

// ---------------------------------------------------------------------------
// Type-level tests
// ---------------------------------------------------------------------------

describe('string operators — type inference', () => {
  it('contains return type is Condition', () => {
    const b = createBuilder();
    const cond = b.contains(b.resource('title'), b.literal('hello'));
    expectTypeOf(cond).toMatchTypeOf<Condition>();
  });

  it('startsWith return type is Condition', () => {
    const b = createBuilder();
    const cond = b.startsWith(b.resource('title'), b.literal('hello'));
    expectTypeOf(cond).toMatchTypeOf<Condition>();
  });

  it('endsWith return type is Condition', () => {
    const b = createBuilder();
    const cond = b.endsWith(b.resource('title'), b.literal('hello'));
    expectTypeOf(cond).toMatchTypeOf<Condition>();
  });
});
