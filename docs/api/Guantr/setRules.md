# API: `Guantr.prototype.setRules`

The `setRules` method is used to define or replace the entire set of permission rules managed by the Guantr instance. It interacts with the configured storage adapter to persist these rules.

## Signatures

There are two ways to call `setRules`:

**1. With a Rules Array:**

```ts
interface Guantr<Meta, Context> {
  setRules(
    rules: GuantrRule<Meta, Context>[] // Array of rule objects
  ): Promise<void>;
}
```

**2. With a Callback Function:**

```ts
type SetRulesCallback<Meta, Context> = (
  allow: (action: string, resource: string | [resourceKey: string, condition: GuantrRuleCondition<...> | null]) => void,
  deny: (action: string, resource: string | [resourceKey: string, condition: GuantrRuleCondition<...> | null]) => void
) => void | Promise<void>;

interface Guantr<Meta, Context> {
  setRules(
    callback: SetRulesCallback<Meta, Context> // Async function defining rules
  ): Promise<void>;
}
```

## Parameters

* `rules`: (Array Method) An array of `GuantrRule` (or `GuantrAnyRule`) objects. Each object must have `effect` (`'allow'` or `'deny'`), `action` (string), `resource` (string), and optional `condition` (object or null).
* `callback`: (Callback Method) An asynchronous function that receives two arguments:
    * `allow`: A function used to define permission grants. Call it as `allow(action, resource)` or `allow(action, [resourceKey, condition])`.
    * `deny`: A function used to define permission restrictions. Call it as `deny(action, resource)` or `deny(action, [resourceKey, condition])`.
    The callback signature for `allow`/`deny` is:
    `(action: string, resource: string | [resourceKey: string, condition: GuantrRuleCondition | null]) => void`

## Returns

* `Promise<void>`: A promise that resolves when the rules have been successfully processed and stored by the storage adapter.

## Important Behavior

* **Replacement:** Calling `setRules` **replaces all previously stored rules**. It does not append rules.
* **Storage Interaction:** This method calls the `setRules` method of the configured storage adapter.

## Examples

**Using the Callback Function (Recommended for Clarity)**

```ts
await guantr.setRules(async (allow, deny) => {
  // Allow reading any article
  allow('read', 'article');

  // Allow editing own articles
  allow('edit', ['article', { ownerId: ['eq', '$ctx.userId'] }]);

  // Deny deleting published articles
  deny('delete', ['article', { status: ['eq', 'published'] }]);
});
```

**Using a Direct Array of Rule Objects**

```ts
import type { GuantrRule } from 'guantr';

const rulesArray: GuantrRule</* MyMeta */>[] = [
  { effect: 'allow', action: 'read', resource: 'article', condition: null },
  {
    effect: 'allow',
    action: 'edit',
    resource: 'article',
    condition: { ownerId: ['eq', '$ctx.userId'] }
  },
  {
    effect: 'deny',
    action: 'delete',
    resource: 'article',
    condition: { status: ['eq', 'published'] }
  }
];

await guantr.setRules(rulesArray);
```
