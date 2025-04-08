# API: `Guantr.prototype.cannot`

The `cannot` method checks if a specific action is explicitly or implicitly denied on a given resource. It is the logical negation of the `can` method.

## Signature

```ts
interface Guantr<Meta, Context> {
  cannot(
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
    * `true` if the action is denied (either no matching `allow` rule exists, or a matching `deny` rule overrides any `allow` rule).
    * `false` if the action is allowed (at least one matching `allow` rule exists and no matching `deny` rule exists).

Essentially, `guantr.cannot(...)` is equivalent to `!await guantr.can(...)`.

## How it Works

It follows the same internal logic as the `can` method but returns the opposite boolean result.

1.  Retrieves relevant rules.
2.  Evaluates conditions if a `resourceInstance` is provided.
3.  Determines the outcome based on matching `allow` and `deny` rules.
4.  Returns `true` if the effective permission is "deny", `false` otherwise.

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

// Check if cannot read specific instances
const cannotReadActive = await guantr.cannot('read', ['article', activeArticle]);
// -> false (reading active article is allowed)

const cannotReadArchived = await guantr.cannot('read', ['article', archivedArticle]);
// -> true (reading archived article is denied by a specific rule)

// Check if cannot edit
const cannotEditOwn = await guantr.cannot('edit', ['article', activeArticle]);
// -> false (editing own article is allowed)

const cannotEditElse = await guantr.cannot('edit', ['article', someoneElsesArticle]);
// -> true (editing someone else's article is implicitly denied as no rule allows it)

// Check action not defined in rules
const cannotPublish = await guantr.cannot('publish', 'article');
// -> true (implicitly denied as no 'allow publish article' rule exists)
```
