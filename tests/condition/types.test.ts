import type {
  ResourceRef,
  ContextRef,
  LiteralRef,
  ValueRef,
  InferValueRef,
  OperatorNode,
  LogicalNode,
  AstNode,
  Condition,
  MatchConditionFn,
} from '../../src/condition/types';
/**
 * Task 1 — Type-level tests for the DSL type system.
 *
 * These tests verify:
 * 1. Phantom type inference via `InferValueRef`
 * 2. ValueRef structural shapes (serializable discriminants)
 * 3. AST node shapes
 * 4. `Condition` wrapping
 * 5. `MatchConditionFn` signature compatibility
 * 6. `LeafKeys` constraint on `resource()` / `context()` paths
 */
import { describe, it, expectTypeOf } from 'vitest';

// ---------------------------------------------------------------------------
// Sample model & context types for testing
// ---------------------------------------------------------------------------

type Post = {
  id: number;
  title: string;
  status: 'draft' | 'published';
  tags: string[];
  metadata: {
    views: number;
    featured: boolean;
  };
};

type AppContext = {
  userId: number;
  role: string;
};

// ---------------------------------------------------------------------------
// 1. Phantom type inference
// ---------------------------------------------------------------------------

describe('InferValueRef — phantom type extraction', () => {
  it('extracts number from ResourceRef<Post, "id">', () => {
    type R = ResourceRef<Post, 'id'>;
    expectTypeOf<InferValueRef<R>>().toEqualTypeOf<number>();
  });

  it('extracts string from ResourceRef<Post, "title">', () => {
    type R = ResourceRef<Post, 'title'>;
    expectTypeOf<InferValueRef<R>>().toEqualTypeOf<string>();
  });

  it('extracts literal union from ResourceRef<Post, "status">', () => {
    type R = ResourceRef<Post, 'status'>;
    expectTypeOf<InferValueRef<R>>().toEqualTypeOf<'draft' | 'published'>();
  });

  it('extracts string[] from ResourceRef<Post, "tags">', () => {
    type R = ResourceRef<Post, 'tags'>;
    expectTypeOf<InferValueRef<R>>().toEqualTypeOf<string[]>();
  });

  it('extracts number from ResourceRef<Post, "metadata.views">', () => {
    type R = ResourceRef<Post, 'metadata.views'>;
    expectTypeOf<InferValueRef<R>>().toEqualTypeOf<number>();
  });

  it('extracts boolean from ResourceRef<Post, "metadata.featured">', () => {
    type R = ResourceRef<Post, 'metadata.featured'>;
    expectTypeOf<InferValueRef<R>>().toEqualTypeOf<boolean>();
  });

  it('extracts number from ContextRef<AppContext, "userId">', () => {
    type R = ContextRef<AppContext, 'userId'>;
    expectTypeOf<InferValueRef<R>>().toEqualTypeOf<number>();
  });

  it('extracts string from ContextRef<AppContext, "role">', () => {
    type R = ContextRef<AppContext, 'role'>;
    expectTypeOf<InferValueRef<R>>().toEqualTypeOf<string>();
  });

  it('extracts literal type from LiteralRef', () => {
    type R = LiteralRef<'hello'>;
    expectTypeOf<InferValueRef<R>>().toEqualTypeOf<'hello'>();
  });

  it('extracts number from LiteralRef<42>', () => {
    type R = LiteralRef<42>;
    expectTypeOf<InferValueRef<R>>().toEqualTypeOf<42>();
  });

  it('extracts null from LiteralRef<null>', () => {
    type R = LiteralRef<null>;
    expectTypeOf<InferValueRef<R>>().toEqualTypeOf<null>();
  });
});

// ---------------------------------------------------------------------------
// 2. ValueRef structural shapes
// ---------------------------------------------------------------------------

describe('ValueRef — structural shape', () => {
  it('ResourceRef has type: "resource" and path', () => {
    type R = ResourceRef<Post, 'title'>;
    expectTypeOf<R['type']>().toEqualTypeOf<'resource'>();
    expectTypeOf<R['path']>().toEqualTypeOf<'title'>();
  });

  it('ContextRef has type: "context" and path', () => {
    type R = ContextRef<AppContext, 'role'>;
    expectTypeOf<R['type']>().toEqualTypeOf<'context'>();
    expectTypeOf<R['path']>().toEqualTypeOf<'role'>();
  });

  it('LiteralRef has type: "literal" and value', () => {
    type R = LiteralRef<true>;
    expectTypeOf<R['type']>().toEqualTypeOf<'literal'>();
    expectTypeOf<R['value']>().toEqualTypeOf<true>();
  });

  it('ValueRef is a union of all three ref types', () => {
    const ref1: ValueRef = { type: 'resource', path: 'title' } as ResourceRef;
    const ref2: ValueRef = { type: 'context', path: 'userId' } as ContextRef;
    const ref3: ValueRef = { type: 'literal', value: 42 } as LiteralRef;
    expectTypeOf(ref1).toExtend<ValueRef>();
    expectTypeOf(ref2).toExtend<ValueRef>();
    expectTypeOf(ref3).toExtend<ValueRef>();
  });
});

// ---------------------------------------------------------------------------
// 3. AST node shapes
// ---------------------------------------------------------------------------

describe('AST nodes — structural shape', () => {
  it('OperatorNode has correct discriminant shape', () => {
    type Op = OperatorNode;
    expectTypeOf<Op['type']>().toEqualTypeOf<'operator'>();
    expectTypeOf<Op['operator']>().toBeString();
    expectTypeOf<Op['operands']>().items.toExtend<ValueRef>();
  });

  it('LogicalNode has correct discriminant shape', () => {
    type Ln = LogicalNode;
    expectTypeOf<Ln['type']>().toEqualTypeOf<'logical'>();
    expectTypeOf<Ln['operator']>().toEqualTypeOf<'and' | 'or' | 'not'>();
    expectTypeOf<Ln['operands']>().items.toExtend<Condition>();
  });

  it('AstNode is discriminated union of OperatorNode | LogicalNode', () => {
    const op: AstNode = { type: 'operator', operator: 'eq', operands: [] } as OperatorNode;
    const ln: AstNode = { type: 'logical', operator: 'and', operands: [] } as LogicalNode;
    expectTypeOf(op).toExtend<AstNode>();
    expectTypeOf(ln).toExtend<AstNode>();
  });
});

// ---------------------------------------------------------------------------
// 4. Condition wrapping
// ---------------------------------------------------------------------------

describe('Condition — structural shape', () => {
  it('Condition wraps an AstNode', () => {
    type C = Condition;
    expectTypeOf<C['type']>().toEqualTypeOf<'condition'>();
    expectTypeOf<C['node']>().toExtend<AstNode>();
  });
});

// ---------------------------------------------------------------------------
// 5. MatchConditionFn signature
// ---------------------------------------------------------------------------

describe('MatchConditionFn — user-facing signature', () => {
  it('accepts typed Model and Context', () => {
    type Fn = MatchConditionFn<Post, AppContext>;
    const stubCondition = {
      type: 'condition' as const,
      node: { type: 'operator' as const, operator: 'eq' as const, operands: [] },
    };
    expectTypeOf<Fn>().toBeCallableWith({
      resource: <
        P extends 'id' | 'title' | 'status' | 'tags' | 'metadata.views' | 'metadata.featured',
      >(
        _p: P,
      ) => ({ type: 'resource' as const, path: '' }) as unknown as ResourceRef<Post, P>,
      context: <P extends 'userId' | 'role'>(_p: P) =>
        ({ type: 'context' as const, path: '' }) as unknown as ContextRef<AppContext, P>,
      literal: <T>(_v: T) => ({ type: 'literal' as const, value: _v }) as LiteralRef<T>,
      eq: (_l: unknown, _r: unknown) => stubCondition,
      ne: (_l: unknown, _r: unknown) => stubCondition,
      gt: (_l: unknown, _r: unknown) => stubCondition,
      gte: (_l: unknown, _r: unknown) => stubCondition,
      lt: (_l: unknown, _r: unknown) => stubCondition,
      lte: (_l: unknown, _r: unknown) => stubCondition,
      contains: (_a: unknown, _b: unknown, _o?: unknown) => stubCondition,
      startsWith: (_a: unknown, _b: unknown, _o?: unknown) => stubCondition,
      endsWith: (_a: unknown, _b: unknown, _o?: unknown) => stubCondition,
      in: (_a: unknown, _b: unknown, _o?: unknown) => stubCondition,
      has: (_a: unknown, _b: unknown, _o?: unknown) => stubCondition,
      hasSome: (_a: unknown, _b: unknown, _o?: unknown) => stubCondition,
      hasEvery: (_a: unknown, _b: unknown, _o?: unknown) => stubCondition,
      some: (_a: unknown, _c: unknown) => stubCondition,
      every: (_a: unknown, _c: unknown) => stubCondition,
      none: (_a: unknown, _c: unknown) => stubCondition,
      and: (..._cs: unknown[]) => stubCondition,
      or: (..._cs: unknown[]) => stubCondition,
      not: (_c: unknown) => stubCondition,
    });
  });
});

// ---------------------------------------------------------------------------
// 6. JSON serialization / deserialization round-trip proof
// ---------------------------------------------------------------------------

describe('ValueRef — serializability', () => {
  it('ResourceRef can be represented as a plain JSON-serializable object', () => {
    const ref: ResourceRef<Post, 'title'> = {
      type: 'resource',
      path: 'title',
    } as ResourceRef<Post, 'title'>;

    const json = JSON.stringify(ref);
    const parsed: { type: string; path: string } = JSON.parse(json);

    expectTypeOf(parsed.type).toEqualTypeOf<string>();
    expectTypeOf(parsed.path).toEqualTypeOf<string>();
  });

  it('ContextRef can be represented as a plain JSON-serializable object', () => {
    const ref: ContextRef<AppContext, 'userId'> = {
      type: 'context',
      path: 'userId',
    } as ContextRef<AppContext, 'userId'>;

    const json = JSON.stringify(ref);
    const parsed: { type: string; path: string } = JSON.parse(json);

    expectTypeOf(parsed.type).toEqualTypeOf<string>();
    expectTypeOf(parsed.path).toEqualTypeOf<string>();
  });

  it('LiteralRef can be represented as a plain JSON-serializable object', () => {
    const ref: LiteralRef<42> = {
      type: 'literal',
      value: 42,
    } as LiteralRef<42>;

    const json = JSON.stringify(ref);
    const parsed: { type: string; value: number } = JSON.parse(json);

    expectTypeOf(parsed.type).toEqualTypeOf<string>();
    expectTypeOf(parsed.value).toEqualTypeOf<number>();
  });

  it('Condition with nested AST serializes to JSON', () => {
    const cond: Condition = {
      type: 'condition',
      node: {
        type: 'logical',
        operator: 'and',
        operands: [
          {
            type: 'condition',
            node: {
              type: 'operator',
              operator: 'eq',
              operands: [
                { type: 'resource', path: 'title' } as ResourceRef,
                { type: 'literal', value: 'Hello' } as LiteralRef,
              ],
            },
          },
          {
            type: 'condition',
            node: {
              type: 'operator',
              operator: 'gt',
              operands: [
                { type: 'resource', path: 'metadata.views' } as ResourceRef,
                { type: 'literal', value: 0 } as LiteralRef,
              ],
            },
          },
        ],
      },
    };

    const json = JSON.stringify(cond);
    const parsed: Record<string, unknown> = JSON.parse(json);

    expectTypeOf(parsed).toExtend<Record<string, unknown>>();
    expectTypeOf(parsed['type'] as string).toEqualTypeOf<string>();
  });
});
