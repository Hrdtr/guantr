import { Storage } from './storage';

export type GuantrOptions<Context extends Record<string, unknown> = Record<string, unknown>> = {
  getContext?: () => Context | PromiseLike<Context>;
  storage?: Storage;
  /**
   * Maximum number of rule iterations before the circuit breaker trips.
   * When exceeded, a `GuantrCircuitBreakerError` is thrown instead of silently returning `false`.
   * @default 1000
   */
  maxRuleIterations?: number;
};

export type GuantrMeta<
  ResourceMap extends GuantrResourceMap,
  Context extends Record<string, unknown> = Record<string, unknown>,
> = {
  ResourceMap: ResourceMap;
  Context: Context;
};

export type GuantrResourceAction<T extends string = string> = T;
export type GuantrResourceModel<T extends Record<string, unknown> = Record<string, unknown>> = T;

export type GuantrResource = {
  action: GuantrResourceAction;
  model: GuantrResourceModel;
};

export type GuantrResourceMap<
  T extends Record<string, GuantrResource> = Record<string, GuantrResource>,
> = T;

export type ConditionOperator =
  | 'eq'
  | 'in'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'gt'
  | 'gte'
  | 'has'
  | 'hasSome'
  | 'hasEvery'
  | 'some'
  | 'every'
  | 'none';

export interface ConditionOptions {
  caseInsensitive?: boolean;
}

type AnyContextProp = `$ctx.${string}` & {};

// Helper type to extract context leaf keys once and reuse
type ContextStringKeys<Context extends Record<string, unknown>> = LeafKeys<
  Context,
  string,
  '$ctx.'
>;
type ContextStringArrayKeys<Context extends Record<string, unknown>> = LeafKeys<
  Context,
  string[],
  '$ctx.'
>;
type ContextNumberKeys<Context extends Record<string, unknown>> = LeafKeys<
  Context,
  number,
  '$ctx.'
>;
type ContextNumberArrayKeys<Context extends Record<string, unknown>> = LeafKeys<
  Context,
  number[],
  '$ctx.'
>;
type ContextBooleanKeys<Context extends Record<string, unknown>> = LeafKeys<
  Context,
  boolean,
  '$ctx.'
>;

type NullishConditionExpression<T extends null | undefined> = [operator: 'eq', operand: T];

type StringConditionExpression<Context extends Record<string, unknown> = Record<string, unknown>> =
  | [
      operator: 'eq',
      operand: (string & {}) | AnyContextProp | ContextStringKeys<Context>,
      options?: { caseInsensitive?: boolean },
    ]
  | [
      operator: 'in',
      operand: (string & {})[] | AnyContextProp | ContextStringArrayKeys<Context>,
      options?: { caseInsensitive?: boolean },
    ]
  | [
      operator: 'contains',
      operand: (string & {}) | AnyContextProp | ContextStringKeys<Context>,
      options?: { caseInsensitive?: boolean },
    ]
  | [
      operator: 'startsWith',
      operand: (string & {}) | AnyContextProp | ContextStringKeys<Context>,
      options?: { caseInsensitive?: boolean },
    ]
  | [
      operator: 'endsWith',
      operand: (string & {}) | AnyContextProp | ContextStringKeys<Context>,
      options?: { caseInsensitive?: boolean },
    ];

type NumberConditionExpression<Context extends Record<string, unknown> = Record<string, unknown>> =
  | [operator: 'eq', operand: number | AnyContextProp | ContextNumberKeys<Context>]
  | [operator: 'in', operand: number[] | AnyContextProp | ContextNumberArrayKeys<Context>]
  | [operator: 'gt', operand: number | AnyContextProp | ContextNumberKeys<Context>]
  | [operator: 'gte', operand: number | AnyContextProp | ContextNumberKeys<Context>];

type BooleanConditionExpression<Context extends Record<string, unknown> = Record<string, unknown>> =
  [operator: 'eq', operand: boolean | AnyContextProp | ContextBooleanKeys<Context>];

type ArrayConditionExpressionBasic<
  T extends (string | number | boolean)[] = (string | number | boolean)[],
  Context extends Record<string, unknown> = Record<string, unknown>,
> =
  | [
      operator: 'has',
      operand: T[number] | AnyContextProp | LeafKeys<Context, T[number], '$ctx.'>,
      options?: string extends T[number] ? { caseInsensitive?: boolean } : never,
    ]
  | [
      operator: 'hasSome',
      operand: T | AnyContextProp | LeafKeys<Context, T, '$ctx.'>,
      options?: string extends T[number] ? { caseInsensitive?: boolean } : never,
    ]
  | [
      operator: 'hasEvery',
      operand: T | AnyContextProp | LeafKeys<Context, T, '$ctx.'>,
      options?: string extends T[number] ? { caseInsensitive?: boolean } : never,
    ];

// Internal self-referential type for untyped conditions (index signature)
interface _GuantrUntypedRuleCondition {
  [key: string]: GuantrRuleConditionExpression | _GuantrUntypedRuleCondition;
}

// Untyped version for ArrayConditionExpressionObject to avoid circular reference
type ArrayConditionExpressionObjectUntyped =
  | [operator: 'some', operand: Record<string, any>]
  | [operator: 'every', operand: Record<string, any>]
  | [operator: 'none', operand: Record<string, any>];

// The untyped condition expression (default when no generics provided)
export type GuantrRuleConditionExpression =
  | NullishConditionExpression<null | undefined>
  | StringConditionExpression
  | NumberConditionExpression
  | BooleanConditionExpression
  | ArrayConditionExpressionBasic
  | ArrayConditionExpressionObjectUntyped;

// Typed version used in the generic GuantrRuleCondition
type ArrayConditionExpressionObject<
  T extends Record<string, unknown>[] = Record<string, unknown>[],
  Context extends Record<string, unknown> = Record<string, unknown>,
  Typed extends boolean = true,
> =
  | [
      operator: 'some',
      operand: Typed extends false
        ? Record<string, GuantrRuleConditionExpression>
        : GuantrRuleCondition<T[number], Context>,
    ]
  | [
      operator: 'every',
      operand: Typed extends false
        ? Record<string, GuantrRuleConditionExpression>
        : GuantrRuleCondition<T[number], Context>,
    ]
  | [
      operator: 'none',
      operand: Typed extends false
        ? Record<string, GuantrRuleConditionExpression>
        : GuantrRuleCondition<T[number], Context>,
    ];

/**
 * Extracts the Context type from a GuantrMeta, or defaults to Record<string, unknown>.
 */
export type GuantrContextFromMeta<Meta extends GuantrMeta<GuantrResourceMap> | undefined> =
  Meta extends GuantrMeta<any, infer C> ? C : Record<string, unknown>;

/**
 * A rule in the authorization system.
 *
 * - When `Meta` is provided (typed mode), `resource`, `action`, and `condition` are
 *   narrowed based on the resource map.
 * - When `Meta` is omitted (untyped mode), all fields accept plain strings / any condition.
 */
export type GuantrRule<
  Meta extends GuantrMeta<GuantrResourceMap> | undefined = undefined,
  ResourceKey extends Meta extends GuantrMeta<infer U> ? keyof U : string = Meta extends GuantrMeta<
    infer U
  >
    ? keyof U
    : string,
> =
  Meta extends GuantrMeta<infer ResourceMap>
    ? {
        resource: ResourceKey;
        action: ResourceMap[ResourceKey]['action'];
        condition: GuantrRuleCondition<
          ResourceMap[ResourceKey]['model'],
          GuantrContextFromMeta<Meta>
        > | null;
        effect: 'allow' | 'deny';
      }
    : {
        resource: string;
        action: string;
        condition: GuantrRuleCondition | null;
        effect: 'allow' | 'deny';
      };

export type LeafKeysValuePair<Obj extends Record<string, unknown>> = {
  [P in string & LeafKeys<Obj>]: Value<Obj, P>;
};

type ArrayConditionExpression<
  T extends unknown[] = unknown[],
  Context extends Record<string, unknown> = Record<string, unknown>,
> = T extends (string | number | boolean)[]
  ? ArrayConditionExpressionBasic<T, Context>
  : T extends Record<string, unknown>[]
    ? ArrayConditionExpressionObject<T, Context>
    : never;

// Simplify condition expression resolution
type ConditionExpression<
  T,
  Context extends Record<string, unknown> = Record<string, unknown>,
> = T extends unknown[]
  ?
      | ArrayConditionExpression<T, Context>
      | { length: NumberConditionExpression<Context>; $expr?: ArrayConditionExpression<T, Context> }
  : T extends string
    ? StringConditionExpression<Context>
    : T extends number
      ? NumberConditionExpression<Context>
      : T extends boolean
        ? BooleanConditionExpression<Context>
        : never;

type ResolveConditionExpression<
  T,
  Context extends Record<string, unknown> = Record<string, unknown>,
> = T extends null | undefined
  ? NullishConditionExpression<T>
  : T extends Record<string, unknown>
    ? GuantrRuleCondition<T, Context>
    : ConditionExpression<T, Context>;

/**
 * A condition object for a rule.
 *
 * - Without generics: accepts any keys with `GuantrRuleConditionExpression` values
 *   or nested conditions (index-signature fallback).
 * - With `<Model, Context>`: keys are narrowed to the model's properties and the
 *   expression types are narrowed accordingly.
 */
export type GuantrRuleCondition<
  Model extends Record<string, unknown> = Record<string, unknown>,
  Context extends Record<string, unknown> = Record<string, unknown>,
> = string extends keyof Model
  ? _GuantrUntypedRuleCondition
  : Partial<{ [K in keyof Model]: ResolveConditionExpression<Model[K], Context> }>;

// Optimized LeafKeys with depth limit to prevent infinite recursion
type LeafKeys<
  Obj extends Record<string, unknown>,
  TypeFilter = any,
  Prefix extends string = '',
  Depth extends number = 5, // Add depth limit
> = Depth extends 0
  ? never // Stop recursion at depth limit
  : {
      [K in keyof Obj]: K extends string | number
        ? NonNullable<Obj[K]> extends Record<string, unknown>
          ? NonNullable<Obj[K]> extends any[] // Check if array to prevent recursion into arrays
            ? TypeFilter extends NonNullable<Obj[K]>
              ? `${Prefix}${K}`
              : never
            : Extract<Obj[K], null | undefined> extends never
              ? LeafKeys<NonNullable<Obj[K]>, TypeFilter, `${Prefix}${K}.`, Decrement<Depth>>
              : LeafKeys<NonNullable<Obj[K]>, TypeFilter, `${Prefix}${K}?.`, Decrement<Depth>>
          : TypeFilter extends NonNullable<Obj[K]>
            ? `${Prefix}${K}`
            : never
        : never;
    }[keyof Obj];

// Helper type to decrement depth counter
type Decrement<N extends number> = N extends 5
  ? 4
  : N extends 4
    ? 3
    : N extends 3
      ? 2
      : N extends 2
        ? 1
        : 0;

// Optimized Value type with depth limit
type Value<Obj, Path extends string, Depth extends number = 5> = Depth extends 0
  ? never
  : Path extends `${infer Segment}.${infer Rest}`
    ? Segment extends `${infer Key}?`
      ? Key extends keyof Obj
        ? Value<NonNullable<Obj[Key]>, Rest, Decrement<Depth>> | undefined
        : never
      : Segment extends keyof Obj
        ? Value<Obj[Segment], Rest, Decrement<Depth>>
        : never
    : Path extends `${infer Key}?`
      ? Key extends keyof Obj
        ? Obj[Key] | undefined
        : never
      : Path extends keyof Obj
        ? Obj[Path]
        : never;
