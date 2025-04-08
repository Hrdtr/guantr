import type { GuantrMeta, GuantrAnyRule, GuantrRule, GuantrResourceMap, GuantrOptions } from "./types";
import type { Storage } from "./storage/types";
import { InMemoryStorage } from "./storage";
import { getContextValue, isContextualOperand, matchRuleCondition } from "./utils";

export type {
  GuantrMeta,
  GuantrResource,
  GuantrResourceAction,
  GuantrResourceModel,
  GuantrResourceMap,
  GuantrRule,
  GuantrRuleCondition,
  GuantrAnyRuleCondition,
  GuantrAnyRuleConditionExpression,
  GuantrAnyRule,
} from './types'

export class Guantr<
  Meta extends GuantrMeta<GuantrResourceMap> | undefined = undefined,
  Context extends Record<string, unknown> = Record<string, unknown>
> {
  private _storage: Storage
  private _getContext: () => Context | PromiseLike<Context>;
  private static readonly MAX_ITERATIONS = 1000;

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
  }

  /**
   * Sets rules based on the provided callback functions.
   *
   * @param {Function} callback - The callback function that defines rules.
   * @param {Function} callback.can - The function to set rules when allowed.
   * @param {Function} callback.cannot - The function to set rules when denied.
   */
  setRules(callback: SetRulesCallback<Meta, Context>): Promise<void>
  /**
   * Sets the rules for the Guantr instance.
   *
   * @param {GuantrRule<Meta, Context>[]} rules - The array of rules to set.
   */
  setRules(rules: GuantrRule<Meta, Context>[]): Promise<void>
  setRules(callbackOrRules: SetRulesCallback<Meta, Context> | GuantrRule<Meta, Context>[]): Promise<void> {
    this._storage.clearRules()
    this._storage.cache?.clear()

    if (Array.isArray(callbackOrRules)) {
      return this._storage.setRules(callbackOrRules as GuantrAnyRule[])
    }

    const rules: GuantrAnyRule[] = []
    callbackOrRules(
      (action, resource) => rules.push({
        action,
        resource: typeof resource === 'string' ? resource : resource[0],
        condition: typeof resource === 'string' ? null : resource[1] as GuantrAnyRule['condition'],
        effect: 'allow'
      }),
      (action, resource) => rules.push({
        action,
        resource: typeof resource === 'string' ? resource : resource[0],
        condition: typeof resource === 'string' ? null : resource[1] as GuantrAnyRule['condition'],
        effect: 'deny'
      }),
    )
    return this._storage.setRules(rules)
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
   * @param {Meta extends GuantrMeta<infer _, infer Action> ? Action : string} action - The action to filter rules.
   * @param {ResourceKey} resource - The resource key to filter rules.
   * @param {Object} options - An optional object containing the applyConditionContextualOperands flag.
   * @param {boolean} options.applyConditionContextualOperands - A flag indicating whether to apply contextual operands to each rules condition.
   * @return {GuantrAnyRule[]} The filtered rules based on the action and resource.
   */
  async relatedRulesFor<ResourceKey extends (Meta extends GuantrMeta<infer U> ? keyof U : string)>(
    action: Meta extends GuantrMeta<infer U> ? U[ResourceKey]['action'] : string,
    resource: ResourceKey,
    options?: { applyConditionContextualOperands?: boolean }
  ): Promise<GuantrAnyRule[]> {
    const rules = await this._storage.queryRules(action as string, resource as string)
    if (options?.applyConditionContextualOperands) {
      return await Promise.all(rules.map(async (rule) => ({
        ...rule,
        condition: await this.applyContextualOperands(rule.condition)
      })))
    }
    return rules
  }

  /**
   * Checks if the user has rule to perform the specified action on the given resource.
   *
   * @template ResourceKey - The type of the resource key.
   * @template Resource - The type of the resource.
   * @param {Meta extends GuantrMeta<infer _, infer Action> ? Action : string} action - The action to check rule for.
   * @param {ResourceKey | [ResourceKey, Resource]} resource - The resource to check rule for. If a string is provided, it is treated as the resource key. If an array is provided, the first element is treated as the resource key and the second element is the resource itself.
   * @return {boolean} Returns `true` if the user has rule, `false` otherwise.
   */
  async can<
    ResourceKey extends (Meta extends GuantrMeta<infer U> ? keyof U : string),
    Resource extends (Meta extends GuantrMeta<infer U> ? U[ResourceKey]['model'] : Record<string, unknown>)
  >(
    action: Meta extends GuantrMeta<infer U> ? U[ResourceKey]['action'] : string,
    resource: ResourceKey | [ResourceKey, Resource]
  ): Promise<boolean> {
    const context = await this._getContext()

    let cacheKey: string | null = null;
    if (this._storage.cache) {
      cacheKey = typeof resource === "string"
        ? `can/${action}:${resource}:${JSON.stringify(context)}`
        : `can/${action}:${resource[0]}:${JSON.stringify(resource[1])}:${JSON.stringify(context)}`;

      const cachedResult = this._storage.cache.has
        ? (await this._storage.cache.has(cacheKey) ? await this._storage.cache.get<boolean>(cacheKey) : null)
        : (await this._storage.cache.get<boolean>(cacheKey));
      if (cachedResult != null) {
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
      const rules = await this._storage.queryRules(action as string, resource as string);
      return await trySetCache(rules.some(item => item.effect === 'allow'));
    }

    // Retrieve all rules for the given action and resource key & apply condition contextual operand replacement.
    const rules = await this.relatedRulesFor(action, resource[0], { applyConditionContextualOperands: true })
    if (rules.length === 0) {
      return await trySetCache(false)
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

  /**
   * Checks if the user does not have rule to perform the specified action on the given resource.
   *
   * @template ResourceKey - The type of the resource key.
   * @template Resource - The type of the resource.
   * @param {Meta extends GuantrMeta<infer _, infer Action> ? Action : string} action - The action to check rule for.
   * @param {ResourceKey | [ResourceKey, Resource]} resource - The resource to check rule for. If a string is provided, it is treated as the resource key. If an array is provided, the first element is treated as the resource key and the second element is the resource itself.
   * @return {boolean} Returns `true` if the user does not have rule, `false` otherwise.
   */
  async cannot<
    ResourceKey extends (Meta extends GuantrMeta<infer U> ? keyof U : string),
    Resource extends (Meta extends GuantrMeta<infer U> ? U[ResourceKey]['model'] : Record<string, unknown>)
  >(
    action: Meta extends GuantrMeta<infer U> ? U[ResourceKey]['action'] : string,
    resource: ResourceKey | [ResourceKey, Resource]
  ): Promise<boolean> {
    return !(await this.can(action, resource))
  }

  private async applyContextualOperands(
    condition: GuantrAnyRule['condition']
  ): Promise<GuantrAnyRule['condition']> {
    if (condition == null) {
      return null
    };

    const context = await this._getContext();

    let cacheKey: string | null = null
    if (this._storage.cache) {
      cacheKey = `applyContextualOperands/${JSON.stringify(condition)}:${JSON.stringify(context)}`;
      const cachedResult = this._storage.cache.has
        ? (await this._storage.cache.has(cacheKey) ? await this._storage.cache.get<GuantrAnyRule['condition']>(cacheKey) : null)
        : (await this._storage.cache.get<GuantrAnyRule['condition']>(cacheKey));
      if (cachedResult != null) {
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
        return getContextValue(context, obj)
      }

      if (Array.isArray(obj)) {
        return obj.map((element) => traverse(element));
      }

      if (obj !== null && typeof obj === "object") {
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
  Context extends Record<string, unknown> = Record<string, unknown>
> = (
  can: <ResourceKey extends (Meta extends GuantrMeta<infer U> ? keyof U : string)>(
    action: GuantrRule<Meta, Context, ResourceKey>['action'],
    resource: GuantrRule<Meta, Context, ResourceKey>['resource'] | [
      GuantrRule<Meta, Context, ResourceKey>['resource'],
      GuantrRule<Meta, Context, ResourceKey>['condition']
    ],
  ) => void,
  cannot: <ResourceKey extends (Meta extends GuantrMeta<infer U> ? keyof U : string)>(
    action: GuantrRule<Meta, Context, ResourceKey>['action'],
    resource: GuantrRule<Meta, Context, ResourceKey>['resource'] | [
      GuantrRule<Meta, Context, ResourceKey>['resource'],
      GuantrRule<Meta, Context, ResourceKey>['condition']
    ],
  ) => void,
) => void

export async function createGuantr<
  Meta extends GuantrMeta<GuantrResourceMap> | undefined = undefined,
  Context extends Record<string, unknown> = Record<string, unknown>
>(options: GuantrOptions<Context>): Promise<Guantr<Meta, Context>>
export async function createGuantr<
  Meta extends GuantrMeta<GuantrResourceMap> | undefined = undefined,
  Context extends Record<string, unknown> = Record<string, unknown>
>(setRules: SetRulesCallback<Meta, Context>, options?: GuantrOptions<Context>): Promise<Guantr<Meta, Context>>
export async function createGuantr<
  Meta extends GuantrMeta<GuantrResourceMap> | undefined = undefined,
  Context extends Record<string, unknown> = Record<string, unknown>
>(setRules: GuantrRule<Meta, Context>[], options?: GuantrOptions<Context>): Promise<Guantr<Meta, Context>>
export async function createGuantr<
  Meta extends GuantrMeta<GuantrResourceMap> | undefined = undefined,
  Context extends Record<string, unknown> = Record<string, unknown>
>(): Promise<Guantr<Meta, Context>>
/**
 * Creates a new instance of the Guantr class.
 *
 * @return {Guantr<Meta>} A new instance of the Guantr class.
 */
export async function createGuantr<
  Meta extends GuantrMeta<GuantrResourceMap> | undefined = undefined,
  Context extends Record<string, unknown> = Record<string, unknown>
>(setRulesOrOptions?: SetRulesCallback<Meta, Context> | GuantrRule<Meta, Context>[] | GuantrOptions<Context>, _options?: GuantrOptions<Context>): Promise<Guantr<Meta, Context>> {
  const isSetRulesArgument = (arg: unknown): arg is (GuantrRule<Meta, Context>[] | SetRulesCallback<Meta, Context>) => {
    return Array.isArray(arg) || typeof arg === 'function'
  }
  const rules = isSetRulesArgument(setRulesOrOptions) ? setRulesOrOptions : undefined;
  const options = _options ?? (isSetRulesArgument(setRulesOrOptions) ? undefined : setRulesOrOptions);

  const instance = new Guantr<Meta, Context>(options);
  if (rules) {
    await instance.setRules(rules as any);
  }

  return instance
};
