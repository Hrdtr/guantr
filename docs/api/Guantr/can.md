# `can`

The `can` method checks if the user has permission to perform a specified action on a given resource.

## Usage

Use the `can` method to determine whether a user is allowed to execute a particular action on a specific resource. This method evaluates permissions based on the conditions and inversion settings defined in the permissions list.

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

// Check if the user has permission to 'read' on 'posts' resource
const canRead = guantr.can('read', 'posts');
console.log(canRead); // Output: true

// Check if the user has permission to 'write' on 'posts' resource with a specific condition
const canWrite = guantr.can('write', ['posts', { title: 'Special Title' }]);
console.log(canWrite); // Output: true

// Check if the user has permission to 'delete' on 'posts' resource
const canDelete = guantr.can('delete', 'posts');
console.log(canDelete); // Output: false
```

In this example:

1. `guantr.setPermissions`: Sets a list of permissions on the guantr instance.
2. `guantr.can('read', 'posts')`: Checks if the user has permission to perform the 'read' action on the 'posts' resource.
3. `guantr.can('write', ['posts', { title: 'Special Title' }])`: Checks if the user has permission to perform the 'write' action on the 'posts' resource with a specific condition.
4. `guantr.can('delete', 'posts')`: Checks if the user has permission to perform the 'delete' action on the 'posts' resource.

## References

### Signature

```ts
can<
  ResourceKey extends (Meta extends GuantrMeta<infer U> ? keyof U : string),
  Resource extends (Meta extends GuantrMeta<infer U> ? U[ResourceKey]['model'] : Record<string, unknown>)
>(
  action: Meta extends GuantrMeta<infer U> ? U[ResourceKey]['action'] : string,
  resource: ResourceKey | [ResourceKey, Resource]
): boolean
```

### Parameters

- **action** (`Meta extends GuantrMeta<infer U> ? U[ResourceKey]['action'] : string`): The action to check permission for. If metadata is provided, it will use the action type defined in the metadata; otherwise, it defaults to a string.
- **resource** (`ResourceKey | [ResourceKey, Resource]`): The resource to check permission for. If a string is provided, it is treated as the resource key. If an array is provided, the first element is treated as the resource key and the second element is the resource itself.

### Returns

- **boolean**: Returns `true` if the user has permission to perform the specified action on the given resource, otherwise `false`.
