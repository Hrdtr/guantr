# Quick Start

This guide will walk you through the initial steps to get up and running with Guantr in your project. Guantr provides a flexible, type-safe way to handle permissions and access control, making it a great choice for modern JavaScript and TypeScript applications.

## Installation

First, you'll need to install the Guantr package. Depending on your package manager of choice, you can use one of the following commands:

```sh
# ✨ Auto-detect
npx nypm install guantr

# npm
npm install guantr

# yarn
yarn add guantr

# pnpm
pnpm install guantr

# bun
bun install guantr
```

This command adds Guantr to your project's dependencies.

## Importing Guantr

Once installed, import the necessary functions from Guantr:

**ESM** (Node.js, Bun)

```js
import { createGuantr } from "guantr";
// For defining typed rules (optional but recommended with TypeScript)
// import type { GuantrRule, GuantrMeta } from "guantr";
```

**CommonJS** (Legacy Node.js)

```js
const { createGuantr } = require("guantr");
```

**CDN** (Deno, Bun and Browsers)

```js
import { createGuantr } from "https://esm.sh/guantr";
```

## Initializing Guantr

Create an instance using the `createGuantr` function. `createGuantr` is asynchronous as it might interact with storage or asynchronous context.

**Basic Initialization**

```ts
const guantr = await createGuantr();
```

**With TypeScript (Using GuantrMeta for Type Safety)**

Define your resources, actions, and context shape using `GuantrMeta` for enhanced type checking when defining and checking rules.

```ts
import type { GuantrMeta, GuantrRule } from 'guantr';

// Define your application's specific actions, resources, models, and context
type MyMeta = GuantrMeta<
  { // ResourceMap
    post: { action: 'read' | 'edit', model: { id: number, archived: boolean, ownerId: string } },
    comment: { action: 'read' | 'create', model: { id: number, postId: number } }
  },
  { // Context
    userId: string | null
  }
>;

const typedGuantr = await createGuantr<MyMeta>();
```

**With Context**

Provide a `getContext` function during initialization if your rules need dynamic data (like the current user ID).

```ts
const contextualGuantr = await createGuantr({
  // This function will be called whenever context is needed for rule evaluation
  getContext: async () => {
    // In a real app, fetch user data, session info, etc.
    const currentUser = await getCurrentUser();
    return {
      userId: currentUser?.id || null
    };
  }
});
```

## Setting Rules

Define permissions using the `setRules` method. You can provide rules via a callback function or an array of rule objects.

### Using the Callback Function

Pass an asynchronous function that receives `allow` and `deny` helpers.

```ts
await guantr.setRules(async (allow, deny) => {
  // Allow reading any post
  allow('read', 'post');

  // Deny reading posts that are archived
  // Conditions use the format: { field: [operator, value] }
  deny('read', ['post', { archived: ['eq', true] }]);

  // Example using context (if contextualGuantr was initialized with getContext)
  // Allow editing a post only if the user is the owner
  // allow('edit', ['post', { ownerId: ['eq', '$ctx.userId'] }]);
});
```

### Using a Direct Array of Rule Objects

You can also pass an array of rule objects. Remember that the `effect` property should be `'allow'` or `'deny'`, and conditions follow the `[operator, value]` format.

```ts
import type { GuantrRule } from 'guantr'; // Or GuantrAnyRule if not using Meta

// Define types if using TypeScript without Meta for clarity in this example
type Action = 'read' | 'edit';
type ResourceKey = 'post';
type Post = { archived: boolean };
type Context = {}; // Empty if not needed for these rules

const rules: GuantrRule<{ ResourceMap: { post: { action: Action, model: Post }}, Context: Context}>[] = [
  {
    effect: 'allow',
    action: 'read',
    resource: 'post',
    condition: null // No condition for general read access
  },
  {
    effect: 'deny',  // Use 'deny', not 'cannot'
    action: 'read',
    resource: 'post',
    // Condition format: { field: [operator, value] }
    condition: { archived: ['eq', true] }
  }
];

await guantr.setRules(rules);
```

## Checking Permissions

Use the `can` (or `cannot`) method to check if an action is permitted. Pass the specific resource object when checking rules that involve conditions.

```ts
// Check general permission to read posts
const canReadAnyPost = await guantr.can('read', 'post');
console.log('Can read any post?', canReadAnyPost); // Likely true based on rules above

// Check permission to read a specific archived post
const archivedPost = { id: 1, archived: true, ownerId: 'user-abc' };
const canReadArchived = await guantr.can('read', ['post', archivedPost]);
console.log('Can read the archived post?', canReadArchived); // Expected: false (due to the 'deny' rule)

// Check permission to read a specific non-archived post
const activePost = { id: 2, archived: false, ownerId: 'user-xyz' };
const canReadActive = await guantr.can('read', ['post', activePost]);
console.log('Can read the active post?', canReadActive); // Expected: true (allowed by general 'read', not blocked by 'deny')
```

## Next Steps

You've now installed, initialized, set rules for, and checked permissions with Guantr! Explore further topics:

* **Guides:** Dive deeper into [Defining Rules](./guides/defining-rules.md), [Basic RBAC](./guides/example-basic-rbac.md), and [Basic ABAC](./guides/example-abac.md).
* **Advanced Usage:** Learn about [Caching](./advanced-usage/caching.md) and creating a custom [Storage Adapter](./advanced-usage/custom-storage-adapter.md).
* **API Reference:** Consult the detailed [API documentation](./api/createGuantr.md).
* **GitHub:** Explore the [source code](https://github.com/Hrdtr/guantr) and contribute.
* **Discussions:** Ask questions and share ideas in the [community forums](https://github.com/Hrdtr/guantr/discussions).

Happy coding!
