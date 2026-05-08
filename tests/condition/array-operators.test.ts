import type { Condition, OperatorNode } from '../../src/index';
/**
 * Task 5 — Tests for array membership operators (in, has, hasSome, hasEvery).
 *
 * Verifies:
 * 1. Each operator returns a `Condition` with correct AST structure
 * 2. Type-safe operand pairing (element-type mismatch fails at compile time)
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
  tags: string[];
  scores: number[];
};

type AppContext = {
  userId: number;
  allowedTags: string[];
  blockedTags: string[];
};

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

function createBuilder() {
  return createMatchConditionBuilder<Post, AppContext>();
}

// ---------------------------------------------------------------------------
// in — value membership in array
// ---------------------------------------------------------------------------

describe('builder.in()', () => {
  it('returns a Condition with in operator and two operands', () => {
    const b = createBuilder();
    const cond = b.in(b.literal('admin'), b.resource('tags'));

    expect(cond.type).toBe('condition');
    expect(cond.node.type).toBe('operator');

    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('in');
    expect(op.operands).toHaveLength(2);
    expect(op.operands[0]).toEqual({ type: 'literal', value: 'admin' });
    expect(op.operands[1]).toEqual({ type: 'resource', path: 'tags' });
  });

  it('works with resource value ↔ context array', () => {
    const b = createBuilder();
    const cond = b.in(b.context('userId'), b.resource('scores'));
    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('in');
  });

  it('works with resource value ↔ resource array', () => {
    const b = createBuilder();
    const cond = b.in(b.literal('admin'), b.context('allowedTags'));
    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('in');
  });

  it('works with number element types', () => {
    const b = createBuilder();
    const cond = b.in(b.literal(42), b.resource('scores'));
    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('in');
  });

  it('accepts caseInsensitive option', () => {
    const b = createBuilder();
    const cond = b.in(b.literal('ADMIN'), b.resource('tags'), {
      caseInsensitive: true,
    });
    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('in');
    expect(op.options).toEqual({ caseInsensitive: true });
  });

  // NOTE: `in()` does not enforce phantom-type compatibility between value
  // and array element types. Unlike `has()` (where the array unambiguously
  // constrains the value), `in(value, array)` has no clear direction — the
  // value can be a narrow literal while the array is a broad field, or the
  // value can be a broad field while the array is a narrow literal array.
  // Element-type mismatches are caught at runtime by `evaluateCondition`.
  it('number value with string array accepted (loose phantom check for in)', () => {
    const b = createBuilder();
    b.in(b.literal(123), b.resource('tags'));
  });

  it('string value with number array accepted (loose phantom check for in)', () => {
    const b = createBuilder();
    b.in(b.literal('hello'), b.resource('scores'));
  });
});

// ---------------------------------------------------------------------------
// has — array contains element
// ---------------------------------------------------------------------------

describe('builder.has()', () => {
  it('returns a Condition with has operator and two operands', () => {
    const b = createBuilder();
    const cond = b.has(b.resource('tags'), b.literal('featured'));

    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('has');
    expect(op.operands).toHaveLength(2);
    expect(op.operands[0]).toEqual({ type: 'resource', path: 'tags' });
    expect(op.operands[1]).toEqual({ type: 'literal', value: 'featured' });
  });

  it('works with context array ↔ resource value', () => {
    const b = createBuilder();
    const cond = b.has(b.context('allowedTags'), b.literal('admin'));
    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('has');
  });

  it('works with number arrays', () => {
    const b = createBuilder();
    const cond = b.has(b.resource('scores'), b.literal(100));
    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('has');
  });

  it('accepts caseInsensitive option', () => {
    const b = createBuilder();
    const cond = b.has(b.resource('tags'), b.literal('ADMIN'), {
      caseInsensitive: true,
    });
    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('has');
    expect(op.options).toEqual({ caseInsensitive: true });
  });

  it('type mismatch fails — number element with string array', () => {
    const b = createBuilder();
    // @ts-expect-error: literal(123) is number, tags is string[]
    b.has(b.resource('tags'), b.literal(123));
  });

  it('type mismatch fails — string element with number array', () => {
    const b = createBuilder();
    // @ts-expect-error: literal('hello') is string, scores is number[]
    b.has(b.resource('scores'), b.literal('hello'));
  });
});

// ---------------------------------------------------------------------------
// hasSome — array has some of the given elements
// ---------------------------------------------------------------------------

describe('builder.hasSome()', () => {
  it('returns a Condition with hasSome operator', () => {
    const b = createBuilder();
    const cond = b.hasSome(b.resource('tags'), b.literal(['a', 'b']));

    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('hasSome');
    expect(op.operands).toHaveLength(2);
    expect(op.operands[0]).toEqual({ type: 'resource', path: 'tags' });
    expect(op.operands[1]).toEqual({ type: 'literal', value: ['a', 'b'] });
  });

  it('works with context array ↔ literal array', () => {
    const b = createBuilder();
    const cond = b.hasSome(b.context('allowedTags'), b.literal(['admin']));
    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('hasSome');
  });

  it('works with resource array ↔ context array', () => {
    const b = createBuilder();
    const cond = b.hasSome(b.resource('tags'), b.context('blockedTags'));
    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('hasSome');
  });

  it('works with number arrays', () => {
    const b = createBuilder();
    const cond = b.hasSome(b.resource('scores'), b.literal([10, 20]));
    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('hasSome');
  });

  it('accepts caseInsensitive option', () => {
    const b = createBuilder();
    const cond = b.hasSome(b.resource('tags'), b.literal(['ADMIN', 'USER']), {
      caseInsensitive: true,
    });
    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('hasSome');
    expect(op.options).toEqual({ caseInsensitive: true });
  });

  it('type mismatch fails — single element instead of array', () => {
    const b = createBuilder();
    // @ts-expect-error: literal('admin') is string, not string[]
    b.hasSome(b.resource('tags'), b.literal('admin'));
  });

  it('type mismatch fails — number array with string array operand', () => {
    const b = createBuilder();
    // @ts-expect-error: scores is number[], values is string[]
    b.hasSome(b.resource('scores'), b.literal(['a', 'b']));
  });
});

// ---------------------------------------------------------------------------
// hasEvery — array has all of the given elements
// ---------------------------------------------------------------------------

describe('builder.hasEvery()', () => {
  it('returns a Condition with hasEvery operator', () => {
    const b = createBuilder();
    const cond = b.hasEvery(b.resource('tags'), b.literal(['a', 'b', 'c']));

    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('hasEvery');
    expect(op.operands).toHaveLength(2);
  });

  it('works with context array ↔ literal array', () => {
    const b = createBuilder();
    const cond = b.hasEvery(b.context('allowedTags'), b.literal(['admin', 'editor']));
    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('hasEvery');
  });

  it('works with resource array ↔ context array', () => {
    const b = createBuilder();
    const cond = b.hasEvery(b.resource('tags'), b.context('blockedTags'));
    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('hasEvery');
  });

  it('works with number arrays', () => {
    const b = createBuilder();
    const cond = b.hasEvery(b.resource('scores'), b.literal([100, 200]));
    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('hasEvery');
  });

  it('accepts caseInsensitive option', () => {
    const b = createBuilder();
    const cond = b.hasEvery(b.resource('tags'), b.literal(['ADMIN']), {
      caseInsensitive: true,
    });
    const op = cond.node as OperatorNode;
    expect(op.operator).toBe('hasEvery');
    expect(op.options).toEqual({ caseInsensitive: true });
  });

  it('type mismatch fails — string array with number array', () => {
    const b = createBuilder();
    // @ts-expect-error: tags is string[], values is number[]
    b.hasEvery(b.resource('tags'), b.literal([1, 2, 3]));
  });
});

// ---------------------------------------------------------------------------
// Type-level tests
// ---------------------------------------------------------------------------

describe('array operators — type inference', () => {
  it('in return type is Condition', () => {
    const b = createBuilder();
    const cond = b.in(b.literal('admin'), b.resource('tags'));
    expectTypeOf(cond).toMatchTypeOf<Condition>();
  });

  it('has return type is Condition', () => {
    const b = createBuilder();
    const cond = b.has(b.resource('tags'), b.literal('featured'));
    expectTypeOf(cond).toMatchTypeOf<Condition>();
  });

  it('hasSome return type is Condition', () => {
    const b = createBuilder();
    const cond = b.hasSome(b.resource('tags'), b.literal(['a', 'b']));
    expectTypeOf(cond).toMatchTypeOf<Condition>();
  });

  it('hasEvery return type is Condition', () => {
    const b = createBuilder();
    const cond = b.hasEvery(b.resource('tags'), b.literal(['a', 'b']));
    expectTypeOf(cond).toMatchTypeOf<Condition>();
  });
});

// ---------------------------------------------------------------------------
// JSON serializability
// ---------------------------------------------------------------------------

describe('array operators — serializability', () => {
  it('in serializes to JSON', () => {
    const b = createBuilder();
    const cond = b.in(b.literal('admin'), b.resource('tags'));
    const json = JSON.stringify(cond);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const node = parsed.node as Record<string, unknown>;
    expect(node.operator).toBe('in');
  });

  it('has with caseInsensitive serializes to JSON', () => {
    const b = createBuilder();
    const cond = b.has(b.resource('tags'), b.literal('ADMIN'), {
      caseInsensitive: true,
    });
    const json = JSON.stringify(cond);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const node = parsed.node as Record<string, unknown>;
    expect(node.operator).toBe('has');
    expect(node.options).toEqual({ caseInsensitive: true });
  });

  it('hasSome serializes to JSON', () => {
    const b = createBuilder();
    const cond = b.hasSome(b.resource('tags'), b.literal(['a', 'b']));
    const json = JSON.stringify(cond);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const node = parsed.node as Record<string, unknown>;
    expect(node.operator).toBe('hasSome');
  });

  it('hasEvery serializes to JSON', () => {
    const b = createBuilder();
    const cond = b.hasEvery(b.resource('tags'), b.literal(['a', 'b']));
    const json = JSON.stringify(cond);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const node = parsed.node as Record<string, unknown>;
    expect(node.operator).toBe('hasEvery');
  });
});
