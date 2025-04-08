import { Storage } from "./storage";

export type GuantrOptions<Context extends Record<string, unknown> = Record<string, unknown>> = {
  getContext?: () => Context | PromiseLike<Context>
  storage?: Storage
}

export type GuantrMeta<ResourceMap extends GuantrResourceMap, Context extends Record<string, unknown> = Record<string, unknown>> = {
  ResourceMap: ResourceMap;
  Context: Context
}

export type GuantrResourceAction<T extends string = string> = T
export type GuantrResourceModel<T extends Record<string, unknown> = Record<string, unknown>> = T

export type GuantrResource = {
  action: GuantrResourceAction
  model: GuantrResourceModel
}

export type GuantrResourceMap<T extends Record<string, GuantrResource> = Record<string, GuantrResource>> = T

export type GuantrAnyRuleConditionExpression =
  | NullishConditionExpression<null | undefined>
  | StringConditionExpression
  | NumberConditionExpression
  | BooleanConditionExpression
  | ArrayConditionExpressionBasic
  | ArrayConditionExpressionObject<any[], any, true>

export interface GuantrAnyRuleCondition {
  [key: string]: GuantrAnyRuleConditionExpression | GuantrAnyRuleCondition
}

export type GuantrAnyRule = {
  resource: string;
  action: string;
  condition: GuantrAnyRuleCondition | null;
  effect: 'allow' | 'deny';
}

export type GuantrRule<
  Meta extends GuantrMeta<GuantrResourceMap> | undefined = undefined,
  Context extends Record<string, unknown> = Record<string, unknown>,
  ResourceKey extends (Meta extends GuantrMeta<infer U> ? keyof U : string) = (Meta extends GuantrMeta<infer U> ? keyof U : string),
> = Meta extends GuantrMeta<infer ResourceMap> ? {
  resource: ResourceKey,
  action: ResourceMap[ResourceKey]['action'];
  condition: GuantrRuleCondition<ResourceMap[ResourceKey]['model'], Context> | null;
  effect: 'allow' | 'deny';
} : GuantrAnyRule

export type LeafKeysValuePair<Obj extends Record<string, unknown>> = {
  [P in string & LeafKeys<Obj>]: Value<Obj, P>
};

export type ConditionOperator =
  | 'eq' | 'in'
  | 'contains' | 'startsWith' | 'endsWith'
  | 'gt' | 'gte'
  | 'has' | 'hasSome' | 'hasEvery'
  | 'some' | 'every' | 'none';

export interface ConditionOptions {
  caseInsensitive?: boolean;
}

type AnyContextProp = `$ctx.${string}` & {}

type StringConditionExpression<
  Context extends Record<string, unknown> = Record<string, unknown>
  // {} intersection is required.
  // https://stackoverflow.com/questions/74467392/autocomplete-in-typescript-of-literal-type-and-string
  // https://github.com/microsoft/TypeScript/issues/29729
> = [operator: 'eq', operand: string & {} | AnyContextProp | LeafKeys<Context, string, '$ctx.'>, options?: { caseInsensitive?: boolean }]
  // TODO: fix LeafKeys<Context, string[], '$context> still shown in autocomplete event not using in operator
  | [operator: 'in', operand: (string & {})[] | AnyContextProp | LeafKeys<Context, string[], '$ctx.'>, options?: { caseInsensitive?: boolean }]
  | [operator: 'contains', operand: string & {} | AnyContextProp | LeafKeys<Context, string, '$ctx.'>, options?: { caseInsensitive?: boolean }]
  | [operator: 'startsWith', operand: string & {} | AnyContextProp | LeafKeys<Context, string, '$ctx.'>, options?: { caseInsensitive?: boolean }]
  | [operator: 'endsWith', operand: string & {} | AnyContextProp | LeafKeys<Context, string, '$ctx.'>, options?: { caseInsensitive?: boolean }]

type NumberConditionExpression<
  Context extends Record<string, unknown> = Record<string, unknown>
> = [operator: 'eq', operand: number | AnyContextProp | LeafKeys<Context, number, '$ctx.'>]
  | [operator: 'in', operand: number[] | AnyContextProp | LeafKeys<Context, number[], '$ctx.'>]
  | [operator: 'gt', operand: number | AnyContextProp | LeafKeys<Context, number, '$ctx.'>]
  | [operator: 'gte', operand: number | AnyContextProp | LeafKeys<Context, number, '$ctx.'>]

type BooleanConditionExpression<
  Context extends Record<string, unknown> = Record<string, unknown>
> = [operator: 'eq', operand: boolean | AnyContextProp | LeafKeys<Context, boolean, '$ctx.'>]

type ArrayConditionExpressionBasic<
  T extends (string | number | boolean)[] = (string | number | boolean)[],
  Context extends Record<string, unknown> = Record<string, unknown>
> = [operator: 'has', operand: T[number] | AnyContextProp | LeafKeys<Context, T[number], '$ctx.'>, options?: string extends T[number] ? { caseInsensitive?: boolean } : never]
  | [operator: 'hasSome', operand: T | AnyContextProp | LeafKeys<Context, T, '$ctx.'>, options?: string extends T[number] ? { caseInsensitive?: boolean } : never]
  | [operator: 'hasEvery', operand: T | AnyContextProp | LeafKeys<Context, T, '$ctx.'>, options?: string extends T[number] ? { caseInsensitive?: boolean } : never]

// Limit recursion depth to avoid TypeScript recursion limits
type ArrayConditionExpressionObject<
  T extends Record<string, unknown>[] = Record<string, unknown>[],
  Context extends Record<string, unknown> = Record<string, unknown>,
  Typed extends boolean = true,
> = [
      operator: 'some',
      operand: Typed extends false
        ? Record<string, NullishConditionExpression<null | undefined> | ArrayConditionExpressionBasic | ArrayConditionExpressionObject<any[], any, true>>
          | StringConditionExpression
          | NumberConditionExpression
          | BooleanConditionExpression
        : GuantrRuleCondition<T[number], Context>
    ] | [
      operator: 'every',
      operand: Typed extends false
        ? Record<string, NullishConditionExpression<null | undefined> | ArrayConditionExpressionBasic | ArrayConditionExpressionObject<any[], any, true>>
          | StringConditionExpression
          | NumberConditionExpression
          | BooleanConditionExpression
        : GuantrRuleCondition<T[number], Context>
    ] | [
      operator: 'none',
      operand: Typed extends false
        ? Record<string, NullishConditionExpression<null | undefined> | ArrayConditionExpressionBasic | ArrayConditionExpressionObject<any[], any, true>>
          | StringConditionExpression
          | NumberConditionExpression
          | BooleanConditionExpression
        : GuantrRuleCondition<T[number], Context>
    ]

type ArrayConditionExpression<
  T extends unknown[] = unknown[],
  Context extends Record<string, unknown> = Record<string, unknown>
> = T extends (string | number)[]
  ? ArrayConditionExpressionBasic<T, Context>
  : T extends Record<string, unknown>[]
    ? ArrayConditionExpressionObject<T, Context>
    : never

type NullishConditionExpression<T extends null | undefined> = [operator: 'eq', operand: T]

type ConditionExpression<T, Context extends Record<string, unknown> = Record<string, unknown>> =
  T extends unknown[]
    ? ArrayConditionExpression<T, Context> | { length: NumberConditionExpression<Context>, $expr?: ArrayConditionExpression<T, Context> }
    : T extends string
      ? StringConditionExpression<Context>
      : T extends number
        ? NumberConditionExpression<Context>
        : T extends boolean
          ? BooleanConditionExpression<Context>
          : never

type ResolveConditionExpression<
  T,
  Context extends Record<string, unknown> = Record<string, unknown>,
> = T extends null | undefined
  ? NullishConditionExpression<T>
  : T extends Record<string, unknown>
    ? GuantrRuleCondition<T, Context>
    : ConditionExpression<T, Context>;

export type GuantrRuleCondition<
  Model extends Record<string, unknown>,
  Context extends Record<string, unknown> = Record<string, unknown>,
> = Model extends any // needed to enable union types inference
  ? Partial<{ [K in keyof Model]: ResolveConditionExpression<Model[K], Context> }>
  : never;

type LeafKeys<
  Obj extends Record<string, unknown>,
  TypeFilter = any,
  Prefix extends string = ""
> = {
  [K in keyof Obj]: K extends string | number
    ? NonNullable<Obj[K]> extends Record<string, unknown>
      ? Extract<Obj[K], null | undefined> extends never
        ? LeafKeys<NonNullable<Obj[K]>, TypeFilter, `${Prefix}${K}.`>
        : LeafKeys<NonNullable<Obj[K]>, TypeFilter, `${Prefix}${K}?.`>
      : TypeFilter extends NonNullable<Obj[K]>? `${Prefix}${K}` : never
    : never
}[keyof Obj];

type Value<Obj, Path extends string> =
  Path extends `${infer Segment}.${infer Rest}`
    ? Segment extends `${infer Key}?`
      ? Key extends keyof Obj
        ? Value<NonNullable<Obj[Key]>, Rest> | undefined
        : never
      : Segment extends keyof Obj
        ? Value<Obj[Segment], Rest>
        : never
    : Path extends `${infer Key}?`
      ? Key extends keyof Obj
        ? Obj[Key] | undefined
        : never
      : Path extends keyof Obj
        ? Obj[Path]
        : never;
