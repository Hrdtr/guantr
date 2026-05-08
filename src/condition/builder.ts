import type { ValueRef, MatchConditionBuilder, Condition } from './types';

function makeCondition(
  operator: string,
  operands: readonly ValueRef[],
  options?: Readonly<{ caseInsensitive?: boolean }>,
  nestedCondition?: Condition,
): Condition {
  return {
    type: 'condition' as const,
    node: {
      type: 'operator' as const,
      operator,
      operands,
      ...(options && { options }),
      ...(nestedCondition && { condition: nestedCondition }),
    },
  } as Condition;
}

function makeLogicalCondition(
  operator: 'and' | 'or' | 'not',
  operands: readonly Condition[],
): Condition {
  return {
    type: 'condition' as const,
    node: {
      type: 'logical' as const,
      operator,
      operands,
    },
  } as Condition;
}

/**
 * Creates a new {@link MatchConditionBuilder} instance that records value
 * references (`resource`, `context`, `literal`) used when composing conditions.
 *
 * The returned builder is a plain object whose methods produce typed
 * {@link ValueRef} objects carrying phantom type information. The phantom
 * type (`[ValueRefType]`) enables downstream operator builders (e.g. `eq`,
 * `gt`) to enforce type-safe operand pairing at compile time while keeping
 * the runtime objects fully JSON-serializable.
 */
export function createMatchConditionBuilder<
  Model extends Record<string, unknown>,
  Context extends Record<string, unknown>,
>(): MatchConditionBuilder<Model, Context> {
  return {
    resource(path) {
      return { type: 'resource' as const, path };
    },
    context(path) {
      return { type: 'context' as const, path };
    },
    literal(value) {
      return { type: 'literal' as const, value };
    },

    eq(left, right) {
      return makeCondition('eq', [left as ValueRef, right as ValueRef]);
    },
    ne(left, right) {
      return makeCondition('ne', [left as ValueRef, right as ValueRef]);
    },
    gt(left, right) {
      return makeCondition('gt', [left as ValueRef, right as ValueRef]);
    },
    gte(left, right) {
      return makeCondition('gte', [left as ValueRef, right as ValueRef]);
    },
    lt(left, right) {
      return makeCondition('lt', [left as ValueRef, right as ValueRef]);
    },
    lte(left, right) {
      return makeCondition('lte', [left as ValueRef, right as ValueRef]);
    },

    contains(str, substring, options) {
      return makeCondition('contains', [str as ValueRef, substring as ValueRef], options);
    },
    startsWith(str, prefix, options) {
      return makeCondition('startsWith', [str as ValueRef, prefix as ValueRef], options);
    },
    endsWith(str, suffix, options) {
      return makeCondition('endsWith', [str as ValueRef, suffix as ValueRef], options);
    },

    in(value, array, options) {
      return makeCondition('in', [value as ValueRef, array as ValueRef], options);
    },
    has(array, value, options) {
      return makeCondition('has', [array as ValueRef, value as ValueRef], options);
    },
    hasSome(array, values, options) {
      return makeCondition('hasSome', [array as ValueRef, values as ValueRef], options);
    },
    hasEvery(array, values, options) {
      return makeCondition('hasEvery', [array as ValueRef, values as ValueRef], options);
    },

    some(array, condition) {
      const itemBuilder = createMatchConditionBuilder() as unknown as MatchConditionBuilder<
        Record<string, unknown>,
        Context
      >;
      const nestedCondition = (
        condition as unknown as (
          b: MatchConditionBuilder<Record<string, unknown>, Context>,
        ) => Condition
      )(itemBuilder);
      return makeCondition('some', [array as ValueRef], undefined, nestedCondition);
    },
    every(array, condition) {
      const itemBuilder = createMatchConditionBuilder() as unknown as MatchConditionBuilder<
        Record<string, unknown>,
        Context
      >;
      const nestedCondition = (
        condition as unknown as (
          b: MatchConditionBuilder<Record<string, unknown>, Context>,
        ) => Condition
      )(itemBuilder);
      return makeCondition('every', [array as ValueRef], undefined, nestedCondition);
    },
    none(array, condition) {
      const itemBuilder = createMatchConditionBuilder() as unknown as MatchConditionBuilder<
        Record<string, unknown>,
        Context
      >;
      const nestedCondition = (
        condition as unknown as (
          b: MatchConditionBuilder<Record<string, unknown>, Context>,
        ) => Condition
      )(itemBuilder);
      return makeCondition('none', [array as ValueRef], undefined, nestedCondition);
    },

    and(...conditions) {
      return makeLogicalCondition('and', conditions as Condition[]);
    },
    or(...conditions) {
      return makeLogicalCondition('or', conditions as Condition[]);
    },
    not(condition) {
      return makeLogicalCondition('not', [condition as Condition]);
    },
  };
}
