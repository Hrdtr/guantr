import type { Condition, MatchConditionFn, MatchConditionBuilder } from './condition/types';
import type { Storage } from './storage/types';
import type {
  GuantrMeta,
  GuantrRule,
  GuantrResourceMap,
  GuantrOptions,
  GuantrContextFromMeta,
} from './types';
import { createMatchConditionBuilder } from './condition/builder';
import { evaluateCondition } from './condition/evaluate';
import { GuantrCircuitBreakerError } from './errors';
import { InMemoryStorage } from './storage';

export { GuantrCircuitBreakerError, GuantrInvalidConditionKeyError } from './errors';

export type {
  GuantrMeta,
  GuantrOptions,
  GuantrResource,
  GuantrResourceAction,
  GuantrResourceModel,
  GuantrResourceMap,
  GuantrRule,
  GuantrContextFromMeta,
} from './types';

export type {
  ResourceRef,
  ContextRef,
  LiteralRef,
  ValueRef,
  InferValueRef,
  ArrayElementType,
  OperatorNode,
  LogicalNode,
  AstNode,
  Condition,
  MatchConditionBuilder,
  MatchConditionFn,
} from './condition/types';

export { createMatchConditionBuilder } from './condition/builder';
export { evaluateCondition } from './condition/evaluate';

function stableStringify(value: unknown, seen: WeakSet<object> = new WeakSet()): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (seen.has(value as object)) {
    throw new TypeError('Converting circular structure to JSON');
  }
  if (Array.isArray(value)) {
    seen.add(value);
    return `[${value.map((item) => stableStringify(item, seen)).join(',')}]`;
  }
  seen.add(value as object);
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const pairs = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(record[k], seen)}`);
  return `{${pairs.join(',')}}`;
}

/**
 * Serializes {@link MatchConditionFn | function-based match conditions} in a rules array
 * into {@link Condition} AST objects.
 *
 * Each rule whose `matchCondition` is a function is executed with a
 * {@link MatchConditionBuilder} and replaced by the resulting `Condition` object.
 * Rules with non-function conditions or no conditions are passed through unchanged.
 *
 * This is essential for seeding rules into a database or custom storage without
 * calling `setRules` at runtime. Serialize your rule definitions once, persist
 * them, and let the storage adapter serve them directly via `queryRules`.
 *
 * @param rules - Array of rules, potentially containing function-based `matchCondition` entries.
 * @returns A new array where every function-based `matchCondition` has been converted
 *          to a serialized `Condition` AST.
 *
 * @example
 * ```ts
 * import { serializeRules } from 'guantr';
 *
 * const rules = [
 *   { effect: 'allow', action: 'read', resource: 'post' },
 *   {
 *     effect: 'deny',
 *     action: 'read',
 *     resource: 'post',
 *     matchCondition: ({ eq, resource, literal }) =>
 *       eq(resource('archived'), literal(true)),
 *   },
 * ];
 *
 * // Serialize before persisting to a database
 * const serialized = serializeRules(rules);
 * // serialized[1].matchCondition is now a Condition object, not a function
 * await db.insert(serialized);
 * ```
 */
export function serializeRules<Meta extends GuantrMeta<GuantrResourceMap> | undefined = undefined>(
  rules: readonly GuantrRule<Meta>[],
): GuantrRule<Meta>[] {
  return rules.map((rule) => {
    if (rule.matchCondition == null) return rule;
    if (typeof rule.matchCondition === 'function') {
      const builder = createMatchConditionBuilder<
        Record<string, unknown>,
        Record<string, unknown>
      >();
      const condition = (rule.matchCondition as unknown as (b: typeof builder) => Condition)(
        builder,
      );
      return { ...rule, matchCondition: condition };
    }
    return rule;
  });
}

/**
 * Wraps {@link Condition} objects in a rules array back into function form so
 * they can be passed to `setRules` for re-registration.
 *
 * This is the inverse of {@link serializeRules}. Each `Condition` stored in
 * `matchCondition` is wrapped inside a {@link MatchConditionFn | function} that
 * returns the condition directly (ignoring the builder argument).
 *
 * Use this when you load rules from an external store and want to feed them
 * into `setRules` using either the array or callback form.
 *
 * @param rules - Array of rules containing `Condition` objects in `matchCondition`.
 * @returns A new array where every `Condition`-typed `matchCondition` has been
 *          wrapped as a function.
 *
 * @example
 * ```ts
 * import { deserializeRules } from 'guantr';
 *
 * // Rules loaded from a database already have serialized Condition objects
 * const rulesFromDb = await db.select('SELECT * FROM rules');
 * const deserialized = deserializeRules(rulesFromDb);
 * await guantr.setRules(deserialized);
 * ```
 */
export function deserializeRules<
  Meta extends GuantrMeta<GuantrResourceMap> | undefined = undefined,
>(rules: readonly GuantrRule<Meta>[]): GuantrRule<Meta>[] {
  return rules.map((rule) => {
    if (rule.matchCondition != null && typeof rule.matchCondition !== 'function') {
      const condition = rule.matchCondition;
      const wrappedFn: MatchConditionFn<Record<string, unknown>, Record<string, unknown>> = (
        _builder,
      ) => condition as Condition;
      return { ...rule, matchCondition: wrappedFn };
    }
    return rule;
  });
}

// Extract commonly used type patterns to reduce repetition
type ExtractResourceKeys<Meta> = Meta extends GuantrMeta<infer U> ? keyof U : string;
type ExtractResourceAction<Meta, K> =
  Meta extends GuantrMeta<infer U> ? U[K & keyof U]['action'] : string;
type ExtractResourceModel<Meta, K> =
  Meta extends GuantrMeta<infer U> ? U[K & keyof U]['model'] : Record<string, unknown>;

/**
 * A check tuple for batch permission methods (`can.all`, `can.any`, etc.).
 * Each element is a tuple of `[action, [resourceKey, resourceInstance]]`.
 */
type CanCheckItem<Meta extends GuantrMeta<GuantrResourceMap> | undefined> =
  Meta extends GuantrMeta<infer ResourceMap>
    ? {
        [K in keyof ResourceMap]: [
          action: ResourceMap[K]['action'],
          resource: [key: K, instance: ResourceMap[K]['model']],
        ];
      }[keyof ResourceMap]
    : [action: string, resource: [key: string, instance: Record<string, unknown>]];

/**
 * Typed callable for `guantr.can`. Supports two call signatures and nested `.abstract()`, `.all()`, `.any()` sub-methods.
 */
type CanMethod<Meta extends GuantrMeta<GuantrResourceMap> | undefined> = {
  /**
   * Checks if the user has permission to perform the specified action on the given resource instance.
   * Evaluates all matching conditions and deny rules.
   */
  <
    ResourceKey extends ExtractResourceKeys<Meta>,
    Resource extends ExtractResourceModel<Meta, ResourceKey> = ExtractResourceModel<
      Meta,
      ResourceKey
    >,
  >(
    action: ExtractResourceAction<Meta, ResourceKey>,
    resource: [ResourceKey, Resource],
  ): Promise<boolean>;

  /**
   * Abstract permission check.
   * Returns `true` if ANY allow rule exists for the given action + resource pair.
   * Does NOT evaluate conditions or deny rules.
   */
  abstract<ResourceKey extends ExtractResourceKeys<Meta>>(
    action: ExtractResourceAction<Meta, ResourceKey>,
    resource: ResourceKey,
  ): Promise<boolean>;

  /**
   * Checks if ALL specified permissions are granted.
   * Resolves context once and shares it across all checks.
   * Short-circuits on the first `false` result.
   */
  all(checks: CanCheckItem<Meta>[]): Promise<boolean>;

  /**
   * Checks if ANY of the specified permissions is granted.
   * Resolves context once and shares it across all checks.
   * Short-circuits on the first `true` result.
   */
  any(checks: CanCheckItem<Meta>[]): Promise<boolean>;
};

/**
 * Typed callable for `guantr.cannot`. Logical negation of `CanMethod`.
 */
type CannotMethod<Meta extends GuantrMeta<GuantrResourceMap> | undefined> = {
  <
    ResourceKey extends ExtractResourceKeys<Meta>,
    Resource extends ExtractResourceModel<Meta, ResourceKey> = ExtractResourceModel<
      Meta,
      ResourceKey
    >,
  >(
    action: ExtractResourceAction<Meta, ResourceKey>,
    resource: [ResourceKey, Resource],
  ): Promise<boolean>;

  abstract<ResourceKey extends ExtractResourceKeys<Meta>>(
    action: ExtractResourceAction<Meta, ResourceKey>,
    resource: ResourceKey,
  ): Promise<boolean>;

  all(checks: CanCheckItem<Meta>[]): Promise<boolean>;

  any(checks: CanCheckItem<Meta>[]): Promise<boolean>;
};

/**
 * Core authorization engine for managing and evaluating permission rules.
 *
 * Each instance holds a set of rules in a {@link Storage} adapter and provides
 * methods for checking whether a given action is allowed or denied against a
 * specific resource instance. Conditions within rules are evaluated using a
 * builder-based DSL ({@link MatchConditionBuilder}) and serialized as AST
 * nodes stored in the storage backend.
 *
 * @example
 * ```ts
 * const guantr = new Guantr<MyMeta>({
 *   storage: new MyStorage(),
 *   context: () => ({ userId: '123' }),
 *   maxRuleIterations: 500,
 * });
 * await guantr.setRules((allow, deny) => {
 *   allow('read', 'post');
 * });
 * ```
 *
 * @typeParam Meta - A {@link GuantrMeta} type describing the resource map and context shape,
 *   or `undefined` for untyped mode.
 */
export class Guantr<Meta extends GuantrMeta<GuantrResourceMap> | undefined = undefined> {
  private _storage: Storage;
  private _resolveContext: () => GuantrContextFromMeta<Meta> | Promise<GuantrContextFromMeta<Meta>>;
  private readonly _maxRuleIterations: number;
  readonly can!: CanMethod<Meta>;
  readonly cannot!: CannotMethod<Meta>;

  constructor(options?: GuantrOptions<GuantrContextFromMeta<Meta>>) {
    this._storage = options?.storage || new InMemoryStorage();
    const rawContext = options?.context;
    if (typeof rawContext === 'function') {
      this._resolveContext = rawContext as () =>
        | GuantrContextFromMeta<Meta>
        | Promise<GuantrContextFromMeta<Meta>>;
    } else if (rawContext !== undefined) {
      const ctx = rawContext as GuantrContextFromMeta<Meta>;
      this._resolveContext = () => Promise.resolve(ctx);
    } else {
      this._resolveContext = () => Promise.resolve({} as GuantrContextFromMeta<Meta>);
    }

    const maxRuleIterations = options?.maxRuleIterations ?? 1000;
    if (!Number.isInteger(maxRuleIterations) || maxRuleIterations < 1) {
      throw new TypeError('maxRuleIterations must be a positive integer');
    }
    this._maxRuleIterations = maxRuleIterations;
    this.can = Object.assign(
      <
        ResourceKey extends ExtractResourceKeys<Meta>,
        Resource extends ExtractResourceModel<Meta, ResourceKey> = ExtractResourceModel<
          Meta,
          ResourceKey
        >,
      >(
        action: ExtractResourceAction<Meta, ResourceKey>,
        resource: [ResourceKey, Resource],
      ) => this._can(action, resource),
      {
        abstract: <ResourceKey extends ExtractResourceKeys<Meta>>(
          action: ExtractResourceAction<Meta, ResourceKey>,
          resource: ResourceKey,
        ) => this._canAbstract(action, resource),
        all: (checks: CanCheckItem<Meta>[]) => this._canAll(checks),
        any: (checks: CanCheckItem<Meta>[]) => this._canAny(checks),
      },
    ) as CanMethod<Meta>;

    this.cannot = Object.assign(
      <
        ResourceKey extends ExtractResourceKeys<Meta>,
        Resource extends ExtractResourceModel<Meta, ResourceKey> = ExtractResourceModel<
          Meta,
          ResourceKey
        >,
      >(
        action: ExtractResourceAction<Meta, ResourceKey>,
        resource: [ResourceKey, Resource],
      ) => this._cannot(action, resource),
      {
        abstract: <ResourceKey extends ExtractResourceKeys<Meta>>(
          action: ExtractResourceAction<Meta, ResourceKey>,
          resource: ResourceKey,
        ) => this._cannotAbstract(action, resource),
        all: (checks: CanCheckItem<Meta>[]) => this._cannotAll(checks),
        any: (checks: CanCheckItem<Meta>[]) => this._cannotAny(checks),
      },
    ) as CannotMethod<Meta>;
  }

  /**
   * Replaces all stored rules with a new rule set.
   *
   * Accepts either a callback that receives `allow` / `deny` helper functions, or
   * a direct array of {@link GuantrRule} objects. When using the callback, each call
   * to `allow(action, resource)` or `deny(action, resource)` adds one rule.
   *
   * The `resource` argument to `allow`/`deny` can be:
   * - A plain resource key string (unconditional rule).
   * - A tuple `[resourceKey, matchCondition]` where `matchCondition` is either a
   *   builder function (`MatchConditionFn`) or a pre-serialized {@link Condition} object.
   *
   * When a `matchCondition` function is provided, it is immediately executed with a
   * {@link MatchConditionBuilder} and the resulting AST is stored. This serialization
   * is delegated to {@link serializeRules}. If you need to serialize rules without a
   * `Guantr` instance, use {@link serializeRules} directly.
   *
   * Calling this method **clears the cache**.
   *
   * @param callbackOrRules - A callback function that defines rules, or an array of rule objects.
   * @example
   * ```ts
   * // Callback style
   * await guantr.setRules((allow, deny) => {
   *   allow('read', 'post');
   *   deny('read', ['post', ({ eq, resource, literal }) =>
   *     eq(resource('archived'), literal(true))
   *   ]);
   * });
   *
   * // Array style
   * await guantr.setRules([
   *   { effect: 'allow', action: 'read', resource: 'post' },
   *   {
   *     effect: 'deny',
   *     action: 'read',
   *     resource: 'post',
   *     matchCondition: ({ eq, resource, literal }) =>
   *       eq(resource('archived'), literal(true)),
   *   },
   * ]);
   * ```
   */
  async setRules(callback: SetRulesCallback<Meta>): Promise<void>;
  async setRules(rules: GuantrRule<Meta>[]): Promise<void>;
  async setRules(callbackOrRules: SetRulesCallback<Meta> | GuantrRule<Meta>[]): Promise<void> {
    let nextRules: GuantrRule[];

    if (Array.isArray(callbackOrRules)) {
      nextRules = callbackOrRules as GuantrRule[];
    } else {
      const rules: GuantrRule[] = [];
      await callbackOrRules(
        (action, resource) =>
          rules.push({
            action,
            resource: typeof resource === 'string' ? resource : resource[0],
            matchCondition:
              typeof resource === 'string'
                ? undefined
                : (resource[1] as GuantrRule['matchCondition']),
            effect: 'allow',
          }),
        (action, resource) =>
          rules.push({
            action,
            resource: typeof resource === 'string' ? resource : resource[0],
            matchCondition:
              typeof resource === 'string'
                ? undefined
                : (resource[1] as GuantrRule['matchCondition']),
            effect: 'deny',
          }),
      );

      nextRules = rules;
    }

    nextRules = serializeRules(nextRules);

    await this._storage.cache?.clear();
    return this._storage.setRules(nextRules);
  }

  /**
   * Returns all stored rules as a read-only array.
   *
   * Results are cached via the storage adapter's cache layer if available.
   *
   * @returns A promise resolving to all stored {@link GuantrRule} objects.
   */
  async getRules(): Promise<ReadonlyArray<GuantrRule>> {
    const cacheKey = 'getRules';
    if (this._storage.cache) {
      let cached: ReadonlyArray<GuantrRule> | undefined;
      try {
        if (await this._storage.cache.has(cacheKey)) {
          cached = await this._storage.cache.get<ReadonlyArray<GuantrRule>>(cacheKey);
        }
      } catch {
        cached = undefined;
      }
      if (cached !== undefined) return cached;
    }
    const rules = await this._storage.getRules();
    try {
      await this._storage.cache?.set(cacheKey, rules);
    } catch {
      // Swallow cache adapter errors and return uncached rules
    }
    return rules;
  }

  /**
   * Retrieves all rules matching a specific action and resource key.
   *
   * This is a low-level query that returns rules as stored — conditions are
   * **not** evaluated. Useful for debugging or building custom tooling.
   *
   * @param action - The action to filter by (e.g. `'read'`).
   * @param resource - The resource key to filter by (e.g. `'post'`).
   * @returns A promise resolving to the matching rule objects.
   */
  async relatedRulesFor<ResourceKey extends ExtractResourceKeys<Meta>>(
    action: ExtractResourceAction<Meta, ResourceKey>,
    resource: ResourceKey,
  ): Promise<GuantrRule[]> {
    return this._storage.queryRules(action as string, resource as string);
  }

  private async _evaluateCheck<
    ResourceKey extends ExtractResourceKeys<Meta>,
    Resource extends ExtractResourceModel<Meta, ResourceKey> = ExtractResourceModel<
      Meta,
      ResourceKey
    >,
  >(
    action: ExtractResourceAction<Meta, ResourceKey>,
    resource: [ResourceKey, Resource],
    context: GuantrContextFromMeta<Meta>,
  ): Promise<boolean> {
    const rawRules = await this._storage.queryRules(action as string, resource[0] as string);
    if (rawRules.length === 0) {
      return false;
    }
    // Early exit: an unconditional deny (matchCondition omitted/null, effect: 'deny')
    // guarantees a false result regardless of every other rule.
    if (rawRules.some((rule) => rule.matchCondition == null && rule.effect === 'deny')) {
      return false;
    }

    const allowed: boolean[] = [];
    const denied: boolean[] = [];
    let iterationCount = 0;
    for (const rule of rawRules) {
      iterationCount++;
      if (iterationCount > this._maxRuleIterations) {
        throw new GuantrCircuitBreakerError(
          action as string,
          resource[0] as string,
          this._maxRuleIterations,
        );
      }
      // If no matchCondition is set, it's an unconditional allow.
      // (Unconditional denies were caught by the early exit above.)
      if (!rule.matchCondition) {
        allowed.push(true);
        continue;
      }
      // Evaluate the matchCondition AST against the resource and context.
      const matched = evaluateCondition(rule.matchCondition as Condition, resource[1], context);
      if (matched) {
        if (rule.effect === 'allow') allowed.push(true);
        else denied.push(false);
      } else {
        if (rule.effect === 'allow') allowed.push(false);
        else denied.push(true);
      }
    }

    return allowed.includes(true) && !denied.includes(false);
  }

  private async _can<
    ResourceKey extends ExtractResourceKeys<Meta>,
    Resource extends ExtractResourceModel<Meta, ResourceKey> = ExtractResourceModel<
      Meta,
      ResourceKey
    >,
  >(
    action: ExtractResourceAction<Meta, ResourceKey>,
    resource: [ResourceKey, Resource],
  ): Promise<boolean> {
    const context = await this._resolveContext();

    let cacheKey: string | null = null;
    if (this._storage.cache) {
      try {
        const serializedContext = stableStringify(context);
        cacheKey = `can/${String(action)}:${resource[0]}:${stableStringify(resource[1])}:${serializedContext}`;

        let cachedResult: boolean | undefined = undefined;
        try {
          if (await this._storage.cache.has(cacheKey)) {
            cachedResult = await this._storage.cache.get<boolean>(cacheKey);
          }
        } catch {
          cachedResult = undefined;
        }
        if (cachedResult !== undefined) {
          return cachedResult;
        }
      } catch {
        cacheKey = null;
      }
    }
    const trySetCache = async <T>(result: T): Promise<T> => {
      if (cacheKey) {
        try {
          await this._storage.cache?.set(cacheKey, result);
        } catch {
          // Swallow cache adapter errors
        }
      }
      return result;
    };

    const result = await this._evaluateCheck(action, resource, context);
    return await trySetCache(result);
  }

  private async _canAbstract<ResourceKey extends ExtractResourceKeys<Meta>>(
    action: ExtractResourceAction<Meta, ResourceKey>,
    resource: ResourceKey,
  ): Promise<boolean> {
    let cacheKey: string | null = null;
    if (this._storage.cache) {
      cacheKey = `can.abstract/${action as string}:${resource as string}`;
      let cachedResult: boolean | undefined = undefined;
      try {
        if (await this._storage.cache.has(cacheKey)) {
          cachedResult = await this._storage.cache.get<boolean>(cacheKey);
        }
      } catch {
        cachedResult = undefined;
      }
      if (cachedResult !== undefined) {
        return cachedResult;
      }
    }
    const trySetCache = async <T>(result: T): Promise<T> => {
      if (cacheKey) {
        try {
          await this._storage.cache?.set(cacheKey, result);
        } catch {
          // Swallow cache adapter errors
        }
      }
      return result;
    };

    const rules = await this._storage.queryRules(action as string, resource as string);
    return await trySetCache(rules.some((item) => item.effect === 'allow'));
  }

  private async _canAll(checks: CanCheckItem<Meta>[]): Promise<boolean> {
    const context = await this._resolveContext();
    let serializedContext: string | undefined;
    if (this._storage.cache) {
      try {
        serializedContext = stableStringify(context);
      } catch {
        // Swallow: no caching for this batch
      }
    }

    for (const [action, resource] of checks) {
      let cacheKey: string | null = null;
      if (this._storage.cache && serializedContext !== undefined) {
        try {
          cacheKey = `can/${String(action)}:${resource[0]}:${stableStringify(resource[1])}:${serializedContext}`;

          if (await this._storage.cache.has(cacheKey)) {
            const cached = await this._storage.cache.get<boolean>(cacheKey);
            if (cached !== undefined) {
              if (!cached) return false;
              continue;
            }
          }
        } catch {
          // Swallow cache errors, fall through to evaluation
        }
      }

      const result = await this._evaluateCheck(
        action as ExtractResourceAction<Meta, ExtractResourceKeys<Meta>>,
        resource as [
          ExtractResourceKeys<Meta>,
          ExtractResourceModel<Meta, ExtractResourceKeys<Meta>>,
        ],
        context,
      );

      if (cacheKey) {
        try {
          await this._storage.cache?.set(cacheKey, result);
        } catch {
          // Swallow cache adapter errors
        }
      }

      if (!result) return false;
    }
    return true;
  }

  private async _canAny(checks: CanCheckItem<Meta>[]): Promise<boolean> {
    const context = await this._resolveContext();
    let serializedContext: string | undefined;
    if (this._storage.cache) {
      try {
        serializedContext = stableStringify(context);
      } catch {
        // Swallow: no caching for this batch
      }
    }

    for (const [action, resource] of checks) {
      let cacheKey: string | null = null;
      if (this._storage.cache && serializedContext !== undefined) {
        try {
          cacheKey = `can/${String(action)}:${resource[0]}:${stableStringify(resource[1])}:${serializedContext}`;

          if (await this._storage.cache.has(cacheKey)) {
            const cached = await this._storage.cache.get<boolean>(cacheKey);
            if (cached !== undefined) {
              if (cached) return true;
              continue;
            }
          }
        } catch {
          // Swallow cache errors, fall through to evaluation
        }
      }

      const result = await this._evaluateCheck(
        action as ExtractResourceAction<Meta, ExtractResourceKeys<Meta>>,
        resource as [
          ExtractResourceKeys<Meta>,
          ExtractResourceModel<Meta, ExtractResourceKeys<Meta>>,
        ],
        context,
      );

      if (cacheKey) {
        try {
          await this._storage.cache?.set(cacheKey, result);
        } catch {
          // Swallow cache adapter errors
        }
      }

      if (result) return true;
    }
    return false;
  }

  private async _cannot<
    ResourceKey extends ExtractResourceKeys<Meta>,
    Resource extends ExtractResourceModel<Meta, ResourceKey> = ExtractResourceModel<
      Meta,
      ResourceKey
    >,
  >(
    action: ExtractResourceAction<Meta, ResourceKey>,
    resource: [ResourceKey, Resource],
  ): Promise<boolean> {
    return !(await this._can(action, resource));
  }

  private async _cannotAbstract<ResourceKey extends ExtractResourceKeys<Meta>>(
    action: ExtractResourceAction<Meta, ResourceKey>,
    resource: ResourceKey,
  ): Promise<boolean> {
    return !(await this._canAbstract(action, resource));
  }

  private async _cannotAll(checks: CanCheckItem<Meta>[]): Promise<boolean> {
    return !(await this._canAny(checks));
  }

  private async _cannotAny(checks: CanCheckItem<Meta>[]): Promise<boolean> {
    return !(await this._canAll(checks));
  }
}

type SetRulesCallback<Meta extends GuantrMeta<GuantrResourceMap> | undefined = undefined> = (
  allow: <ResourceKey extends ExtractResourceKeys<Meta>>(
    action: GuantrRule<Meta, ResourceKey>['action'],
    resource:
      | GuantrRule<Meta, ResourceKey>['resource']
      | [
          GuantrRule<Meta, ResourceKey>['resource'],
          GuantrRule<Meta, ResourceKey>['matchCondition'],
        ],
  ) => void,
  deny: <ResourceKey extends ExtractResourceKeys<Meta>>(
    action: GuantrRule<Meta, ResourceKey>['action'],
    resource:
      | GuantrRule<Meta, ResourceKey>['resource']
      | [
          GuantrRule<Meta, ResourceKey>['resource'],
          GuantrRule<Meta, ResourceKey>['matchCondition'],
        ],
  ) => void,
) => void | Promise<void>;

/**
 * Creates a new Guantr instance.
 *
 * This is the recommended entry point. It supports several call signatures:
 *
 * - `createGuantr(options)` — with storage and context options.
 * - `createGuantr(rules, options?)` — with initial rule array.
 * - `createGuantr(callback, options?)` — with rule-defining callback.
 * - `createGuantr()` — bare instance, set rules later via `setRules()`.
 *
 * @typeParam Meta - A {@link GuantrMeta} type for typed resource maps and context,
 *   or `undefined` for untyped mode.
 * @param setRulesOrOptions - Optional rules array, callback, or options object.
 * @param _options - Options when rules are provided as the first argument.
 * @returns A promise resolving to a configured {@link Guantr} instance.
 *
 * @example
 * ```ts
 * // With context and custom storage
 * const guantr = await createGuantr<MyMeta>({
 *   storage: new MyStorage(),
 *   context: () => ({ userId: 1 }),
 * });
 * ```
 *
 * @example
 * ```ts
 * // With static context (plain object)
 * const guantr = await createGuantr<MyMeta>({
 *   context: { userId: 1, role: 'admin' },
 * });
 * ```
 *
 * @example
 * ```ts
 * // With initial rules callback
 * const guantr = await createGuantr<MyMeta>(async (allow, deny) => {
 *   allow('read', 'post');
 * });
 * ```
 */
export async function createGuantr<
  Meta extends GuantrMeta<GuantrResourceMap> | undefined = undefined,
>(options: GuantrOptions<GuantrContextFromMeta<Meta>>): Promise<Guantr<Meta>>;
export async function createGuantr<
  Meta extends GuantrMeta<GuantrResourceMap> | undefined = undefined,
>(
  setRules: SetRulesCallback<Meta>,
  options?: GuantrOptions<GuantrContextFromMeta<Meta>>,
): Promise<Guantr<Meta>>;
export async function createGuantr<
  Meta extends GuantrMeta<GuantrResourceMap> | undefined = undefined,
>(
  setRules: GuantrRule<Meta>[],
  options?: GuantrOptions<GuantrContextFromMeta<Meta>>,
): Promise<Guantr<Meta>>;
export async function createGuantr<
  Meta extends GuantrMeta<GuantrResourceMap> | undefined = undefined,
>(): Promise<Guantr<Meta>>;
export async function createGuantr<
  Meta extends GuantrMeta<GuantrResourceMap> | undefined = undefined,
>(
  setRulesOrOptions?:
    | SetRulesCallback<Meta>
    | GuantrRule<Meta>[]
    | GuantrOptions<GuantrContextFromMeta<Meta>>,
  _options?: GuantrOptions<GuantrContextFromMeta<Meta>>,
): Promise<Guantr<Meta>> {
  const isSetRulesArgument = (arg: unknown): arg is GuantrRule<Meta>[] | SetRulesCallback<Meta> => {
    return Array.isArray(arg) || typeof arg === 'function';
  };
  const rules = isSetRulesArgument(setRulesOrOptions) ? setRulesOrOptions : undefined;
  const options =
    _options ?? (isSetRulesArgument(setRulesOrOptions) ? undefined : setRulesOrOptions);

  const instance = new Guantr<Meta>(options);
  if (rules) {
    await instance.setRules(rules as GuantrRule<Meta>[]);
  }

  return instance;
}
