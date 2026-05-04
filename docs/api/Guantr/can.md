# API: `Guantr.prototype.can`

The `can` method checks if a specific action is permitted on a given resource instance, according to the rules defined in the Guantr instance. It evaluates both `allow` and `deny` rules, including any applicable conditions based on the resource instance and context.

> For an abstract check that only tests whether any allow rule exists (without evaluating conditions or deny rules), see [`can.abstract`](./can.abstract).

## Signature

```ts
interface Guantr<Meta> {
  can(
    action: string, // Or specific action type from Meta
    resource: [resourceKey: string, resourceInstance: object], // Or typed resource key/instance from Meta
  ): Promise<boolean>;
}
```

## Parameters

- `action`: (`string`) The action being attempted (e.g., `'read'`, `'update'`).
- `resource`: (`[string, object]`) A tuple of `[resourceKey, resourceInstance]` (e.g., `['post', { id: 1, status: 'draft' }]`). Rules for the `resourceKey` are retrieved and any conditions are evaluated against the `resourceInstance` and the current context.

## Returns

- `Promise<boolean>`: A promise that resolves to:
  - `true` if the action is allowed (at least one matching `allow` rule exists and no matching `deny` rule exists).
  - `false` if the action is denied (either no matching `allow` rule exists, or a matching `deny` rule overrides any `allow` rule).

## How it Works

1.  Retrieves all rules relevant to the given `action` and resource key using `queryRules` from the storage adapter.
2.  Evaluates the `condition` of each rule against the `resourceInstance`'s properties and the current context (obtained via `getContext`).
3.  Determines the outcome: Permission is granted (`true`) if there's at least one applicable `allow` rule and no applicable `deny` rules. Otherwise, permission is denied (`false`).

## Examples

```ts
// Assume guantr instance is initialized and rules are set:
// allow('read', 'article');
// deny('read', ['article', { status: ['eq', 'archived'] }]);
// allow('edit', ['article', { ownerId: ['eq', '$ctx.userId'] }]);

const activeArticle = { id: 1, status: 'published', ownerId: 'user-123' };
const archivedArticle = { id: 2, status: 'archived', ownerId: 'user-123' };
const someoneElsesArticle = { id: 3, status: 'published', ownerId: 'user-456' };

// Assume current context userId is 'user-123'

// Check read permission on specific instances
const canReadActive = await guantr.can('read', ['article', activeArticle]);
// -> true (general 'allow' applies, 'deny' condition doesn't match)

const canReadArchived = await guantr.can('read', ['article', archivedArticle]);
// -> false (general 'allow' applies, but 'deny' condition *does* match)

// Check edit permission (requires context and instance properties)
const canEditOwn = await guantr.can('edit', ['article', activeArticle]);
// -> true (condition ownerId === $ctx.userId matches)

const canEditElse = await guantr.can('edit', ['article', someoneElsesArticle]);
// -> false (condition ownerId === $ctx.userId does not match)
```

> To check whether any permission exists for a resource type without a specific instance (e.g., for showing/hiding a UI button), use [`can.abstract`](./can.abstract).
