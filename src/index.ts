import type { GuantrMeta, GuantrPermission, GuantrResourceMap } from "./types";
import { matchPermissionCondition } from "./utils";

export type { GuantrMeta, GuantrPermission, GuantrResourceMap, GuantrCondition } from './types'

export class Guantr<
  Meta extends GuantrMeta<GuantrResourceMap, string> | undefined = undefined,
  Context extends Record<string, unknown> = Record<string, unknown>
> {
  private _context: Context = {} as Context;
  private _permissions: GuantrPermission<Meta, Context>[] = [];

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

  get permissions(): ReadonlyArray<GuantrPermission<Meta, Context>> {
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
        condition: typeof resource === 'string' ? null : resource[1],
        inverted: false
      } as unknown as GuantrPermission<Meta, Context>),
      (action, resource) => this._permissions.push({
        action,
        resource: typeof resource === 'string' ? resource : resource[0],
        condition: typeof resource === 'string' ? null : resource[1],
        inverted: true
      } as unknown as GuantrPermission<Meta, Context>),
    )
  }

  setPermissions(permissions: GuantrPermission<Meta, Context>[]) {
    this._permissions = permissions;
  }

  relatedPermissionsFor<
    ResourceKey extends (Meta extends GuantrMeta<infer U> ? keyof U : string),
    Resource extends (Meta extends GuantrMeta<infer U> ? U[ResourceKey] : Record<string, unknown>)
  >(
    action: Meta extends GuantrMeta<infer _, infer Action> ? Action : string,
    resource: ResourceKey | [ResourceKey, Resource]
  ) {
    // error TS2589: Type instantiation is excessively deep and possibly infinite.
    return this.permissions.filter((item: any) => item.action === action && item.resource === (typeof resource === 'string' ? resource : resource[0])) as unknown as GuantrPermission<Meta, Context>[]
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
      const pass = matchPermissionCondition(resource[1], permission as GuantrPermission & { condition: NonNullable<GuantrPermission['condition']> }, this.context)
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
}

export const createGuantr = <Meta extends GuantrMeta<GuantrResourceMap, string> | undefined = undefined>() =>  {
  const instance = Guantr.create<Meta>();
  return instance
};
