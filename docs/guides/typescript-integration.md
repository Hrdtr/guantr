# TypeScript Integration with `GuantrMeta`

Guantr is designed with TypeScript first, offering powerful type safety features to make your authorization logic more robust, maintainable, and easier to refactor. The key to unlocking these benefits is the `GuantrMeta` type.

## Why Use TypeScript and `GuantrMeta`?

While Guantr works perfectly well in plain JavaScript, using it with TypeScript and defining a `GuantrMeta` type provides significant advantages:

* **Type Safety:** Catch errors at compile time instead of runtime. Prevent typos in action names, resource keys, model properties within conditions, and context properties.
* **Autocompletion:** Get intelligent suggestions for actions, resource keys, model properties, and context properties directly in your editor.
* **Refactoring Confidence:** Rename actions, resources, or model properties, and TypeScript will help you find all the places they need updating within your Guantr rules.
* **Improved Readability:** Explicitly defining your authorization model makes the code easier to understand.

## Core Concept: The `GuantrMeta` Type

The `GuantrMeta` type acts as a central definition for your application's authorization model within Guantr. It informs the Guantr instance about the shape of your resources, the actions applicable to them, and the structure of your context object.

It takes two generic type arguments:

```ts
import type { GuantrMeta, GuantrResourceMap, GuantrResourceAction, GuantrResourceModel } from 'guantr';

type MyMeta = GuantrMeta<
  MyResourceMap, // 1. Defines your resources, actions, and models
  MyContext      // 2. Defines the shape of your context object
>;
```

Let's break down how to define `MyResourceMap` and `MyContext`.

## 1. Defining the `ResourceMap`

The `ResourceMap` is an object type where each key is a string representing a **resource key** (e.g., `'article'`, `'comment'`, `'userProfile'`). The value for each key describes the resource's structure using the `GuantrResource` type.

A `GuantrResource` has two properties:

* `action`: A union type of **string literals** representing all possible actions for this resource (e.g., `'read' | 'create' | 'delete'`).
* `model`: The TypeScript interface or type defining the data structure of the resource instance (e.g., `interface ArticleModel { ... }`).

```ts
import type { GuantrResourceMap, GuantrResourceAction, GuantrResourceModel } from 'guantr';

// Define models for your resources
interface ArticleModel {
  id: string;
  status: 'draft' | 'published' | 'archived';
  authorId: string;
  content: string;
  tags?: string[];
}

interface CommentModel {
  id: string;
  articleId: string;
  authorId: string;
  body: string;
}

interface UserModel {
  id: string;
  role: 'admin' | 'editor' | 'viewer';
  department: string | null;
}

// Define the ResourceMap combining keys, actions, and models
type MyResourceMap = GuantrResourceMap<{
  article: {
    action: 'read' | 'create' | 'edit' | 'delete' | 'publish';
    model: ArticleModel;
  };
  comment: {
    action: 'read' | 'create' | 'delete';
    model: CommentModel;
  };
  user: {
    action: 'read' | 'promote' | 'assignDepartment';
    model: UserModel;
  };
  // Add other resources here...
  adminPanel: {
    action: 'access';
    model: {}; // Model can be empty if no specific instance data is checked
  }
}>;
```

## 2. Defining the `Context`

The `Context` type defines the shape of the object returned by the `getContext` function you provide during `createGuantr` initialization. This object typically holds information about the current user, session, or environment relevant to permission checks.

```ts
// Define the shape of your application's context
interface MyContext {
  userId: string | null;       // ID of the logged-in user, or null if anonymous
  userRoles: Array<'admin' | 'editor' | 'viewer'>; // Roles assigned to the user
  ipAddress?: string;         // Example environmental attribute
}
```

## Putting it Together: Defining `GuantrMeta`

Now combine your `ResourceMap` and `Context` into your application's specific `GuantrMeta` type:

```ts
import type { GuantrMeta } from 'guantr';
// Assumes MyResourceMap and MyContext are defined as above

type MyAppMeta = GuantrMeta<MyResourceMap, MyContext>;
```

## Using `GuantrMeta`

Pass your defined `Meta` type when creating the Guantr instance and when typing rules arrays:

**Initialization:**

```ts
import { createGuantr } from 'guantr';
// Assumes MyAppMeta is defined as above

const guantr = await createGuantr<MyAppMeta, MyContext>({
  getContext: async (): Promise<MyContext> => {
    // Fetch current user data and return object matching MyContext
    const user = await getCurrentUser();
    return {
      userId: user?.id ?? null,
      userRoles: user?.roles ?? [],
      // ipAddress: request?.ip // Example for environmental context
    };
  }
  // Optionally provide storage adapter
});
```

**Typing Rules Arrays:**

```ts
import type { GuantrRule } from 'guantr';
// Assumes MyAppMeta is defined as above

const rules: GuantrRule<MyAppMeta, MyContext>[] = [
  // TypeScript will validate this rule structure against MyAppMeta
  {
    effect: 'allow',
    action: 'edit', // Autocompletes/validated against 'article' actions
    resource: 'article', // Autocompletes/validated against resource keys
    condition: {
      // 'authorId' autocompletes/validated against ArticleModel properties
      authorId: ['eq', '$ctx.userId'] // '$ctx.userId' validated against MyContext
    }
  }
];

await guantr.setRules(rules);
```

## Benefits in Practice

Defining `GuantrMeta` provides immediate feedback in your IDE:

**Type Safety in `setRules` Callback:**

```ts
await guantr.setRules(async (allow, deny) => {
  // 'allow' and 'deny' know about your Meta definition

  // Correct: 'read' is a valid action for 'article'
  allow('read', 'article');

  // Error: 'update' is not a defined action for 'article' (based on MyResourceMap)
  // allow('update', 'article'); // TypeScript Error!

  allow('edit', ['article', {
    // Correct: 'status' is a property of ArticleModel
    status: ['eq', 'draft'],

    // Error: 'ownerId' is not a property of ArticleModel (it's authorId)
    // ownerId: ['eq', '$ctx.userId'] // TypeScript Error!

    // Correct: 'authorId' is a property of ArticleModel, '$ctx.userId' is in MyContext
    authorId: ['eq', '$ctx.userId']
  }]);

  // Error: 'nonExistentResource' is not defined in MyResourceMap
  // allow('read', 'nonExistentResource'); // TypeScript Error!
});
```

**Type Safety in `can`/`cannot` Checks:**

```ts
const articleInstance: ArticleModel = /* ... fetched article ... */ ;
const commentInstance: CommentModel = /* ... fetched comment ... */ ;

// Correct: 'read' action on 'article' resource
await guantr.can('read', ['article', articleInstance]);

// Error: 'update' is not a valid action for 'article'
// await guantr.can('update', ['article', articleInstance]); // TypeScript Error!

// Error: Checking 'article' action against a 'comment' instance type
// await guantr.can('edit', ['article', commentInstance]); // TypeScript Error!
```

## Conclusion

Leveraging TypeScript with `GuantrMeta` transforms Guantr from a flexible library into a robust, type-safe authorization framework. By defining your application's specific resources, actions, models, and context structure, you gain compile-time checks, autocompletion, and increased confidence when building and maintaining your access control logic. It is highly recommended for any significant Guantr implementation in a TypeScript project.
