import type { Storage } from './storage/types';
import type {
  GuantrMeta,
  GuantrAnyRule,
  GuantrRule,
  GuantrResourceMap,
  GuantrOptions,
} from './types';
import { InMemoryStorage } from './storage';
import { getContextValue, isContextualOperand, matchRuleCondition } from './utils';

export type {
  GuantrMeta,
  GuantrOptions,
  ConditionOperator,
  GuantrResource,
  GuantrResourceAction,
  GuantrResourceModel,
  GuantrResourceMap,
  GuantrRule,
  GuantrRuleCondition,
  GuantrAnyRuleCondition,
  GuantrAnyRuleConditionExpression,
  GuantrAnyRule,
} from './types';

// Extract commonly used type patterns to reduce repetition
type ExtractResourceKeys<Meta> = Meta extends GuantrMeta<infer U> ? keyof U : string;
type ExtractResourceAction<Meta, K> =
  Meta extends GuantrMeta<infer U> ? U[K & keyof U]['action'] : string;
type ExtractResourceModel<Meta, K> =
  Meta extends GuantrMeta<infer U> ? U[K & keyof U]['model'] : Record<string, unknown>;

/**
 * Typed callable for `guantr.can`. Supports two call signatures and a nested `.abstract()` sub-method.
 */
type CanMethod<Meta extends GuantrMeta<GuantrResourceMap> | undefined> = {
  /**
   * @deprecated String-mode does NOT evaluate conditions or deny rules — only checks if any allow rule exists.
   * Use `can.abstract()` for this behavior, or `can(action, [resourceKey, instance])` for full evaluation.
   */
  <ResourceKey extends ExtractResourceKeys<Meta>>(
    action: ExtractResourceAction<Meta, ResourceKey>,
    resource: ResourceKey,
  ): Promise<boolean>;

  /**
   * Checks if the user has permission to perform the specified action on the given resource instance.
   * Evaluates all matching conditions and deny rules.
   *
   * @template ResourceKey - The type of the resource key.
   * @template Resource - The type of the resource model.
   * @param action - The action to check.
   * @param resource - A tuple of `[resourceKey, resourceInstance]`.
   * @returns `true` if at least one allow rule matches and no deny rule matches.
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
   *
   * Use for UI hints (e.g. "should I show the Edit button?"), NOT for access control decisions.
   * For full evaluation against a resource instance, use `can(action, [resourceKey, instance])`.
   */
  abstract<ResourceKey extends ExtractResourceKeys<Meta>>(
    action: ExtractResourceAction<Meta, ResourceKey>,
    resource: ResourceKey,
  ): Promise<boolean>;
};

/**
 * Typed callable for `guantr.cannot`. Logical negation of `CanMethod`.
 */
type CannotMethod<Meta extends GuantrMeta<GuantrResourceMap> | undefined> = {
  /**
   * @deprecated String-mode does NOT evaluate conditions or deny rules — only checks if any allow rule exists.
   * Use `cannot.abstract()` for this behavior, or `cannot(action, [resourceKey, instance])` for full evaluation.
   */
  <ResourceKey extends ExtractResourceKeys<Meta>>(
    action: ExtractResourceAction<Meta, ResourceKey>,
    resource: ResourceKey,
  ): Promise<boolean>;

  /**
   * Checks if the user does NOT have permission to perform the specified action on the given resource instance.
   * Evaluates all matching conditions and deny rules.
   *
   * @template ResourceKey - The type of the resource key.
   * @template Resource - The type of the resource model.
   * @param action - The action to check.
   * @param resource - A tuple of `[resourceKey, resourceInstance]`.
   * @returns `true` if no allow rule matches, or a deny rule matches.
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
   * Abstract permission check (negated).
   * Returns `true` if NO allow rule exists for the given action + resource pair.
   * Does NOT evaluate conditions or deny rules.
   *
   * Use for UI hints (e.g. "should I hide the Delete button?"), NOT for access control decisions.
   */
  abstract<ResourceKey extends ExtractResourceKeys<Meta>>(
    action: ExtractResourceAction<Meta, ResourceKey>,
    resource: ResourceKey,
  ): Promise<boolean>;
};

export class Guantr<
  Meta extends GuantrMeta<GuantrResourceMap> | undefined = undefined,
  Context extends Record<string, unknown> = Record<string, unknown>,
> {
  private _storage: Storage;
  private _getContext: () => Context | PromiseLike<Context>;
  private static readonly MAX_ITERATIONS = 1000;

  /**
   * Controls whether deprecation warnings are emitted for string-mode `can()` usage.
   * Automatically enabled in non-production environments. Can be disabled via `Guantr.devWarnings = false`.
   */
  static devWarnings: boolean =
    (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV !==
    'production';

  private static readonly _stringModeWarnedKeys = new Set<string>();

  /**
   * Check whether an action is permitted on a resource.
   *
   * - `can(action, resourceKey)` — *(deprecated)* abstract check; ignores conditions and deny rules.
   * - `can(action, [resourceKey, instance])` — full evaluation against the resource instance.
   * - `can.abstract(action, resourceKey)` — explicit abstract check for UI hints.
   */
  readonly can!: CanMethod<Meta>;

  /**
   * Check whether an action is denied on a resource. Logical negation of `can`.
   *
   * - `cannot(action, resourceKey)` — *(deprecated)* abstract check; ignores conditions and deny rules.
   * - `cannot(action, [resourceKey, instance])` — full evaluation against the resource instance.
   * - `cannot.abstract(action, resourceKey)` — explicit abstract check for UI hints.
   */
  readonly cannot!: CannotMethod<Meta>;

  /**
   * Initializes a new instance of the Guantr class with an optional ctx.
   *
   * @param {Object} options - An optional object containing the context & storage configuration.
   * @param {Context} options.context - Optional context object to set.
   * @param {Storage} options.storage - Optional storage object to use. Defaults to InMemoryStorage.
   */
  constructor(options?: GuantrOptions<Context>) {
    this._storage = options?.storage || new InMemoryStorage();
    this._getContext = options?.getContext || (() => Promise.resolve({} as Context));

    this.can = Object.assign(
      <
        ResourceKey extends ExtractResourceKeys<Meta>,
        Resource extends ExtractResourceModel<Meta, ResourceKey> = ExtractResourceModel<
          Meta,
          ResourceKey
        >,
      >(
        action: ExtractResourceAction<Meta, ResourceKey>,
        resource: ResourceKey | [ResourceKey, Resource],
      ) => this._can(action, resource),
      {
        abstract: <ResourceKey extends ExtractResourceKeys<Meta>>(
          action: ExtractResourceAction<Meta, ResourceKey>,
          resource: ResourceKey,
        ) => this._canAbstract(action, resource),
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
        resource: ResourceKey | [ResourceKey, Resource],
      ) => this._cannot(action, resource),
      {
        abstract: <ResourceKey extends ExtractResourceKeys<Meta>>(
          action: ExtractResourceAction<Meta, ResourceKey>,
          resource: ResourceKey,
        ) => this._cannotAbstract(action, resource),
      },
    ) as CannotMethod<Meta>;
  }

  /**
   * Sets rules based on the provided callback functions.
   *
   * @param {Function} callback - The callback function that defines rules.
   * @param {Function} callback.can - The function to set rules when allowed.
   * @param {Function} callback.cannot - The function to set rules when denied.
   */
  setRules(callback: SetRulesCallback<Meta, Context>): Promise<void>;
  /**
   * Sets the rules for the Guantr instance.
   *
   * @param {GuantrRule<Meta, Context>[]} rules - The array of rules to set.
   */
  setRules(rules: GuantrRule<Meta, Context>[]): Promise<void>;
  setRules(
    callbackOrRules: SetRulesCallback<Meta, Context> | GuantrRule<Meta, Context>[],
  ): Promise<void> {
    this._storage.clearRules();
    this._storage.cache?.clear();

    if (Array.isArray(callbackOrRules)) {
      return this._storage.setRules(callbackOrRules as GuantrAnyRule[]);
    }

    const rules: GuantrAnyRule[] = [];
    callbackOrRules(
      (action, resource) =>
        rules.push({
          action,
          resource: typeof resource === 'string' ? resource : resource[0],
          condition:
            typeof resource === 'string' ? null : (resource[1] as GuantrAnyRule['condition']),
          effect: 'allow',
        }),
      (action, resource) =>
        rules.push({
          action,
          resource: typeof resource === 'string' ? resource : resource[0],
          condition:
            typeof resource === 'string' ? null : (resource[1] as GuantrAnyRule['condition']),
          effect: 'deny',
        }),
    );
    return this._storage.setRules(rules);
  }

  /**
   * Returns the rules of the Guantr instance as a read-only array of GuantrAnyRule objects.
   *
   * @return {Promise<ReadonlyArray<GuantrAnyRule>>} The rules of the Guantr instance.
   */
  getRules(): Promise<ReadonlyArray<GuantrAnyRule>> {
    return this._storage.getRules();
  }

  /**
   * Filters rules based on the provided action and resource.
   *
   * @param {ExtractResourceAction<Meta, ResourceKey>} action - The action to filter rules.
   * @param {ResourceKey} resource - The resource key to filter rules.
   * @param {Object} options - An optional object containing the applyConditionContextualOperands flag.
   * @param {boolean} options.applyConditionContextualOperands - A flag indicating whether to apply contextual operands to each rules condition.
   * @return {GuantrAnyRule[]} The filtered rules based on the action and resource.
   */
  async relatedRulesFor<ResourceKey extends ExtractResourceKeys<Meta>>(
    action: ExtractResourceAction<Meta, ResourceKey>,
    resource: ResourceKey,
    options?: { applyConditionContextualOperands?: boolean },
  ): Promise<GuantrAnyRule[]> {
    const rules = await this._storage.queryRules(action as string, resource as string);
    if (options?.applyConditionContextualOperands) {
      return await Promise.all(
        rules.map(async (rule) => ({
          ...rule,
          condition: await this.applyContextualOperands(rule.condition),
        })),
      );
    }
    return rules;
  }

  private async _can<
    ResourceKey extends ExtractResourceKeys<Meta>,
    Resource extends ExtractResourceModel<Meta, ResourceKey> = ExtractResourceModel<
      Meta,
      ResourceKey
    >,
  >(
    action: ExtractResourceAction<Meta, ResourceKey>,
    resource: ResourceKey | [ResourceKey, Resource],
  ): Promise<boolean> {
    const context = await this._getContext();

    let cacheKey: string | null = null;
    if (this._storage.cache) {
      cacheKey =
        typeof resource === 'string'
          ? `can/${action}:${resource}:${JSON.stringify(context)}`
          : `can/${action}:${resource[0]}:${JSON.stringify(resource[1])}:${JSON.stringify(context)}`;

      let cachedResult: boolean | undefined = undefined;
      try {
        cachedResult = this._storage.cache.has
          ? (await this._storage.cache.has(cacheKey))
            ? await this._storage.cache.get<boolean>(cacheKey)
            : undefined
          : await this._storage.cache.get<boolean>(cacheKey);
      } catch {
        // Swallow cache adapter errors and treat as cache miss
        cachedResult = undefined;
      }
      if (cachedResult !== undefined) {
        return cachedResult;
      }
    }
    const trySetCache = async <T>(result: T): Promise<T> => {
      if (cacheKey) {
        await this._storage.cache?.set(cacheKey, result);
      }
      return result as T;
    };

    if (typeof resource === 'string') {
      if (Guantr.devWarnings) {
        const warnKey = `${action as string}:${resource as string}`;
        if (!Guantr._stringModeWarnedKeys.has(warnKey)) {
          Guantr._stringModeWarnedKeys.add(warnKey);
          console.warn(
            `[guantr] String-mode permission check deprecated: ` +
              `can/cannot('${action as string}', '${resource as string}'). ` +
              `This only checks for any allow rule's existence — conditions and deny rules are NOT evaluated. ` +
              `For abstract checks: use can.abstract() / cannot.abstract(). ` +
              `For full evaluation: use can/cannot('${action as string}', ['${resource as string}', instance]).`,
          );
        }
      }
      const rules = await this._storage.queryRules(action as string, resource as string);
      return await trySetCache(rules.some((item) => item.effect === 'allow'));
    }

    // Retrieve all rules for the given action and resource key & apply condition contextual operand replacement.
    const rawRules = await this._storage.queryRules(action as string, resource[0] as string);
    const rules = await Promise.all(
      rawRules.map(async (rule) => ({
        ...rule,
        condition: await this.applyContextualOperands(rule.condition, context),
      })),
    );
    if (rules.length === 0) {
      return await trySetCache(false);
    }

    const allowed: boolean[] = [];
    const denied: boolean[] = [];
    let iterationCount = 0; // Counter for circuit breaking.
    for (const rule of rules) {
      iterationCount++;
      // Circuit breaker: if iterations exceed MAX_ITERATIONS, break out.
      if (iterationCount > Guantr.MAX_ITERATIONS) {
        return await trySetCache(false);
      }
      // If no condition is set, consider it as a direct allow/deny.
      if (!rule.condition) {
        if (rule.effect === 'allow') allowed.push(true);
        else denied.push(false);
        continue;
      }
      // Evaluate the condition using the matching utility.
      const matched = matchRuleCondition(resource[1], rule.condition);
      if (matched) {
        if (rule.effect === 'allow') allowed.push(true);
        else denied.push(false);
      } else {
        if (rule.effect === 'allow') allowed.push(false);
        else denied.push(true);
      }
    }

    // Determine the final result: rule is granted if at least one positive match
    // exists and no corresponding inverted match invalidates it.
    const result = allowed.includes(true) && !denied.includes(false);
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
        cachedResult = this._storage.cache.has
          ? (await this._storage.cache.has(cacheKey))
            ? await this._storage.cache.get<boolean>(cacheKey)
            : undefined
          : await this._storage.cache.get<boolean>(cacheKey);
      } catch {
        cachedResult = undefined;
      }
      if (cachedResult !== undefined) {
        return cachedResult;
      }
    }
    const trySetCache = async <T>(result: T): Promise<T> => {
      if (cacheKey) {
        await this._storage.cache?.set(cacheKey, result);
      }
      return result as T;
    };

    const rules = await this._storage.queryRules(action as string, resource as string);
    return await trySetCache(rules.some((item) => item.effect === 'allow'));
  }

  private async _cannot<
    ResourceKey extends ExtractResourceKeys<Meta>,
    Resource extends ExtractResourceModel<Meta, ResourceKey> = ExtractResourceModel<
      Meta,
      ResourceKey
    >,
  >(
    action: ExtractResourceAction<Meta, ResourceKey>,
    resource: ResourceKey | [ResourceKey, Resource],
  ): Promise<boolean> {
    return !(await this._can(action, resource));
  }

  private async _cannotAbstract<ResourceKey extends ExtractResourceKeys<Meta>>(
    action: ExtractResourceAction<Meta, ResourceKey>,
    resource: ResourceKey,
  ): Promise<boolean> {
    return !(await this._canAbstract(action, resource));
  }

  private async applyContextualOperands(
    condition: GuantrAnyRule['condition'],
    context?: Context,
  ): Promise<GuantrAnyRule['condition']> {
    if (condition == null) {
      return null;
    }

    const resolvedContext = context ?? (await this._getContext());

    let cacheKey: string | null = null;
    if (this._storage.cache) {
      cacheKey = `applyContextualOperands/${JSON.stringify(condition)}:${JSON.stringify(resolvedContext)}`;
      let cachedResult: GuantrAnyRule['condition'] | undefined = undefined;
      try {
        cachedResult = this._storage.cache.has
          ? (await this._storage.cache.has(cacheKey))
            ? await this._storage.cache.get<GuantrAnyRule['condition']>(cacheKey)
            : undefined
          : await this._storage.cache.get<GuantrAnyRule['condition']>(cacheKey);
      } catch {
        // Swallow cache adapter errors and treat as cache miss
        cachedResult = undefined;
      }
      if (cachedResult !== undefined) {
        return cachedResult;
      }
    }
    const trySetCache = async <T>(result: T): Promise<T> => {
      if (cacheKey) {
        await this._storage.cache?.set(cacheKey, result);
      }
      return result as T;
    };

    // Recursive helper function to traverse and process the condition.
    const traverse = (obj: any): any => {
      if (isContextualOperand(obj)) {
        return getContextValue(resolvedContext, obj);
      }

      if (Array.isArray(obj)) {
        return obj.map((element) => traverse(element));
      }

      if (obj !== null && typeof obj === 'object') {
        const result: any = {};
        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            result[key] = traverse(obj[key]);
          }
        }
        return result;
      }

      return obj;
    };

    return await trySetCache(traverse(condition));
  }
}

type SetRulesCallback<
  Meta extends GuantrMeta<GuantrResourceMap> | undefined = undefined,
  Context extends Record<string, unknown> = Record<string, unknown>,
> = (
  can: <ResourceKey extends ExtractResourceKeys<Meta>>(
    action: GuantrRule<Meta, Context, ResourceKey>['action'],
    resource:
      | GuantrRule<Meta, Context, ResourceKey>['resource']
      | [
          GuantrRule<Meta, Context, ResourceKey>['resource'],
          GuantrRule<Meta, Context, ResourceKey>['condition'],
        ],
  ) => void,
  cannot: <ResourceKey extends ExtractResourceKeys<Meta>>(
    action: GuantrRule<Meta, Context, ResourceKey>['action'],
    resource:
      | GuantrRule<Meta, Context, ResourceKey>['resource']
      | [
          GuantrRule<Meta, Context, ResourceKey>['resource'],
          GuantrRule<Meta, Context, ResourceKey>['condition'],
        ],
  ) => void,
) => void;

export async function createGuantr<
  Meta extends GuantrMeta<GuantrResourceMap> | undefined = undefined,
  Context extends Record<string, unknown> = Record<string, unknown>,
>(options: GuantrOptions<Context>): Promise<Guantr<Meta, Context>>;
export async function createGuantr<
  Meta extends GuantrMeta<GuantrResourceMap> | undefined = undefined,
  Context extends Record<string, unknown> = Record<string, unknown>,
>(
  setRules: SetRulesCallback<Meta, Context>,
  options?: GuantrOptions<Context>,
): Promise<Guantr<Meta, Context>>;
export async function createGuantr<
  Meta extends GuantrMeta<GuantrResourceMap> | undefined = undefined,
  Context extends Record<string, unknown> = Record<string, unknown>,
>(
  setRules: GuantrRule<Meta, Context>[],
  options?: GuantrOptions<Context>,
): Promise<Guantr<Meta, Context>>;
export async function createGuantr<
  Meta extends GuantrMeta<GuantrResourceMap> | undefined = undefined,
  Context extends Record<string, unknown> = Record<string, unknown>,
>(): Promise<Guantr<Meta, Context>>;
/**
 * Creates a new instance of the Guantr class.
 *
 * @return {Guantr<Meta>} A new instance of the Guantr class.
 */
export async function createGuantr<
  Meta extends GuantrMeta<GuantrResourceMap> | undefined = undefined,
  Context extends Record<string, unknown> = Record<string, unknown>,
>(
  setRulesOrOptions?:
    | SetRulesCallback<Meta, Context>
    | GuantrRule<Meta, Context>[]
    | GuantrOptions<Context>,
  _options?: GuantrOptions<Context>,
): Promise<Guantr<Meta, Context>> {
  const isSetRulesArgument = (
    arg: unknown,
  ): arg is GuantrRule<Meta, Context>[] | SetRulesCallback<Meta, Context> => {
    return Array.isArray(arg) || typeof arg === 'function';
  };
  const rules = isSetRulesArgument(setRulesOrOptions) ? setRulesOrOptions : undefined;
  const options =
    _options ?? (isSetRulesArgument(setRulesOrOptions) ? undefined : setRulesOrOptions);

  const instance = new Guantr<Meta, Context>(options);
  if (rules) {
    await instance.setRules(rules as any);
  }

  return instance;
}
