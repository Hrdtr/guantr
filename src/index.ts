import type { GuantrMeta, GuantrAnyPermission, GuantrPermission, GuantrResourceMap } from "./types";
import { getContextValue, isContextualOperand, matchPermissionCondition } from "./utils";

export type {
  GuantrMeta,
  GuantrPermission,
  GuantrResource,
  GuantrResourceAction,
  GuantrResourceModel,
  GuantrResourceMap,
  GuantrCondition,
  GuantrAnyCondition,
  GuantrAnyConditionExpression,
  GuantrAnyPermission,
} from './types'

export class Guantr<
  Meta extends GuantrMeta<GuantrResourceMap> | undefined = undefined,
  Context extends Record<string, unknown> = Record<string, unknown>
> {
  private _context: Context = {} as Context;
  private _permissions: GuantrAnyPermission[] = [];

  /**
   * Initializes a new instance of the Guantr class with an optional context.
   *
   * @param {Object} options - An optional object containing the context.
   * @param {Context} options.context - The context object to use for this instance.
   */
  constructor(options?: { context: Context }) {
    if (options?.context) this._context = options.context;
  }

  /**
   * Updates the context of the Guantr instance and removes the 'withContext' method.
   *
   * @param {T} context - The new context to set.
   * @return {Omit<Guantr<Meta, T>, 'withContext'>} A new instance of Guantr with the updated context.
   */
  withContext<T extends Context>(context: T): Omit<Guantr<Meta, T>, 'withContext'> {
    this._context = context;
    Reflect.deleteProperty(this, 'withContext');
    return this as unknown as Omit<Guantr<Meta, T>, 'withContext'>;
  }

  /**
   * Returns the context of the Guantr instance.
   *
   * @return {Readonly<Context>} The context object.
   */
  get context(): Readonly<Context> {
    return this._context;
  }

  /**
   * Returns the permissions of the Guantr instance as a read-only array of GuantrAnyPermission objects.
   *
   * @return {ReadonlyArray<GuantrAnyPermission>} The permissions of the Guantr instance.
   */
  get permissions(): ReadonlyArray<GuantrAnyPermission> {
    return this._permissions;
  }

  /**
   * Creates a new instance of the Guantr class.
   *
   * @template Meta - The type of metadata associated with the Guantr instance. Defaults to undefined.
   * @template GuantrResourceMap - The type of the resource map used by the Guantr instance.
   * @returns {Guantr<Meta>} - A new instance of the Guantr class.
   */
  static create <Meta extends GuantrMeta<GuantrResourceMap> | undefined = undefined>(): Guantr<Meta> {
    return new Guantr<Meta>();
  }

  /**
   * Sets permissions based on the provided callback functions.
   *
   * @param {Function} callback - The callback function that defines permissions.
   * @param {Function} callback.can - The function to set permissions when allowed.
   * @param {Function} callback.cannot - The function to set permissions when denied.
   */
  setPermission(
    callback: (
      can: <ResourceKey extends (Meta extends GuantrMeta<infer U> ? keyof U : string)>(
        action: GuantrPermission<Meta, Context, ResourceKey>['action'],
        resource: GuantrPermission<Meta, Context, ResourceKey>['resource'] | [
          GuantrPermission<Meta, Context, ResourceKey>['resource'],
          GuantrPermission<Meta, Context, ResourceKey>['condition']
        ],
      ) => void,
      cannot: <ResourceKey extends (Meta extends GuantrMeta<infer U> ? keyof U : string)>(
        action: GuantrPermission<Meta, Context, ResourceKey>['action'],
        resource: GuantrPermission<Meta, Context, ResourceKey>['resource'] | [
          GuantrPermission<Meta, Context, ResourceKey>['resource'],
          GuantrPermission<Meta, Context, ResourceKey>['condition']
        ],
      ) => void,
    ) => void
  ): void {
    this._permissions = []
    callback(
      (action, resource) => this._permissions.push({
        action,
        resource: typeof resource === 'string' ? resource : resource[0],
        condition: typeof resource === 'string' ? null : resource[1] as GuantrAnyPermission['condition'],
        inverted: false
      }),
      (action, resource) => this._permissions.push({
        action,
        resource: typeof resource === 'string' ? resource : resource[0],
        condition: typeof resource === 'string' ? null : resource[1] as GuantrAnyPermission['condition'],
        inverted: true
      }),
    )
  }

  /**
   * Sets the permissions for the Guantr instance.
   *
   * @param {GuantrPermission<Meta, Context>[]} permissions - The array of permissions to set.
   * @return {void} This function does not return anything.
   */
  setPermissions(permissions: GuantrPermission<Meta, Context>[]): void {
    this._permissions = permissions as GuantrAnyPermission[];
  }

  /**
   * Filters permissions based on the provided action and resource.
   *
   * @param {Meta extends GuantrMeta<infer _, infer Action> ? Action : string} action - The action to filter permissions.
   * @param {ResourceKey} resource - The resource key to filter permissions.
   * @return {GuantrAnyPermission[]} The filtered permissions based on the action and resource.
   */
  relatedPermissionsFor<ResourceKey extends (Meta extends GuantrMeta<infer U> ? keyof U : string)>(
    action: Meta extends GuantrMeta<infer U> ? U[ResourceKey]['action'] : string,
    resource: ResourceKey
  ): GuantrAnyPermission[] {
    return this.permissions.filter((item: any) => item.action === action && item.resource === resource)
  }

  /**
   * Checks if the user has permission to perform the specified action on the given resource.
   *
   * @template ResourceKey - The type of the resource key.
   * @template Resource - The type of the resource.
   * @param {Meta extends GuantrMeta<infer _, infer Action> ? Action : string} action - The action to check permission for.
   * @param {ResourceKey | [ResourceKey, Resource]} resource - The resource to check permission for. If a string is provided, it is treated as the resource key. If an array is provided, the first element is treated as the resource key and the second element is the resource itself.
   * @return {boolean} Returns `true` if the user has permission, `false` otherwise.
   */
  can<
    ResourceKey extends (Meta extends GuantrMeta<infer U> ? keyof U : string),
    Resource extends (Meta extends GuantrMeta<infer U> ? U[ResourceKey]['model'] : Record<string, unknown>)
  >(
    action: Meta extends GuantrMeta<infer U> ? U[ResourceKey]['action'] : string,
    resource: ResourceKey | [ResourceKey, Resource]
  ): boolean {
    if (typeof resource === 'string') {
      return this.permissions.some(item => item.action === action && item.resource === resource && !item.inverted)
    }
    const relatedPermissions = this.relatedPermissionsFor(action, resource[0])
    if (relatedPermissions.length === 0) return false

    const passed: boolean[] = []
    const passedInverted: boolean[] = []

    for (const permission of relatedPermissions) {
      if (!permission.condition) {
        if (permission.inverted) passedInverted.push(false)
        else passed.push(true)
        continue
      }
      const matched = matchPermissionCondition(resource[1], permission.condition, this.context)
      if (matched) {
        if (permission.inverted) passedInverted.push(false)
        else passed.push(true)
        continue
      }
      if (permission.inverted) passedInverted.push(true)
      else passed.push(false)
    }

    return passed.includes(true) && !passedInverted.includes(false)
  }

  /**
   * Checks if the user does not have permission to perform the specified action on the given resource.
   *
   * @template ResourceKey - The type of the resource key.
   * @template Resource - The type of the resource.
   * @param {Meta extends GuantrMeta<infer _, infer Action> ? Action : string} action - The action to check permission for.
   * @param {ResourceKey | [ResourceKey, Resource]} resource - The resource to check permission for. If a string is provided, it is treated as the resource key. If an array is provided, the first element is treated as the resource key and the second element is the resource itself.
   * @return {boolean} Returns `true` if the user does not have permission, `false` otherwise.
   */
  cannot<
    ResourceKey extends (Meta extends GuantrMeta<infer U> ? keyof U : string),
    Resource extends (Meta extends GuantrMeta<infer U> ? U[ResourceKey]['model'] : Record<string, unknown>)
  >(
    action: Meta extends GuantrMeta<infer U> ? U[ResourceKey]['action'] : string,
    resource: ResourceKey | [ResourceKey, Resource]
  ): boolean {
    return !this.can(action, resource)
  }

    /**
   * Retrieves the query filter for the specified resource and action, and applies a transformer function to the resulting permissions.
   *
   * @template ResourceKey - The type of the resource key.
   * @template Action - The type of the action.
   * @template R - The type of the result returned by the transformer function.
   * @param {(permissions: GuantrAnyPermission[]) => R} transformer - The transformer function to apply to the permissions.
   * @param {ResourceKey} resource - The resource key for which to retrieve the query filter.
   * @param {Action} [action='read'] - The action for which to retrieve the query filter. Defaults to 'read' if not provided.
   * @return {R} The result of applying the transformer function to the permissions.
   */
    queryFilterFor<
      ResourceKey extends (Meta extends GuantrMeta<infer U> ? keyof U : string),
      R
    >(
      transformer: (permissions: GuantrAnyPermission[]) => R,
      resource: ResourceKey,
      action?: Meta extends GuantrMeta<infer U> ? U[ResourceKey]['action'] : string
    ): R {
    const relatedPermissions = this.relatedPermissionsFor(
      action ?? 'read' as NonNullable<typeof action>,
      resource
    ).map(permission => ({
      ...permission,
      condition: permission.condition
        ? JSON.parse(JSON.stringify(permission.condition), (_, v) => {
            if (isContextualOperand(v)) return getContextValue(this._context, v) ?? v
            return v
          }) as GuantrAnyPermission['condition']
        : null
    }))

    return transformer(relatedPermissions)
  }
}

/**
 * Creates a new instance of the Guantr class.
 *
 * @template Meta - The type of metadata associated with the Guantr instance. Defaults to undefined.
 * @return {Guantr<Meta>} A new instance of the Guantr class.
 */
export const createGuantr = <Meta extends GuantrMeta<GuantrResourceMap> | undefined = undefined>(): Guantr<Meta> =>  {
  const instance = Guantr.create<Meta>();
  return instance
};
