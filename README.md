# Guantr

<!-- automd:badges color=yellow -->

[![npm version](https://img.shields.io/npm/v/guantr?color=yellow)](https://npmjs.com/package/guantr)
[![npm downloads](https://img.shields.io/npm/dm/guantr?color=yellow)](https://npm.chart.dev/guantr)

<!-- /automd -->

Flexible, type-safe JavaScript library for efficient authorization and permission checking. Easily manage permissions, and context-aware access control with minimal overhead and a simple API.

## Usage

Install package:

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

# deno
deno install guantr
```

<!-- /automd -->

Import:

<!-- automd:jsimport cjs cdn name="guantr" imports="createGuantr" -->

**ESM** (Node.js, Bun, Deno)

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

Initialize:

```ts
const guantr = await createGuantr()

// With Typescript Meta:
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

const guantr = await createGuantr<Meta>()

// Contextual
const user = {
  id: number,
  name: 'John Doe',
  roles: ['admin']
}
const guantrWithContext = await createGuantr<Meta, { user: typeof user }>({
  getContext: () => ({ user })
})

```

Setting rules:

```js
await guantr.setRules((can, cannot) => {
  can('read', 'post')
  cannot('read', ['post', { published: ['eq', false] }])
})
// Or
await guantr.setRules([
  {
    resource: 'post',
    action: 'read',
    condition: null,
    effect: 'allow'
  },
  {
    resource: 'post',
    action: 'read',
    condition: {
      published: ['eq', false]
    },
    effect: 'deny'
  }
])
```

Rules also can be set on instance creation:

```ts
const guantr = await createGuantr<Meta>([
  {
    resource: 'post',
    action: 'read',
    condition: {
      published: ['eq', false]
    },
    effect: 'deny'
  }
])
```

Authorize:

```js
await guantr.can('read', 'post') // true

const post = {
  id: 1,
  title: 'Hello World',
  published: false
}
await guantr.can('read', ['post', post]) // false

```

## Development

<details>

<summary>local development</summary>

- Clone this repository
- Install latest LTS version of [Node.js](https://nodejs.org/en/)
- Enable [Corepack](https://github.com/nodejs/corepack) using `corepack enable`
- Install dependencies using `pnpm install`
- Run interactive tests using `pnpm dev`

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
