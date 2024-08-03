# `setPermission`

The `setPermission` method sets permissions for actions and resources within the `Guantr` instance using callback functions to define allowed and denied permissions.

## Usage

You can use the `setPermission` method to configure permissions by providing a callback function. This function will specify which actions and resources are permitted or denied based on the provided rules.

### Example

```ts
import { createGuantr } from 'guantr';

// Create a new Guantr instance
const guantr = createGuantr();

// Define permissions
guantr.setPermission((can, cannot) => {
  // Define allowed permissions
  can('read', 'posts');
  can('write', ['posts', { title: { equals: 'Special Title' } }]);

  // Define denied permissions
  cannot('delete', 'posts');
});

// Check permissions
const canReadPosts = guantr.can('read', 'posts'); // true
const canWriteSpecialPosts = guantr.can('write', ['posts', { title: { equals: 'Special Title' } }]); // true
const canDeletePosts = guantr.cannot('delete', 'posts'); // true (because 'delete' is denied)

```

In this example:

1. can('read', 'posts'): Allows read access to the posts resource.
2. can('write', ['posts', { title: { equals: 'Special Title' } }]): Allows write access to the posts resource but only if the title is equal to 'Special Title'.
3. cannot('delete', 'posts'): Denies delete access to the posts resource.

This setup ensures that permissions are clearly defined, and access controls are enforced based on the specified rules.

## References

### Signature

```ts
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
): void
```

### Parameters

- **callback** (`Function`): A callback function that takes two parameters:
  - **can** (`Function`): Defines permissions when access is allowed. Takes `action` and `resource` parameters.
  - **cannot** (`Function`): Defines permissions when access is denied. Takes `action` and `resource` parameters.