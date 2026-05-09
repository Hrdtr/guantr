# Guantr

<!-- automd:badges color=yellow -->

[![npm version](https://img.shields.io/npm/v/guantr?color=yellow)](https://npmjs.com/package/guantr)
[![npm downloads](https://img.shields.io/npm/dm/guantr?color=yellow)](https://npm.chart.dev/guantr)

<!-- /automd -->

A flexible, type-safe JavaScript library for authorization and permission checking. Define rules with a composable builder DSL, check permissions against resource instances, and leverage context-aware conditions — all with full TypeScript support.

## Install

<!-- automd:pm-install -->

```sh
# ✨ Auto-detect
npx nypm install guantr

# npm
npm install guantr

# yarn
yarn add guantr

# pnpm
pnpm add guantr

# bun
bun install guantr

# deno
deno install npm:guantr
```

<!-- /automd -->

<!-- automd:jsimport cjs cdn name="guantr" imports="createGuantr" -->

**ESM** (Node.js, Bun, Deno)

```js
import { createGuantr } from 'guantr';
```

**CommonJS** (Legacy Node.js)

```js
const { createGuantr } = require('guantr');
```

**CDN** (Deno and Browsers)

```js
import { createGuantr } from 'https://esm.sh/guantr';
```

<!-- /automd -->

## Quick Start

```ts
import { createGuantr } from 'guantr';
import type { GuantrMeta } from 'guantr';

// 1. Define your resource map and context
type MyMeta = GuantrMeta<
  {
    post: {
      action: 'read' | 'create' | 'update' | 'delete';
      model: { id: number; title: string; published: boolean; authorId: number };
    };
  },
  { userId: number }
>;

// 2. Create an instance
const guantr = await createGuantr<MyMeta>({
  context: () => ({ userId: 1 }),
});

// 3. Set rules with the builder DSL
await guantr.setRules((allow, deny) => {
  allow('read', 'post');
  deny('read', ['post', ({ eq, resource, literal }) => eq(resource('published'), literal(false))]);
  allow('update', [
    'post',
    ({ eq, resource, context }) => eq(resource('authorId'), context('userId')),
  ]);
});

// 4. Check permissions
const post = { id: 1, title: 'Hello', published: false, authorId: 1 };

await guantr.can.abstract('read', 'post'); // true — any allow rule exists?
await guantr.can('read', ['post', post]); // false — denied by condition
await guantr.can('update', ['post', post]); // true — author is owner

// Batch checks — context resolved once
await guantr.can.all([
  ['read', ['post', post]],
  ['update', ['post', post]],
]);
```

## Condition Builder DSL

Guantr v2 uses a **type-safe builder DSL** for conditions:

```ts
import type { MatchConditionFn } from 'guantr';

const condition: MatchConditionFn<Post, Context> = ({ and, eq, resource, literal }) =>
  and(eq(resource('status'), literal('published')), eq(resource('deleted'), literal(false)));

// Use in rule objects or callbacks:
await guantr.setRules([
  {
    effect: 'allow',
    action: 'read',
    resource: 'post',
    matchCondition: condition,
  },
]);
```

All conditions are serialized to a JSON-compatible AST at definition time, making them storable in any database.

## API Overview

### Permission Checks

| Method                                    | Description                                        |
| ----------------------------------------- | -------------------------------------------------- |
| `can(action, [resourceKey, instance])`    | Full evaluation against a specific instance        |
| `cannot(action, [resourceKey, instance])` | Negated `can`                                      |
| `can.abstract(action, resourceKey)`       | Any allow rule exists? (ignores conditions/denies) |
| `cannot.abstract(action, resourceKey)`    | Negated `can.abstract`                             |
| `can.all(checks)`                         | All checks must pass                               |
| `can.any(checks)`                         | Any check must pass                                |
| `cannot.all(checks)`                      | All checks must be denied                          |
| `cannot.any(checks)`                      | Any check must be denied                           |

### Rule Management

| Method                              | Description                      |
| ----------------------------------- | -------------------------------- |
| `setRules((allow, deny) => {})`     | Replace rules via callback       |
| `setRules([...])`                   | Replace rules via array          |
| `getRules()`                        | Retrieve all stored rules        |
| `relatedRulesFor(action, resource)` | Query rules by action + resource |

### Storage & Context

```ts
await createGuantr<Meta>({
  context: () => ({ userId: 1 }), // default: {}
  storage: new MyCustomStorage(), // default: InMemoryStorage
  maxRuleIterations: 500, // default: 1000
});
```

## Development

<details>

<summary>local development</summary>

- Clone this repository
- Install latest LTS version of [Node.js](https://nodejs.org/en/)
- Enable [Corepack](https://github.com/nodejs/corepack) using `corepack enable`
- Install dependencies using `pnpm install`
- Run playground using `pnpm play`

</details>

## License

<!-- automd:contributors license=MIT -->

Published under the [MIT](https://github.com/Hrdtr/guantr/blob/main/LICENSE) license.
Made by [community](https://github.com/Hrdtr/guantr/graphs/contributors) 💛
<br><br>
<a href="https://github.com/Hrdtr/guantr/graphs/contributors">
<img src="https://contrib.rocks/image?repo=Hrdtr/guantr" />
</a>

<!-- /automd -->

<!-- automd:with-automd -->

---

_🤖 auto updated with [automd](https://automd.unjs.io)_

<!-- /automd -->
