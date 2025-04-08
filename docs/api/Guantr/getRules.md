# API: `Guantr.prototype.getRules`

The `getRules` method retrieves all permission rules currently registered in the Guantr instance via its storage adapter.

## Signature

```ts
interface Guantr<Meta, Context> {
  getRules(): Promise<GuantrAnyRule[]>;
}
```

## Parameters

This method takes no parameters.

## Returns

* `Promise<GuantrAnyRule[]>`: A promise that resolves to an array containing all `GuantrAnyRule` objects currently stored by the configured storage adapter. The array will be empty if no rules are stored.

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
