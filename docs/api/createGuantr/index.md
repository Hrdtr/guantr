# `createGuantr`

The `createGuantr` function is a factory function for creating a new instance of the `Guantr` class. This function simplifies the process of initializing a Guantr instance, which is used for managing permissions and authorizations in your application.

## Usage

### Import

You can import the `createGuantr` function from the `guantr` package:

```js
import { createGuantr } from 'guantr';
```

### Create an Instance

To create a new instance of the Guantr class, simply call the `createGuantr` function:

```js
const guantr = createGuantr();
```

If you are using TypeScript, you can optionally provide metadata to the `createGuantr` function to enhance type safety:

```ts
import { createGuantr, GuantrMeta } from 'guantr';

type ResourceMap = {
  post: {
    action: 'create' | 'read' | 'update' | 'delete';
    model: {
      id: number;
      title: string;
      published: boolean;
    };
  };
};

const guantrWithMeta = createGuantr<GuantrMeta<ResourceMap>>();
```

## References

### Signature

```js
createGuantr<Meta extends GuantrMeta<GuantrResourceMap> | undefined = undefined>(): Guantr<Meta>;
```

### Parameters

- **Meta** (`GuantrMeta<ResourceMap>`): The type of metadata associated with the Guantr instance. This is useful for enhancing type safety when defining resources and actions. Defaults to `undefined`.

### Returns

- `Guantr<Meta>`: A new instance of the `Guantr` class.
