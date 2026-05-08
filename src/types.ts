/* v8 ignore file */

import type { MatchConditionFn, Condition } from './condition/types';
import type { Storage } from './storage';

/**
 * Options for configuring a {@link Guantr} instance.
 *
 * The `context` option accepts either a static context object or a function
 * that returns the context (optionally async). When a plain object is passed,
 * it is wrapped internally as `() => Promise.resolve(obj)` — context is still
 * resolved on every check, but the value is the same static object.
 */
export type GuantrOptions<Context extends Record<string, unknown> = Record<string, unknown>> = {
  context?: Context | (() => Context | Promise<Context>);
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

/**
 * Extracts the Context type from a GuantrMeta, or defaults to Record<string, unknown>.
 */
export type GuantrContextFromMeta<Meta extends GuantrMeta<GuantrResourceMap> | undefined> =
  // oxlint-disable-next-line typescript/no-explicit-any
  Meta extends GuantrMeta<any, infer C> ? C : Record<string, unknown>;

/**
 * A rule in the authorization system.
 *
 * - When `Meta` is provided (typed mode), `resource`, `action`, and `matchCondition` are
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
        matchCondition?:
          | MatchConditionFn<ResourceMap[ResourceKey]['model'], GuantrContextFromMeta<Meta>>
          | Condition
          | null;
        effect: 'allow' | 'deny';
      }
    : {
        resource: string;
        action: string;
        matchCondition?: MatchConditionFn | Condition | null;
        effect: 'allow' | 'deny';
      };

/**
 * Extracts leaf-level key paths from a nested object type as dot-notation string
 * literals. Nested objects are recursed into, while arrays terminate recursion.
 *
 * Recursion is limited to **5 levels** of depth to prevent infinite type resolution
 * on self-referential types. Paths deeper than the limit are silently excluded.
 * To increase the depth limit, adjust the `Depth` default and the corresponding
 * {@link Decrement} mapping.
 *
 * @example
 * ```ts
 * type Model = { user: { name: string; address: { city: string } }; tags: string[] };
 * type Keys = LeafKeys<Model, string>;
 * // "user.name" | "user.address.city" | "tags"
 * ```
 */
export type LeafKeys<
  Obj extends Record<string, unknown>,
  // oxlint-disable-next-line typescript/no-explicit-any
  TypeFilter = any,
  Prefix extends string = '',
  Depth extends number = 5, // Add depth limit
> = Depth extends 0
  ? never // Stop recursion at depth limit
  : {
      [K in keyof Obj]: K extends string | number
        ? NonNullable<Obj[K]> extends Record<string, unknown>
          ? // oxlint-disable-next-line typescript/no-explicit-any
            NonNullable<Obj[K]> extends any[] // Check if array to prevent recursion into arrays
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
export type Value<Obj, Path extends string, Depth extends number = 5> = Depth extends 0
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
