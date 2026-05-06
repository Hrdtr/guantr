import type { Storage } from './storage/types';
import type {
  GuantrMeta,
  GuantrRule,
  GuantrResourceMap,
  GuantrOptions,
  GuantrContextFromMeta,
} from './types';
import { GuantrCircuitBreakerError } from './errors';
import { InMemoryStorage } from './storage';
import {
  getContextValue,
  isContextualOperand,
  matchRuleCondition,
  validateCondition,
} from './utils';

export {
  GuantrCircuitBreakerError,
  GuantrInvalidConditionError,
  GuantrInvalidConditionKeyError,
  GuantrInvalidConditionOperatorError,
} from './errors';

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
  GuantrRuleConditionExpression,
  GuantrContextFromMeta,
} from './types';

export {
  isConditionExpressionLike,
  isContextualOperand,
  KNOWN_OPERATORS,
  matchConditionExpression,
  matchRuleCondition,
  validateCondition,
  conditionHandlers,
} from './utils';

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
  /**
   * Checks if the user does NOT have permission to perform the specified action on the given resource instance.
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
   * Abstract permission check (negated).
   * Returns `true` if NO allow rule exists for the given action + resource pair.
   * Does NOT evaluate conditions or deny rules.
   */
  abstract<ResourceKey extends ExtractResourceKeys<Meta>>(
    action: ExtractResourceAction<Meta, ResourceKey>,
    resource: ResourceKey,
  ): Promise<boolean>;

  /**
   * Checks if ALL specified permissions are denied.
   * Resolves context once and shares it across all checks.
   * Short-circuits on the first `true` result (first granted permission).
   */
  all(checks: CanCheckItem<Meta>[]): Promise<boolean>;

  /**
   * Checks if ANY of the specified permissions is denied.
   * Resolves context once and shares it across all checks.
   * Short-circuits on the first `false` result (first granted permission).
   */
  any(checks: CanCheckItem<Meta>[]): Promise<boolean>;
};

export class Guantr<Meta extends GuantrMeta<GuantrResourceMap> | undefined = undefined> {
  private _storage: Storage;
  private _getContext: () => GuantrContextFromMeta<Meta> | PromiseLike<GuantrContextFromMeta<Meta>>;
  private readonly _maxRuleIterations: number;
  /**
   * Check whether an action is permitted on a resource.
   *
   * - `can(action, [resourceKey, instance])` — full evaluation against the resource instance.
   * - `can.abstract(action, resourceKey)` — abstract check for UI hints; ignores conditions and deny rules.
   * - `can.all(checks)` — batch check ALL permissions; short-circuits on first `false`.
   * - `can.any(checks)` — batch check ANY permission; short-circuits on first `true`.
   */
  readonly can!: CanMethod<Meta>;

  /**
   * Check whether an action is denied on a resource. Logical negation of `can`.
   *
   * - `cannot(action, [resourceKey, instance])` — full evaluation against the resource instance.
   * - `cannot.abstract(action, resourceKey)` — abstract check for UI hints; ignores conditions and deny rules.
   * - `cannot.all(checks)` — batch check ALL permissions are denied; short-circuits on first `true`.
   * - `cannot.any(checks)` — batch check ANY permission is denied; short-circuits on first `false`.
   */
  readonly cannot!: CannotMethod<Meta>;

  /**
   * Initializes a new instance of the Guantr class.
   *
   * @param {Object} options - An optional object containing the context & storage configuration.
   * @param {Storage} options.storage - Optional storage object to use. Defaults to InMemoryStorage.
   */
  constructor(options?: GuantrOptions<GuantrContextFromMeta<Meta>>) {
    this._storage = options?.storage || new InMemoryStorage();
    this._getContext =
      options?.getContext || (() => Promise.resolve({} as GuantrContextFromMeta<Meta>));

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
   * Sets rules based on the provided callback functions.
   *
   * @param {Function} callback - The callback function that defines rules.
   * @param {Function} callback.allow - The function to set rules when allowed.
   * @param {Function} callback.deny - The function to set rules when denied.
   */
  async setRules(callback: SetRulesCallback<Meta>): Promise<void>;
  /**
   * Sets the rules for the Guantr instance.
   *
   * @param {GuantrRule<Meta>[]} rules - The array of rules to set.
   */
  async setRules(rules: GuantrRule<Meta>[]): Promise<void>;
  async setRules(callbackOrRules: SetRulesCallback<Meta> | GuantrRule<Meta>[]): Promise<void> {
    let nextRules: GuantrRule[];

    if (Array.isArray(callbackOrRules)) {
      nextRules = callbackOrRules as GuantrRule[];
      for (const rule of nextRules) {
        if (rule.condition != null) {
          validateCondition(rule.condition);
        }
      }
    } else {
      const rules: GuantrRule[] = [];
      await callbackOrRules(
        (action, resource) =>
          rules.push({
            action,
            resource: typeof resource === 'string' ? resource : resource[0],
            condition:
              typeof resource === 'string' ? null : (resource[1] as GuantrRule['condition']),
            effect: 'allow',
          }),
        (action, resource) =>
          rules.push({
            action,
            resource: typeof resource === 'string' ? resource : resource[0],
            condition:
              typeof resource === 'string' ? null : (resource[1] as GuantrRule['condition']),
            effect: 'deny',
          }),
      );

      for (const rule of rules) {
        if (rule.condition != null) {
          validateCondition(rule.condition);
        }
      }

      nextRules = rules;
    }

    await this._storage.cache?.clear();
    return this._storage.setRules(nextRules);
  }

  /**
   * Returns the rules of the Guantr instance as a read-only array of GuantrRule objects.
   *
   * @return {Promise<ReadonlyArray<GuantrRule>>} The rules of the Guantr instance.
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
        // Swallow cache adapter errors and treat as cache miss
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
   * Filters rules based on the provided action and resource.
   *
   * @param {ExtractResourceAction<Meta, ResourceKey>} action - The action to filter rules.
   * @param {ResourceKey} resource - The resource key to filter rules.
   * @param {Object} options - An optional object containing the applyConditionContextualOperands flag.
   * @param {boolean} options.applyConditionContextualOperands - A flag indicating whether to apply contextual operands to each rules condition.
   * @return {GuantrRule[]} The filtered rules based on the action and resource.
   */
  async relatedRulesFor<ResourceKey extends ExtractResourceKeys<Meta>>(
    action: ExtractResourceAction<Meta, ResourceKey>,
    resource: ResourceKey,
    options?: { applyConditionContextualOperands?: boolean },
  ): Promise<GuantrRule[]> {
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

  /**
   * Core evaluation of a single permission check, using a pre-resolved context.
   * This is the shared workhorse for `_can`, `_canAll`, and `_canAny`.
   */
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
    serializedContext: string | undefined,
  ): Promise<boolean> {
    // Retrieve all rules for the given action and resource key & apply condition contextual operand replacement.
    const rawRules = await this._storage.queryRules(action as string, resource[0] as string);
    if (rawRules.length === 0) {
      return false;
    }
    // Early exit: an unconditional deny (condition omitted/null, effect: 'deny') guarantees a false
    // result regardless of every other rule, so we can skip all further processing.
    if (rawRules.some((rule) => rule.condition == null && rule.effect === 'deny')) {
      return false;
    }
    const rules = await Promise.all(
      rawRules.map(async (rule) => ({
        ...rule,
        condition: await this.applyContextualOperands(rule.condition, context, serializedContext),
      })),
    );

    const allowed: boolean[] = [];
    const denied: boolean[] = [];
    let iterationCount = 0; // Counter for circuit breaking.
    for (const rule of rules) {
      iterationCount++;
      // Circuit breaker: if iterations exceed maxRuleIterations, throw an error.
      if (iterationCount > this._maxRuleIterations) {
        throw new GuantrCircuitBreakerError(
          action as string,
          resource[0] as string,
          this._maxRuleIterations,
        );
      }
      // If no condition is set, consider it as a direct allow/deny.
      if (!rule.condition) {
        if (rule.effect === 'allow') {
          allowed.push(true);
        } else {
          // Unconditional deny → result is guaranteed false; no need to evaluate further.
          return false;
        }
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
    const context = await this._getContext();
    // Compute serialized context once so it can be reused in both the _can cache key
    // and the inner applyContextualOperands cache key without a second stringify call.
    const serializedContext = this._storage.cache ? JSON.stringify(context) : undefined;

    let cacheKey: string | null = null;
    if (this._storage.cache) {
      cacheKey = `can/${action}:${resource[0]}:${JSON.stringify(resource[1])}:${serializedContext}`;

      let cachedResult: boolean | undefined = undefined;
      try {
        if (await this._storage.cache.has(cacheKey)) {
          cachedResult = await this._storage.cache.get<boolean>(cacheKey);
        }
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

    const result = await this._evaluateCheck(action, resource, context, serializedContext);
    return await trySetCache(result);
  }

  private async _canAll(checks: CanCheckItem<Meta>[]): Promise<boolean> {
    const context = await this._getContext();
    const serializedContext = this._storage.cache ? JSON.stringify(context) : undefined;

    for (const [action, resource] of checks) {
      const result = await this._evaluateCheck(
        // oxlint-disable-next-line typescript/no-explicit-any
        action as any,
        // oxlint-disable-next-line typescript/no-explicit-any
        resource as any,
        context,
        serializedContext,
      );
      if (!result) return false;
    }
    return true;
  }

  private async _canAny(checks: CanCheckItem<Meta>[]): Promise<boolean> {
    const context = await this._getContext();
    const serializedContext = this._storage.cache ? JSON.stringify(context) : undefined;

    for (const [action, resource] of checks) {
      const result = await this._evaluateCheck(
        // oxlint-disable-next-line typescript/no-explicit-any
        action as any,
        // oxlint-disable-next-line typescript/no-explicit-any
        resource as any,
        context,
        serializedContext,
      );
      if (result) return true;
    }
    return false;
  }

  private async _cannotAll(checks: CanCheckItem<Meta>[]): Promise<boolean> {
    // All denied = none allowed = negated `any`
    return !(await this._canAny(checks));
  }

  private async _cannotAny(checks: CanCheckItem<Meta>[]): Promise<boolean> {
    // Any denied = not all allowed = negated `all`
    return !(await this._canAll(checks));
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

  private async applyContextualOperands(
    condition: GuantrRule['condition'],
    context?: GuantrContextFromMeta<Meta>,
    /** Pre-serialized context string, forwarded from the caller to avoid a redundant stringify. */
    serializedContext?: string,
  ): Promise<GuantrRule['condition']> {
    if (condition == null) {
      return null;
    }

    const resolvedContext = context ?? (await this._getContext());

    let cacheKey: string | null = null;
    if (this._storage.cache) {
      // Reuse the pre-serialized context from the caller when available.
      const serializedCtx = serializedContext ?? JSON.stringify(resolvedContext);
      cacheKey = `applyContextualOperands/${JSON.stringify(condition)}:${serializedCtx}`;
      let cachedResult: GuantrRule['condition'] | undefined = undefined;
      try {
        if (await this._storage.cache.has(cacheKey)) {
          cachedResult = await this._storage.cache.get<GuantrRule['condition']>(cacheKey);
        }
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
    // oxlint-disable-next-line typescript/no-explicit-any
    const traverse = (obj: any): any => {
      if (isContextualOperand(obj)) {
        return getContextValue(resolvedContext, obj);
      }

      if (Array.isArray(obj)) {
        return obj.map((element) => traverse(element));
      }

      if (obj !== null && typeof obj === 'object') {
        // oxlint-disable-next-line typescript/no-explicit-any
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

type SetRulesCallback<Meta extends GuantrMeta<GuantrResourceMap> | undefined = undefined> = (
  allow: <ResourceKey extends ExtractResourceKeys<Meta>>(
    action: GuantrRule<Meta, ResourceKey>['action'],
    resource:
      | GuantrRule<Meta, ResourceKey>['resource']
      | [GuantrRule<Meta, ResourceKey>['resource'], GuantrRule<Meta, ResourceKey>['condition']],
  ) => void,
  deny: <ResourceKey extends ExtractResourceKeys<Meta>>(
    action: GuantrRule<Meta, ResourceKey>['action'],
    resource:
      | GuantrRule<Meta, ResourceKey>['resource']
      | [GuantrRule<Meta, ResourceKey>['resource'], GuantrRule<Meta, ResourceKey>['condition']],
  ) => void,
) => void | Promise<void>;

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
/**
 * Creates a new instance of the Guantr class.
 *
 * @return {Guantr<Meta>} A new instance of the Guantr class.
 */
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
    // oxlint-disable-next-line typescript/no-explicit-any
    await instance.setRules(rules as any);
  }

  return instance;
}
