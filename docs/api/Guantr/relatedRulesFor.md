# API: `Guantr.prototype.relatedRulesFor`

The `relatedRulesFor` method retrieves all stored permission rules that match a specific action and resource key. It essentially calls the `queryRules` method of the configured storage adapter.

## Signature

```ts
interface Guantr<Meta, Context> {
  relatedRulesFor(
    action: string,
    resource: string
  ): Promise<GuantrAnyRule[]>;
}
```

## Parameters

* `action`: (`string`) The specific action to filter rules by (e.g., `'read'`).
* `resource`: (`string`) The specific resource key to filter rules by (e.g., `'article'`).
* `options`: (`object`) Optional configuration options for the query.
* `options.applyConditionContextualOperands`: (`boolean`) A flag indicating whether to apply contextual operands to each rules condition.

## Returns

* `Promise<GuantrAnyRule[]>`: A promise that resolves to an array containing only the `GuantrAnyRule` objects from storage that exactly match the provided `action` and `resource` key. This array includes both `allow` and `deny` rules matching the criteria. It will be empty if no matching rules are found.

## Usage

This method can be useful for understanding which specific rules might apply to a potential action on a type of resource, before evaluating conditions against a specific instance. It relies on the efficiency of the underlying storage adapter's `queryRules` implementation.

## Example

```ts
// Assume guantr instance is initialized and rules are set:
await guantr.setRules(async (allow, deny) => {
  allow('read', 'article');
  deny('read', ['article', { status: ['eq', 'archived'] }]);
  allow('edit', ['article', { ownerId: ['eq', '$ctx.userId'] }]);
  allow('read', 'comment');
});

// Retrieve rules specifically for reading articles
const readArticleRules = await guantr.relatedRulesFor('read', 'article');

console.log(readArticleRules);
/* Expected Output:
[
  { effect: 'allow', action: 'read', resource: 'article', condition: null },
  {
    effect: 'deny',
    action: 'read',
    resource: 'article',
    condition: { status: ['eq', 'archived'] }
  }
]
*/

// Retrieve rules for editing articles
const editArticleRules = await guantr.relatedRulesFor('edit', 'article');

console.log(editArticleRules);
/* Expected Output:
[
  {
    effect: 'allow',
    action: 'edit',
    resource: 'article',
    condition: { ownerId: ['eq', '$ctx.userId'] }
  }
]
*/

// Retrieve rules for an action/resource combo with no rules
const deleteCommentRules = await guantr.relatedRulesFor('delete', 'comment');
console.log(deleteCommentRules); // Expected Output: []
```
