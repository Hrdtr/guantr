# API: `Guantr.prototype.getRules`

The `getRules` method retrieves all permission rules currently registered in the Guantr instance via its storage adapter.

## Signature

```ts
interface Guantr<Meta> {
  getRules(): Promise<ReadonlyArray<GuantrRule>>;
}
```

## Parameters

This method takes no parameters.

## Returns

`Promise<ReadonlyArray<GuantrRule>>`: A promise that resolves to an array containing all `GuantrRule` objects currently stored by the configured storage adapter. (The returned value is typed as `ReadonlyArray` in TypeScript, but immutability is **not** enforced at runtime — the underlying storage adapter returns a plain mutable `GuantrRule[]` and the array is not frozen. If you require true runtime immutability, clone or `Object.freeze` the array yourself.)

## Usage

This method is useful for inspecting the current state of permissions, debugging, or potentially exporting rules.

## Example

```ts
// Assume guantr instance is initialized and rules have been set
await guantr.setRules(async (allow, deny) => {
  allow('read', 'publicData');
  allow('write', ['userProfile', { userId: ['eq', '$ctx.userId'] }]);
  deny('delete', 'systemConfig');
});

// Retrieve all rules
const allRules = await guantr.getRules();

console.log(allRules);
/* Expected Output (example):
[
  { effect: 'allow', action: 'read', resource: 'publicData', condition: null },
  {
    effect: 'allow',
    action: 'write',
    resource: 'userProfile',
    condition: { userId: ['eq', '$ctx.userId'] }
  },
  { effect: 'deny', action: 'delete', resource: 'systemConfig', condition: null }
]
*/
```
