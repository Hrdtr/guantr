# Quick Start

Welcome to Guantr's quick start guide! This guide will walk you through the initial steps to get up and running with Guantr in your project. Guantr provides a flexible, type-safe way to handle permissions and access control, making it a great choice for modern JavaScript and TypeScript applications.

## Installation

First, you'll need to install the Guantr package. Depending on your package manager of choice, you can use one of the following commands:

<!-- automd:pm-install -->

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

<!-- /automd -->

This command will add Guantr to your project's dependencies, allowing you to start leveraging its powerful features.

## Importing Guantr

Once installed, you can import Guantr into your project. Depending on your environment, choose the appropriate import method:

<!-- automd:jsimport cjs cdn name="guantr" imports="createGuantr" -->

**ESM** (Node.js, Bun)

```js
import { createGuantr } from "guantr";
```

**CommonJS** (Legacy Node.js)

```js
const { createGuantr } = require("guantr");
```

**CDN** (Deno, Bun and Browsers)

```js
import { createGuantr } from "https://esm.sh/guantr";
```

<!-- /automd -->

With Guantr now available in your project, you can proceed to initialize and configure it to manage permissions.

## Initializing Guantr

To start using Guantr, create an instance using the `createGuantr` function. This function returns a new instance of Guantr, ready for configuration:

```ts
const guantr = createGuantr()
```

### Using TypeScript Meta

If you're using TypeScript, you can provide additional metadata to strongly type your permissions. This ensures that your resource and action definitions are consistent and type-safe.

```ts
type Meta = GuantrMeta<{
  post: {
    action: 'create' | 'read' | 'update' | 'delete'
    model: {
      id: number,
      title: string,
      published: boolean
    }
  }
}>;

const guantr = createGuantr<Meta>();
```

In this example, we define a `ResourceMap` for posts, specifying the structure of each post inside `model` and a set of actions inside `action` (`'create'`, `'read'`, `'update'`, `'delete'`) that can be performed on these resources.

### With Context

Guantr allows you to set a context for the permissions, which can be useful for dynamic conditions based on the current user or other stateful information.

```ts
const guantrWithContext = createGuantr().withContext({
  id: number,
  name: 'John Doe',
  roles: ['admin']
})

```

Here, `withContext` sets up a user context which can be used to apply more granular permission checks based on the user's role or other attributes.


## Setting permissions

With Guantr initialized, you can now define permissions. Permissions are rules that specify what actions are allowed or denied on certain resources. You can set permissions in two ways:

### Using a Callback Function

Define permissions dynamically using a callback function. This is useful for complex or condition-based permissions:

```ts
guantr.setPermission((can, cannot) => {
  can('read', 'post');
  cannot('read', ['post', { published: ['equals', false] }]);
});
```

In this example, the user is allowed to read all posts but only if they are published.

### Using Direct Assignment

Alternatively, you can set permissions directly by passing an array of permission objects:

```js
guantr.setPermissions([
  {
    resource: 'post',
    action: 'read',
    condition: null,
    inverted: false
  },
  {
    resource: 'post',
    action: 'read',
    condition: {
      published: ['equals', false]
    },
    inverted: true
  }
])
```

This approach explicitly defines the permissions, where the first rule allows reading posts, and the second rule denies reading published posts.

## Checking Permission

To check if a user has permission to perform a specific action on a resource, use the `can` method. This method evaluates the defined permissions and returns a boolean value:

```js
guantr.can('read', 'post') // true
guantr.can('read', ['post', { id: 1, title: 'Hello World', published: false }]) // false

```

In the above code, the first check returns `true` because there is no restriction on reading posts in general. The second check returns `false` because the condition denies reading the post if it’s unpublished and does not meet the criteria.

## Conclusion

Guantr provides a robust and intuitive framework for managing permissions in your applications. With its type-safe approach and flexible API, it helps ensure that your authorization logic is clear, maintainable, and aligned with your application's requirements.

We look forward to seeing how Guantr empowers your projects and welcomes contributions from the community!
