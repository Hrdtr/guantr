# API: `Guantr.prototype.can`

The `can` method checks if a specific action is permitted on a given resource, according to the rules defined in the Guantr instance. It considers both `allow` and `deny` rules, including any applicable conditions based on the resource instance and context.

## Signature

```ts
interface Guantr<Meta, Context> {
  can(
    action: string, // Or specific action type from Meta
    resource: string | [resourceKey: string, resourceInstance: object] // Or typed resource key/instance from Meta
  ): Promise<boolean>;
}
```

## Parameters

* `action`: (`string`) The action being attempted (e.g., `'read'`, `'update'`).
* `resource`: (`string` | `[string, object]`) The resource being acted upon.
    * If a `string` (e.g., `'post'`) is provided, it checks rules defined for the general resource type *without* evaluating instance-specific conditions.
    * If a tuple `[resourceKey: string, resourceInstance: object]` (e.g., `['post', { id: 1, status: 'draft' }]`) is provided, it checks rules for the `resourceKey` and evaluates any conditions against the properties of the `resourceInstance` and the current context.

## Returns

* `Promise<boolean>`: A promise that resolves to:
    * `true` if the action is allowed (at least one matching `allow` rule exists and no matching `deny` rule exists).
    * `false` if the action is denied (either no matching `allow` rule exists, or a matching `deny` rule overrides any `allow` rule).

## How it Works

1.  Retrieves all rules relevant to the given `action` and `resource` key using `queryRules` from the storage adapter.
2.  If a `resourceInstance` is provided, it evaluates the `condition` of each relevant rule against the instance's properties and the current context (obtained via `getContext`).
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

// Check general read permission (doesn't evaluate conditions)
const canReadType = await guantr.can('read', 'article');
// -> true (because the general 'allow read article' rule exists)

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
