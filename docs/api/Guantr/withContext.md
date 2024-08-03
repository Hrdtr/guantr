# `withContext`

The withContext method updates the context of the Guantr instance and removes the withContext method from the new instance. This allows setting a specific context for the instance which can be used in permission conditions.

## Usage

### Import and Define Context

First, import the necessary types and define the context:

```ts
import { createGuantr, GuantrMeta, GuantrCondition } from 'guantr';

type Context = {
  user: {
    id: number;
    role: string;
  };
};

type ResourceMap = {
  post: {
    action: 'create' | 'read' | 'update' | 'delete';
    model: {
      id: number;
      title: string;
      published: boolean;
      authorId: number;
    };
  };
};
```

### Create Guantr Instance with Context

```ts
const guantr = createGuantr<GuantrMeta<ResourceMap>>().withContext<Context>({
  user: {
    id: 1,
    role: 'admin'
  }
});
```

### Define Contextual Permissions

Define permissions that use the context to conditionally allow or deny actions:

```ts
// Define contextual permissions
guantr.setPermission((can, cannot) => {
  can('read', 'post');
  cannot('update', ['post', { authorId: ['equals', 'context.user.id'] }]);
});
```

### Check Permissions with Context

Check permissions while considering the context:

```ts
// Check permissions with context
const canUpdateOwnPost = guantr.can('update', ['post', { id: 1, authorId: 1, title: 'My Post' }]); // false
const canUpdateOtherPost = guantr.can('update', ['post', { id: 2, authorId: 2, title: 'Other Post' }]); // true
```

In this example, the context is used to restrict users from updating posts that they do not own. The `ContextField` utility is leveraged to reference fields within the context object, ensuring that permissions are dynamically evaluated based on the current context.

## References

### Signature

```js
withContext<T extends Context>(context: T): Omit<Guantr<Meta, T>, 'withContext'>;
```

### Parameters

- **context** (`Record<string, any>`): The new context to set.

### Returns

- `Omit<Guantr<Meta, T>, 'withContext'>`: A new instance of Guantr with the updated context, excluding the withContext method.

