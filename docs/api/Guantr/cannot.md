# API: `Guantr.prototype.cannot`

The `cannot` method is the logical negation of [`can()`](./can). It evaluates rules against a resource instance and returns `true` if the action is denied.

## Signature

```ts
cannot(
  action: string,
  resource: [resourceKey: string, resourceInstance: object],
): Promise<boolean>;
```

## Parameters

- **`action`**: (`string`) The action being checked (e.g. `'read'`, `'delete'`).
- **`resource`**: A tuple `[resourceKey, resourceInstance]`:
  - `resourceKey`: (`string`) The resource type key.
  - `resourceInstance`: (`object`) The resource instance to evaluate conditions against.

## Returns

- `Promise<boolean>` — `true` if the action is denied, `false` if allowed.

## Implementation

```ts
cannot(action, resource) === !(await can(action, resource));
```

This means:

- If `can()` returns `true` → `cannot()` returns `false`.
- If `can()` returns `false` → `cannot()` returns `true`.
- If no rules exist → `can()` returns `false` → `cannot()` returns `true`.
- If an unconditional deny exists → `can()` returns `false` → `cannot()` returns `true`.

## Caching

`cannot` delegates to `can` internally, so the same caching behavior applies: results are cached under the same key pattern (`can/${action}:${resourceKey}:...`), and a `can(result=true)` in the cache means `cannot` returns `false` (and vice versa).

## Examples

### Basic usage

Given these rules:

```ts
await guantr.setRules((allow, deny) => {
  allow('read', 'article');
  deny('read', [
    'article',
    ({ eq, resource, literal }) => eq(resource('status'), literal('archived')),
  ]);
});
```

```ts
const activeArticle = { id: 1, status: 'published' };
const archivedArticle = { id: 2, status: 'archived' };

await guantr.cannot('read', ['article', archivedArticle]); // true (deny matches)
await guantr.cannot('read', ['article', activeArticle]); // false (allow matches)
```

### When no rules exist

```ts
await guantr.cannot('read', ['post', { id: 1 }]); // true (implicitly denied)
```

### When an unconditional deny exists

```ts
await guantr.setRules((allow, deny) => {
  deny('delete', 'post'); // unconditional deny
});

await guantr.cannot('delete', ['post', { id: 1 }]); // true
```

### Guard clause pattern

```ts
async function deletePost(post: Post) {
  if (await guantr.cannot('delete', ['post', post])) {
    throw new ForbiddenError('You cannot delete this post');
  }
  // ... proceed with deletion
}
```

## See also

- [`can()`](./can) — The positive check.
- [`cannot.abstract`](./cannot.abstract) — Abstract version (ignores conditions and deny rules).
- [`cannot.all`](./cannot.all) — Batch check: all must be denied.
- [`cannot.any`](./cannot.any) — Batch check: any must be denied.
