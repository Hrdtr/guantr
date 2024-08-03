# `cannot`

The `cannot` method checks if the user does not have permission to perform a specified action on a given resource.

## Usage

Use the `cannot` method to determine whether a user is explicitly denied permission to execute a particular action on a specific resource. This method is a negated version of the `can` method and helps in checking what actions are not allowed.

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

// Check if the user does not have permission to 'read' on 'posts' resource
const cannotRead = guantr.cannot('read', 'posts');
console.log(cannotRead); // Output: false

// Check if the user does not have permission to 'write' on 'posts' resource with a specific condition
const cannotWrite = guantr.cannot('write', ['posts', { title: 'Special Title' }]);
console.log(cannotWrite); // Output: false

// Check if the user does not have permission to 'delete' on 'posts' resource
const cannotDelete = guantr.cannot('delete', 'posts');
console.log(cannotDelete); // Output: true
```

In this example:

1. `guantr.setPermissions`: Sets a list of permissions on the guantr instance.
2. `guantr.cannot('read', 'posts')`: Checks if the user does not have permission to perform the 'read' action on the 'posts' resource.
3. `guantr.cannot('write', ['posts', { title: 'Special Title' }])`: Checks if the user does not have permission to perform the 'write' action on the 'posts' resource with a specific condition.
4. `guantr.cannot('delete', 'posts')`: Checks if the user does not have permission to perform the 'delete' action on the 'posts' resource.

## References

### Signature

```ts
cannot<
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

- **boolean**: Returns `true` if the user does not have permission to perform the specified action on the given resource, otherwise `false`.
