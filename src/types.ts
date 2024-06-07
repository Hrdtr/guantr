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

type ConditionField<
  Resource extends Record<string, unknown>,
  Prefix extends string = ""
> = {
  [K in keyof Resource]: K extends string | number
    ? Resource[K] extends Record<string, unknown>
      ? ConditionField<Resource[K], `${Prefix}${K}.`>
      : Resource[K] extends unknown[]
        ? `${Prefix}${K}` | `${Prefix}${K}.length`
        : `${Prefix}${K}`
    : never
}[keyof Resource];

type Split<S extends string, D extends string> = string extends S
  ? string[]
  : S extends ''
    ? []
    : S extends `${infer T}${D}${infer U}`
      ? [T, ...Split<U, D>]
      : [S];

type Access<T, K> = K extends [infer F, ...infer R] 
  ? F extends keyof T 
    ? R extends []
      ? T[F]
      : Access<T[F], R>
    : never
  : never;

type ConditionFieldValue<
  Resource extends Record<string, unknown>,
  K extends ConditionField<Resource>
> = Access<Resource, Split<K, '.'>>;

type StringConditionExpression<
  Context extends Record<string, unknown> = Record<string, unknown>
  // NonNullable<unknown> intersection is required.
  // https://stackoverflow.com/questions/74467392/autocomplete-in-typescript-of-literal-type-and-string
  // https://github.com/microsoft/TypeScript/issues/29729
> = [operator: 'equals', operand: string & NonNullable<unknown> | ContextField<Context, string>, options?: { caseInsensitive?: boolean }]
  // TODO: fix ContextField<Context, string[]> still shown in autocomplete event not using in operator
  | [operator: 'in', operand: string & NonNullable<unknown>[] | ContextField<Context, string[]>, options?: { caseInsensitive?: boolean }]
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

type SymbolConditionExpression<
  Context extends Record<string, unknown> = Record<string, unknown>
> = [operator: 'equals', operand: symbol | ContextField<Context, symbol>]
  | [operator: 'in', operand: symbol[] | ContextField<Context, symbol[]>]

type DateConditionExpression<
  Context extends Record<string, unknown> = Record<string, unknown>
> = [operator: 'equals', operand: Date | string | number | ContextField<Context, Date>]
  | [operator: 'gt', operand: Date | string | number | ContextField<Context, Date>]
  | [operator: 'gte', operand: Date | string | number | ContextField<Context, Date>]

type PlainArrayConditionExpression<
  T extends (string | number | symbol)[] = (string | number | symbol)[],
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
        ? Record<string,
          [operator: 'equals', operand: null | undefined]
          | StringConditionExpression
          | NumberConditionExpression
          | BooleanConditionExpression
          | SymbolConditionExpression
          | PlainArrayConditionExpression
          | ObjectArrayConditionExpression<any[], any, true>>
        : GuantrCondition<T[number], Context>
    ] | [
      operator: 'every',
      operand: Untyped extends true
        ? Record<string,
          [operator: 'equals', operand: null | undefined]
          | StringConditionExpression
          | NumberConditionExpression
          | BooleanConditionExpression
          | SymbolConditionExpression
          | PlainArrayConditionExpression
          | ObjectArrayConditionExpression<any[], any, true>>
        : GuantrCondition<T[number], Context>
    ]

type ArrayConditionExpression<
  T extends unknown[] = unknown[],
  Context extends Record<string, unknown> = Record<string, unknown>
> = T extends (string | number | symbol)[]
  ? PlainArrayConditionExpression<T, Context>
  : T extends Record<string, unknown>[]
    ? ObjectArrayConditionExpression<T, Context>
    : never

type ConditionExpression<T, Context extends Record<string, unknown> = Record<string, unknown>> =
  T extends null | undefined
  ? [operator: 'equals', operand: T]
  : T extends unknown[]
    ? ArrayConditionExpression<T, Context>
    : T extends string
      ? StringConditionExpression<Context>
      : T extends number
        ? NumberConditionExpression<Context>
        : T extends boolean
          ? BooleanConditionExpression<Context>
          : T extends symbol
            ? SymbolConditionExpression<Context>
            : T extends Date
              ? DateConditionExpression<Context>
              : never

export type GuantrCondition<
  Resource extends Record<string, unknown>,
  Context extends Record<string, unknown> = Record<string, unknown>
> = Resource extends any // needed to enable union types inference
  ? Partial<{ [K in ConditionField<Resource>]: ConditionExpression<ConditionFieldValue<Resource, K>, Context> }>
  : never;

export type GuantrResourceMap = Record<string, Record<string, unknown>>

export type GuantrMeta<ResourceMap extends GuantrResourceMap, Action extends string = string> = {
  ResourceMap: ResourceMap;
  Action: Action;
}

export type GuantrAnyPermission = {
  resource: string;
  action: string;
  condition: Record<string,
    [operator: 'equals', operand: null | undefined]
    | StringConditionExpression
    | NumberConditionExpression
    | BooleanConditionExpression
    | SymbolConditionExpression
    | PlainArrayConditionExpression
    | ObjectArrayConditionExpression<any[], any, true>
  > | null;
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
