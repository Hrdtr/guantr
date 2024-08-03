# `relatedPermissionsFor`

The `relatedPermissionsFor` method filters and retrieves permissions associated with a specific action and resource from the `Guantr` instance.

## Usage

Use the `relatedPermissionsFor` method to obtain permissions that match a given action and resource key. This is useful for checking what permissions are related to specific actions on particular resources.

### Example

```ts
import { createGuantr } from 'guantr';

// Create a new Guantr instance and set permissions
const guantr = createGuantr();
guantr.setPermissions([
  { action: 'read', resource: 'posts', condition: null, inverted: false },
  { action: 'write', resource: 'posts', condition: { title: { equals: 'Special Title' } }, inverted: false },
  { action: 'delete', resource: 'posts', condition: null, inverted: true }
]);

// Retrieve related permissions for 'read' action on 'posts' resource
const readPermissions = guantr.relatedPermissionsFor('read', 'posts');
console.log(readPermissions);
// Output: [{ action: 'read', resource: 'posts', condition: null, inverted: false }]
```

In this example:

1. `guantr.setPermissions`: Sets a list of permissions on the `guantr` instance.
2. `guantr.relatedPermissionsFor('read', 'posts')`: Retrieves all permissions related to the 'read' action on the 'posts' resource. The returned array includes permissions that match the specified action and resource.

## References

### Signature

```ts
relatedPermissionsFor<ResourceKey extends (Meta extends GuantrMeta<infer U> ? keyof U : string)>(
  action: Meta extends GuantrMeta<infer U> ? U[ResourceKey]['action'] : string,
  resource: ResourceKey
): GuantrAnyPermission[];
```

### Parameters

- **action** (`Meta extends GuantrMeta<infer U> ? U[ResourceKey]['action'] : string`): The action to filter permissions by. If metadata is provided, it will use the action type defined in the metadata; otherwise, it defaults to a string.
- **resource** (`ResourceKey`): The resource key to filter permissions by. It specifies the resource for which the permissions are being retrieved.

### Returns

- **GuantrAnyPermission[]**: An array of permissions related to the specified action and resource. Each permission object contains:
  - action (`string`): The action associated with the permission.
  - resource (`string`): The resource key associated with the permission.
  - condition (`GuantrAnyCondition | null`): The condition for the permission or `null` if no condition is specified.
  - inverted (`boolean`): Whether the permission is denied (`true`) or allowed (`false`).
