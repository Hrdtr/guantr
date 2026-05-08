/* v8 ignore file */

import type { Value, LeafKeys } from '../types';

declare const ValueRefType: unique symbol;

/**
 * References a field on the resource model.
 *
 * The phantom type parameter `[ValueRefType]` carries the resolved field type
 * so that operator builders (e.g. `eq`, `gt`) can enforce type-safe operand
 * pairing at compile time without affecting the runtime JSON-serializable shape.
 */
export interface ResourceRef<
  Model extends Record<string, unknown> = Record<string, unknown>,
  P extends string = string,
> {
  readonly type: 'resource';
  readonly path: P;
  readonly [ValueRefType]?: Value<Model, P>;
}

/**
 * References a field on the evaluation context (typically the current user
 * or request metadata).
 */
export interface ContextRef<
  Context extends Record<string, unknown> = Record<string, unknown>,
  P extends string = string,
> {
  readonly type: 'context';
  readonly path: P;
  readonly [ValueRefType]?: Value<Context, P>;
}

/**
 * An inline literal value.  The phantom type parameter captures the literal's
 * TypeScript type so operators can verify type compatibility at compile time.
 */
export interface LiteralRef<T = unknown> {
  readonly type: 'literal';
  readonly value: T;
  readonly [ValueRefType]?: T;
}

/** Union of every value-reference variant. */
export type ValueRef = ResourceRef | ContextRef | LiteralRef;

/**
 * Extracts the value type carried by a `ValueRef`'s phantom type parameter.
 *
 * @example
 * ```ts
 * type T = InferValueRef<ResourceRef<Post, 'title'>>; // string
 * ```
 */
export type InferValueRef<R extends ValueRef> = R extends { readonly [ValueRefType]?: infer T }
  ? T
  : never;

/**
 * Extracts the element type from a `ValueRef` whose phantom type is an array.
 * Returns `never` if the phantom type is not an array.
 *
 * @example
 * ```ts
 * type E = ArrayElementType<ResourceRef<Post, 'tags'>>; // string
 * ```
 */
export type ArrayElementType<R extends ValueRef> =
  NonNullable<InferValueRef<R>> extends (infer E)[] ? E : never;

// ---------------------------------------------------------------------------
// Operator categories
// ---------------------------------------------------------------------------

export type ComparisonOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte';
export type StringOperator = 'contains' | 'startsWith' | 'endsWith';
export type ArrayMembershipOperator = 'in' | 'has' | 'hasSome' | 'hasEvery';
export type ComplexArrayOperator = 'some' | 'every' | 'none';

/** Every non-logical operator recognised by the new DSL. */
export type DslOperator =
  | ComparisonOperator
  | StringOperator
  | ArrayMembershipOperator
  | ComplexArrayOperator;

export type LogicalOp = 'and' | 'or' | 'not';

// ---------------------------------------------------------------------------
// AST nodes (plain serializable objects)
// ---------------------------------------------------------------------------

/**
 * A leaf AST node representing a single comparison / membership check.
 *
 * Serializes to:
 * ```json
 * { "type": "operator", "operator": "eq", "operands": [...] }
 * ```
 */
export interface OperatorNode {
  readonly type: 'operator';
  readonly operator: DslOperator;
  readonly operands: readonly ValueRef[];
  readonly options?: Readonly<{ caseInsensitive?: boolean }>;
  /** Nested condition used by complex array operators (`some`, `every`, `none`). */
  readonly condition?: Condition;
}

/**
 * A combining AST node for `and`, `or`, or `not`.
 */
export interface LogicalNode {
  readonly type: 'logical';
  readonly operator: LogicalOp;
  readonly operands: readonly Condition[];
}

/** Discriminated union of all AST node variants. */
export type AstNode = OperatorNode | LogicalNode;

// ---------------------------------------------------------------------------
// Condition — the product of the builder DSL
// ---------------------------------------------------------------------------

/**
 * A serializable condition object returned by the `matchCondition` builder.
 *
 * The wrapped `AstNode` tree can be serialized to JSON for storage and later
 * evaluated at runtime against a resource instance and evaluation context.
 */
export interface Condition {
  readonly type: 'condition';
  readonly node: AstNode;
}

// ---------------------------------------------------------------------------
// Builder type (stub — operators added in Tasks 2–7)
// ---------------------------------------------------------------------------

/**
 * The builder object passed to user-defined `matchCondition` functions.
 *
 * In the completed DSL this interface carries all operator methods (`eq`,
 * `and`, …) in addition to the value-source factories listed here.
 */
export interface MatchConditionBuilder<
  Model extends Record<string, unknown> = Record<string, unknown>,
  Context extends Record<string, unknown> = Record<string, unknown>,
> {
  /* ── value-source factories ─────────────────────────────────────── */

  resource<P extends LeafKeys<Model>>(path: P): ResourceRef<Model, P>;
  context<P extends LeafKeys<Context>>(path: P): ContextRef<Context, P>;
  literal<const T>(value: T): LiteralRef<T>;

  /* ── comparison operators ───────────────────────────────────────── */

  /**
   * Equality check. Both operands must be `ValueRef` objects whose phantom
   * types are compatible.  Null-ish right-hand operands (`null`,
   * `undefined`) are always accepted so that optional-field checks remain
   * expressible.
   */
  eq<L extends ValueRef>(
    left: L,
    right: ValueRef & { readonly [ValueRefType]?: InferValueRef<L> | null | undefined },
  ): Condition;

  /** Negated equality — mirrors `eq` with an inverted result. */
  ne<L extends ValueRef>(
    left: L,
    right: ValueRef & { readonly [ValueRefType]?: InferValueRef<L> | null | undefined },
  ): Condition;

  /** Greater-than. Both operands must carry a numeric phantom type. */
  gt(
    left: ValueRef & { readonly [ValueRefType]?: number | null | undefined },
    right: ValueRef & { readonly [ValueRefType]?: number | null | undefined },
  ): Condition;

  /** Greater-than-or-equal. Both operands must carry a numeric phantom type. */
  gte(
    left: ValueRef & { readonly [ValueRefType]?: number | null | undefined },
    right: ValueRef & { readonly [ValueRefType]?: number | null | undefined },
  ): Condition;

  /** Less-than. Both operands must carry a numeric phantom type. */
  lt(
    left: ValueRef & { readonly [ValueRefType]?: number | null | undefined },
    right: ValueRef & { readonly [ValueRefType]?: number | null | undefined },
  ): Condition;

  /** Less-than-or-equal. Both operands must carry a numeric phantom type. */
  lte(
    left: ValueRef & { readonly [ValueRefType]?: number | null | undefined },
    right: ValueRef & { readonly [ValueRefType]?: number | null | undefined },
  ): Condition;

  /* ── string operators ──────────────────────────────────────────── */

  /**
   * Checks whether the string `str` contains `substring`.
   * Both operands must carry a string phantom type.
   */
  contains(
    str: ValueRef & { readonly [ValueRefType]?: string | null | undefined },
    substring: ValueRef & { readonly [ValueRefType]?: string | null | undefined },
    options?: Readonly<{ caseInsensitive?: boolean }>,
  ): Condition;

  /**
   * Checks whether the string `str` starts with `prefix`.
   * Both operands must carry a string phantom type.
   */
  startsWith(
    str: ValueRef & { readonly [ValueRefType]?: string | null | undefined },
    prefix: ValueRef & { readonly [ValueRefType]?: string | null | undefined },
    options?: Readonly<{ caseInsensitive?: boolean }>,
  ): Condition;

  /**
   * Checks whether the string `str` ends with `suffix`.
   * Both operands must carry a string phantom type.
   */
  endsWith(
    str: ValueRef & { readonly [ValueRefType]?: string | null | undefined },
    suffix: ValueRef & { readonly [ValueRefType]?: string | null | undefined },
    options?: Readonly<{ caseInsensitive?: boolean }>,
  ): Condition;

  /* ── array membership operators ─────────────────────────────────── */

  /**
   * Checks whether `value` is an element of `array`.
   * The array must be an array-typed ValueRef; the value may be any type.
   */
  in<V extends ValueRef>(
    value: V,
    array: ValueRef & { readonly [ValueRefType]?: readonly unknown[] },
    options?: Readonly<{ caseInsensitive?: boolean }>,
  ): Condition;

  /**
   * Checks whether `array` contains `value`.
   * The value's phantom type is inferred from the array's element type.
   */
  has<A extends ValueRef & { readonly [ValueRefType]?: readonly unknown[] }>(
    array: A,
    value: ValueRef & { readonly [ValueRefType]?: ArrayElementType<A> },
    options?: Readonly<{ caseInsensitive?: boolean }>,
  ): Condition;

  /**
   * Checks whether `array` contains at least one of the `values`.
   * Both operands must carry the same array phantom type.
   */
  hasSome<A extends ValueRef & { readonly [ValueRefType]?: readonly unknown[] }>(
    array: A,
    values: ValueRef & { readonly [ValueRefType]?: ReadonlyArray<ArrayElementType<A>> },
    options?: Readonly<{ caseInsensitive?: boolean }>,
  ): Condition;

  /**
   * Checks whether `array` contains all of the `values`.
   * Both operands must carry the same array phantom type.
   */
  hasEvery<A extends ValueRef & { readonly [ValueRefType]?: readonly unknown[] }>(
    array: A,
    values: ValueRef & { readonly [ValueRefType]?: ReadonlyArray<ArrayElementType<A>> },
    options?: Readonly<{ caseInsensitive?: boolean }>,
  ): Condition;

  /* ── complex array operators ────────────────────────────────────── */

  /**
   * Checks whether at least one element of `array` satisfies the
   * nested `condition`.
   *
   * The builder passed to `condition` is scoped to the array item type
   * so that `resource(...)` references fields of the element.
   *
   * @example
   * ```ts
   * some(resource('comments'), ({ eq, resource }) =>
   *   eq(resource('approved'), literal(true)))
   * ```
   */
  some<A extends ValueRef, E extends Record<string, unknown>>(
    array: A & { readonly [ValueRefType]?: readonly E[] },
    condition: MatchConditionFn<E, Context>,
  ): Condition;

  /**
   * Checks whether every element of `array` satisfies the nested
   * `condition`.
   *
   * @example
   * ```ts
   * every(resource('items'), ({ gt, resource }) =>
   *   gt(resource('price'), literal(0)))
   * ```
   */
  every<A extends ValueRef, E extends Record<string, unknown>>(
    array: A & { readonly [ValueRefType]?: readonly E[] },
    condition: MatchConditionFn<E, Context>,
  ): Condition;

  /**
   * Checks whether no element of `array` satisfies the nested
   * `condition`.
   *
   * @example
   * ```ts
   * none(resource('tags'), ({ eq, resource }) =>
   *   eq(resource('deleted'), literal(true)))
   * ```
   */
  none<A extends ValueRef, E extends Record<string, unknown>>(
    array: A & { readonly [ValueRefType]?: readonly E[] },
    condition: MatchConditionFn<E, Context>,
  ): Condition;

  /* ── logical operators ──────────────────────────────────────────── */

  /**
   * Combines conditions with logical AND.
   * All conditions must be satisfied for the result to be `true`.
   *
   * @example
   * ```ts
   * and(eq(resource('status'), literal('published')), gt(resource('views'), literal(0)))
   * ```
   */
  and(...conditions: Condition[]): Condition;

  /**
   * Combines conditions with logical OR.
   * At least one condition must be satisfied for the result to be `true`.
   *
   * @example
   * ```ts
   * or(eq(resource('role'), literal('admin')), eq(resource('role'), literal('editor')))
   * ```
   */
  or(...conditions: Condition[]): Condition;

  /**
   * Negates a condition.
   * Returns the logical complement of the given condition.
   *
   * @example
   * ```ts
   * not(eq(resource('deleted'), literal(true)))
   * ```
   */
  not(condition: Condition): Condition;
}

/**
 * The user-facing function signature for a `matchCondition` rule entry.
 *
 * @example
 * ```ts
 * matchCondition: ({ eq, resource, literal, and }) =>
 *   and(eq(resource('status'), literal('published')))
 * ```
 */
export type MatchConditionFn<
  Model extends Record<string, unknown> = Record<string, unknown>,
  Context extends Record<string, unknown> = Record<string, unknown>,
> = (builder: MatchConditionBuilder<Model, Context>) => Condition;
