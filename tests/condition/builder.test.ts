import type { InferValueRef } from '../../src/index';
/**
 * Task 2 — Tests for the Recording Builder (value source factories).
 *
 * Verifies:
 * 1. `resource(path)` returns correct `ResourceRef` with `type`, `path`
 * 2. `context(path)` returns correct `ContextRef` with `type`, `path`
 * 3. `literal(value)` returns correct `LiteralRef` with `type`, `value`
 * 4. Nested paths work (`resource('address.city')`)
 * 5. Optional paths work (`resource('address?.city')`)
 * 6. Type inference via `expectTypeOf`
 * 7. Invalid paths cause TypeScript errors (@ts-expect-error)
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
  tags: string[];
  metadata: {
    views: number;
    featured: boolean;
  };
  author?: {
    name: string;
    email: string;
  };
};

type AppContext = {
  userId: number;
  role: string;
};

// ---------------------------------------------------------------------------
// Builder creation helper
// ---------------------------------------------------------------------------

function createBuilder() {
  return createMatchConditionBuilder<Post, AppContext>();
}

// ---------------------------------------------------------------------------
// 1. resource() — shape and path
// ---------------------------------------------------------------------------

describe('builder.resource()', () => {
  it('returns a ResourceRef with correct type discriminator', () => {
    const builder = createBuilder();
    const ref = builder.resource('id');

    expect(ref.type).toBe('resource');
    expect(ref.path).toBe('id');
  });

  it('returns type: "resource" and the exact path string', () => {
    const builder = createBuilder();
    const ref = builder.resource('title');

    expect(ref).toEqual({
      type: 'resource',
      path: 'title',
    });
  });

  it('works with nested dot-notation paths', () => {
    const builder = createBuilder();
    const ref = builder.resource('metadata.views');

    expect(ref.type).toBe('resource');
    expect(ref.path).toBe('metadata.views');
  });

  it('works with optional paths (author?.name)', () => {
    const builder = createBuilder();
    const ref = builder.resource('author?.name');

    expect(ref.type).toBe('resource');
    expect(ref.path).toBe('author?.name');
  });

  it('works with optional nested paths (author?.email)', () => {
    const builder = createBuilder();
    const ref = builder.resource('author?.email');

    expect(ref.type).toBe('resource');
    expect(ref.path).toBe('author?.email');
  });

  it('works with array-type paths (tags)', () => {
    const builder = createBuilder();
    const ref = builder.resource('tags');

    expect(ref.type).toBe('resource');
    expect(ref.path).toBe('tags');
  });

  // Type-level tests
  it('infers number from ResourceRef<Post, "id">', () => {
    const builder = createBuilder();
    const ref = builder.resource('id');
    expectTypeOf<InferValueRef<typeof ref>>().toEqualTypeOf<number>();
  });

  it('infers string from ResourceRef<Post, "title">', () => {
    const builder = createBuilder();
    const ref = builder.resource('title');
    expectTypeOf<InferValueRef<typeof ref>>().toEqualTypeOf<string>();
  });

  it('infers string[] from ResourceRef<Post, "tags">', () => {
    const builder = createBuilder();
    const ref = builder.resource('tags');
    expectTypeOf<InferValueRef<typeof ref>>().toEqualTypeOf<string[]>();
  });

  it('infers number from ResourceRef<Post, "metadata.views">', () => {
    const builder = createBuilder();
    const ref = builder.resource('metadata.views');
    expectTypeOf<InferValueRef<typeof ref>>().toEqualTypeOf<number>();
  });

  it('infers boolean from ResourceRef<Post, "metadata.featured">', () => {
    const builder = createBuilder();
    const ref = builder.resource('metadata.featured');
    expectTypeOf<InferValueRef<typeof ref>>().toEqualTypeOf<boolean>();
  });

  it('invalid path causes TypeScript error', () => {
    const builder = createBuilder();
    // @ts-expect-error: 'nonexistent' is not a LeafKey of Post
    builder.resource('nonexistent');
  });
});

// ---------------------------------------------------------------------------
// 2. context() — shape and path
// ---------------------------------------------------------------------------

describe('builder.context()', () => {
  it('returns a ContextRef with correct type discriminator', () => {
    const builder = createBuilder();
    const ref = builder.context('userId');

    expect(ref.type).toBe('context');
    expect(ref.path).toBe('userId');
  });

  it('returns type: "context" and the exact path string', () => {
    const builder = createBuilder();
    const ref = builder.context('role');

    expect(ref).toEqual({
      type: 'context',
      path: 'role',
    });
  });

  it('infers number from ContextRef<AppContext, "userId">', () => {
    const builder = createBuilder();
    const ref = builder.context('userId');
    expectTypeOf<InferValueRef<typeof ref>>().toEqualTypeOf<number>();
  });

  it('infers string from ContextRef<AppContext, "role">', () => {
    const builder = createBuilder();
    const ref = builder.context('role');
    expectTypeOf<InferValueRef<typeof ref>>().toEqualTypeOf<string>();
  });

  it('invalid path causes TypeScript error', () => {
    const builder = createBuilder();
    // @ts-expect-error: 'nonexistent' is not a LeafKey of AppContext
    builder.context('nonexistent');
  });
});

// ---------------------------------------------------------------------------
// 3. literal() — shape and value
// ---------------------------------------------------------------------------

describe('builder.literal()', () => {
  it('returns a LiteralRef with correct type discriminator', () => {
    const builder = createBuilder();
    const ref = builder.literal(42);

    expect(ref.type).toBe('literal');
    expect(ref.value).toBe(42);
  });

  it('returns type: "literal" and the exact value for strings', () => {
    const builder = createBuilder();
    const ref = builder.literal('hello');

    expect(ref).toEqual({
      type: 'literal',
      value: 'hello',
    });
  });

  it('handles boolean literals', () => {
    const builder = createBuilder();
    const ref = builder.literal(true);

    expect(ref.type).toBe('literal');
    expect(ref.value).toBe(true);
  });

  it('handles null literal', () => {
    const builder = createBuilder();
    const ref = builder.literal(null);

    expect(ref.type).toBe('literal');
    expect(ref.value).toBeNull();
  });

  it('handles undefined literal', () => {
    const builder = createBuilder();
    const ref = builder.literal(undefined);

    expect(ref.type).toBe('literal');
    expect(ref.value).toBeUndefined();
  });

  it('handles array literals', () => {
    const builder = createBuilder();
    const ref = builder.literal(['admin', 'editor']);

    expect(ref.type).toBe('literal');
    expect(ref.value).toEqual(['admin', 'editor']);
  });

  it('handles object literals', () => {
    const builder = createBuilder();
    const obj = { key: 'value' };
    const ref = builder.literal(obj);

    expect(ref.type).toBe('literal');
    expect(ref.value).toBe(obj);
  });

  // Type-level tests
  it('infers 42 from LiteralRef<42>', () => {
    const builder = createBuilder();
    const ref = builder.literal(42);
    expectTypeOf<InferValueRef<typeof ref>>().toEqualTypeOf<42>();
  });

  it('infers "hello" from LiteralRef<"hello">', () => {
    const builder = createBuilder();
    const ref = builder.literal('hello');
    expectTypeOf<InferValueRef<typeof ref>>().toEqualTypeOf<'hello'>();
  });

  it('infers null from LiteralRef<null>', () => {
    const builder = createBuilder();
    const ref = builder.literal(null);
    expectTypeOf<InferValueRef<typeof ref>>().toEqualTypeOf<null>();
  });
});

// ---------------------------------------------------------------------------
// 4. Serializability
// ---------------------------------------------------------------------------

describe('builder value refs — serializability', () => {
  it('ResourceRef serializes to plain JSON', () => {
    const builder = createBuilder();
    const ref = builder.resource('metadata.views');

    const json = JSON.stringify(ref);
    const parsed = JSON.parse(json) as { type: string; path: string };

    expect(parsed.type).toBe('resource');
    expect(parsed.path).toBe('metadata.views');
    // Symbol key should NOT appear in JSON (phantom types are invisible)
    expect(Object.keys(parsed)).toEqual(['type', 'path']);
  });

  it('ContextRef serializes to plain JSON', () => {
    const builder = createBuilder();
    const ref = builder.context('userId');

    const json = JSON.stringify(ref);
    const parsed = JSON.parse(json) as { type: string; path: string };

    expect(parsed.type).toBe('context');
    expect(parsed.path).toBe('userId');
    expect(Object.keys(parsed)).toEqual(['type', 'path']);
  });

  it('LiteralRef serializes to plain JSON', () => {
    const builder = createBuilder();
    const ref = builder.literal([1, 2, 3]);

    const json = JSON.stringify(ref);
    const parsed = JSON.parse(json) as { type: string; value: number[] };

    expect(parsed.type).toBe('literal');
    expect(parsed.value).toEqual([1, 2, 3]);
    expect(Object.keys(parsed)).toEqual(['type', 'value']);
  });
});
