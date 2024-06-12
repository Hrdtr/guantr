import type { GuantrMeta, GuantrAnyPermission, GuantrPermission, GuantrResourceMap } from "./types";
import { getContextValue, isContextualOperand, matchPermissionCondition } from "./utils";

export type { GuantrMeta, GuantrPermission, GuantrResourceMap, GuantrCondition } from './types'

export class Guantr<
  Meta extends GuantrMeta<GuantrResourceMap, string> | undefined = undefined,
  Context extends Record<string, unknown> = Record<string, unknown>
> {
  private _context: Context = {} as Context;
  private _permissions: GuantrAnyPermission[] = [];

  constructor(options?: { context: Context }) {
    if (options?.context) this._context = options.context;
  }

  withContext<T extends Context>(context: T) {
    this._context = context;
    Reflect.deleteProperty(this, 'withContext');
    return this as unknown as Omit<Guantr<Meta, T>, 'withContext'>;
  }

  get context(): Readonly<Context> {
    return this._context;
  }

  get permissions(): ReadonlyArray<GuantrAnyPermission> {
    return this._permissions;
  }
  static create <Meta extends GuantrMeta<GuantrResourceMap, string> | undefined = undefined>() {
    return new Guantr<Meta>();
  }

  setPermission(
    callback: (
      can: <ResourceKey extends (Meta extends GuantrMeta<infer U> ? keyof U : string)>(
        action: GuantrPermission<Meta, Context>['action'],
        resource: GuantrPermission<Meta, Context, ResourceKey>['resource'] | [
          GuantrPermission<Meta, Context, ResourceKey>['resource'],
          GuantrPermission<Meta, Context, ResourceKey>['condition']
        ],
      ) => void,
      cannot: <ResourceKey extends (Meta extends GuantrMeta<infer U> ? keyof U : string)>(
        action: GuantrPermission<Meta, Context>['action'],
        resource: GuantrPermission<Meta, Context, ResourceKey>['resource'] | [
          GuantrPermission<Meta, Context, ResourceKey>['resource'],
          GuantrPermission<Meta, Context, ResourceKey>['condition']
        ],
      ) => void,
    ) => void
  ) {
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

  setPermissions(permissions: GuantrPermission<Meta, Context>[]) {
    this._permissions = permissions as GuantrAnyPermission[];
  }

  relatedPermissionsFor<
    ResourceKey extends (Meta extends GuantrMeta<infer U> ? keyof U : string),
  >(
    action: Meta extends GuantrMeta<infer _, infer Action> ? Action : string,
    resource: ResourceKey
  ) {
    return this.permissions.filter((item: any) => item.action === action && item.resource === resource)
  }

  can<
    ResourceKey extends (Meta extends GuantrMeta<infer U> ? keyof U : string),
    Resource extends (Meta extends GuantrMeta<infer U> ? U[ResourceKey] : Record<string, unknown>)
  >(
    action: Meta extends GuantrMeta<infer _, infer Action> ? Action : string,
    resource: ResourceKey | [ResourceKey, Resource]
  ) {
    if (typeof resource === 'string') {
      return this.permissions.some(item => item.action === action && item.resource === resource && !item.inverted)
    }
    const relatedPermissions = this.relatedPermissionsFor(action, resource[0])
    for (const permission of relatedPermissions) {
      if (!permission.condition) continue
      const pass = matchPermissionCondition(resource[1], permission as GuantrAnyPermission & { condition: NonNullable<GuantrAnyPermission['condition']> }, this.context)
      if (permission.inverted) {
        if (!pass) continue
        return false
      }
      else {
        if (pass) continue
        return false
      }
    }
    return true
  }

  cannot<
    ResourceKey extends (Meta extends GuantrMeta<infer U> ? keyof U : string),
    Resource extends (Meta extends GuantrMeta<infer U> ? U[ResourceKey] : Record<string, unknown>)
  >(
    action: Meta extends GuantrMeta<infer _, infer Action> ? Action : string,
    resource: ResourceKey | [ResourceKey, Resource]
  ) {
    return !this.can(action, resource)
  }

  queryFilterFor<
    ResourceKey extends (Meta extends GuantrMeta<infer U> ? keyof U : string),
    Action extends (Meta extends GuantrMeta<infer _, infer U> ? U : string),
    R
  >(transformer: (permissions: GuantrAnyPermission[]) => R, resource: ResourceKey, action?: Action) {
    const relatedPermissions = this.relatedPermissionsFor(
      action ?? 'read' as Action,
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

export const createGuantr = <Meta extends GuantrMeta<GuantrResourceMap, string> | undefined = undefined>() =>  {
  const instance = Guantr.create<Meta>();
  return instance
};
