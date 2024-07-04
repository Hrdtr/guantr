type ContextField<
  Context extends Record<string, unknown>,
  T,
  Prefix extends string = "$context."
> = `context.${string}` | {
  [K in keyof Context]: K extends string | number
    ? Context[K] extends Record<string, unknown>
      ? ContextField<Context[K], T, `${Prefix}${K}.`>
      : T extends Context[K] ? `${Prefix}${K}` : never
    : never
}[keyof Context];

type StringConditionExpression<
  Context extends Record<string, unknown> = Record<string, unknown>
  // NonNullable<unknown> intersection is required.
  // https://stackoverflow.com/questions/74467392/autocomplete-in-typescript-of-literal-type-and-string
  // https://github.com/microsoft/TypeScript/issues/29729
> = [operator: 'equals', operand: string & NonNullable<unknown> | ContextField<Context, string>, options?: { caseInsensitive?: boolean }]
  // TODO: fix ContextField<Context, string[]> still shown in autocomplete event not using in operator
  | [operator: 'in', operand: (string & NonNullable<unknown>)[] | ContextField<Context, string[]>, options?: { caseInsensitive?: boolean }]
  | [operator: 'contains', operand: string & NonNullable<unknown> | ContextField<Context, string>, options?: { caseInsensitive?: boolean }]
  | [operator: 'startsWith', operand: string & NonNullable<unknown> | ContextField<Context, string>, options?: { caseInsensitive?: boolean }]
  | [operator: 'endsWith', operand: string & NonNullable<unknown> | ContextField<Context, string>, options?: { caseInsensitive?: boolean }]

type NumberConditionExpression<
  Context extends Record<string, unknown> = Record<string, unknown>
> = [operator: 'equals', operand: number | ContextField<Context, number>]
  | [operator: 'in', operand: number[] | ContextField<Context, number[]>]
  | [operator: 'gt', operand: number | ContextField<Context, number>]
  | [operator: 'gte', operand: number | ContextField<Context, number>]

type BooleanConditionExpression<
  Context extends Record<string, unknown> = Record<string, unknown>
> = [operator: 'equals', operand: boolean | ContextField<Context, boolean>]

type PlainArrayConditionExpression<
  T extends (string | number)[] = (string | number)[],
  Context extends Record<string, unknown> = Record<string, unknown>
> = [operator: 'has', operand: T[number] | ContextField<Context, T[number]>, options?: string extends T[number] ? { caseInsensitive?: boolean } : never]
  | [operator: 'hasSome', operand: T | ContextField<Context, T>, options?: string extends T[number] ? { caseInsensitive?: boolean } : never]
  | [operator: 'hasEvery', operand: T | ContextField<Context, T>, options?: string extends T[number] ? { caseInsensitive?: boolean } : never]

type ObjectArrayConditionExpression<
  T extends Record<string, unknown>[] = Record<string, unknown>[],
  Context extends Record<string, unknown> = Record<string, unknown>,
  Untyped extends boolean = false
> = [
      operator: 'some',
      operand: Untyped extends true
        ? Record<string, NullishConditionExpression<null | undefined>
          | PlainArrayConditionExpression
          | ObjectArrayConditionExpression<any[], any, true>>
          | StringConditionExpression
          | NumberConditionExpression
          | BooleanConditionExpression
        : GuantrCondition<T[number], Context>
    ] | [
      operator: 'every',
      operand: Untyped extends true
        ? Record<string, NullishConditionExpression<null | undefined>
          | PlainArrayConditionExpression
          | ObjectArrayConditionExpression<any[], any, true>>
          | StringConditionExpression
          | NumberConditionExpression
          | BooleanConditionExpression
        : GuantrCondition<T[number], Context>
    ]

type ArrayConditionExpression<
  T extends unknown[] = unknown[],
  Context extends Record<string, unknown> = Record<string, unknown>
> = T extends (string | number)[]
  ? PlainArrayConditionExpression<T, Context>
  : T extends Record<string, unknown>[]
    ? ObjectArrayConditionExpression<T, Context>
    : never

type NullishConditionExpression<T extends null | undefined> = [operator: 'equals', operand: T]

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
  Context extends Record<string, unknown> = Record<string, unknown>
> = T extends null | undefined
? NullishConditionExpression<T>
: T extends Record<string, unknown>
  ? GuantrCondition<T, Context>
  : ConditionExpression<T, Context>;

export type GuantrCondition<
  Resource extends Record<string, unknown>,
  Context extends Record<string, unknown> = Record<string, unknown>
> = Resource extends any // needed to enable union types inference
  ? Partial<{
    [K in keyof Resource]: ResolveConditionExpression<Resource[K], Context>
  }>
  : never;

export type GuantrResourceMap = Record<string, Record<string, unknown>>

export type GuantrMeta<ResourceMap extends GuantrResourceMap, Action extends string = string> = {
  ResourceMap: ResourceMap;
  Action: Action;
}

export type GuantrAnyConditionExpression =
  | NullishConditionExpression<null | undefined>
  | StringConditionExpression
  | NumberConditionExpression
  | BooleanConditionExpression
  | PlainArrayConditionExpression
  | ObjectArrayConditionExpression<any[], any, true>

export interface GuantrAnyCondition {
  [key: string]: GuantrAnyConditionExpression | GuantrAnyCondition
}

export type GuantrAnyPermission = {
  resource: string;
  action: string;
  condition: GuantrAnyCondition | null;
  inverted: boolean;
}

export type GuantrPermission<
  Meta extends GuantrMeta<GuantrResourceMap, string> | undefined = undefined,
  Context extends Record<string, unknown> = Record<string, unknown>,
  ResourceKey extends (Meta extends GuantrMeta<infer U> ? keyof U : string) = (Meta extends GuantrMeta<infer U> ? keyof U : string),
> = Meta extends GuantrMeta<infer ResourceMap, infer Action> ? {
  resource: ResourceKey,
  action: Action;
  condition: GuantrCondition<ResourceMap[ResourceKey], Context> | null;
  inverted: boolean;
} : GuantrAnyPermission
