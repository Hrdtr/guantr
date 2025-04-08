# Guantr: A Flexible, Type-Safe Authorization Library for JavaScript

Managing user permissions and access control is a fundamental challenge in modern web development. **Guantr** is a versatile, type-safe JavaScript library designed to streamline this complexity. Inspired by the robust features of [CASL](https://github.com/stalniy/casl) by [Sergii Stotskyi](https://github.com/stalniy), Guantr offers an efficient, developer-friendly approach to handling authorization in your applications.

## What is Guantr?

Guantr provides a reliable and flexible framework for defining and checking permission rules. It helps ensure users access only what they're permitted to, simplifying the implementation of secure access control.

## Key Features

1.  **Type Safety:** Leverages TypeScript for strongly-typed permission definitions, reducing runtime errors and improving code maintainability.
2.  **Contextual Authorization:** Define rules based on dynamic conditions, adapting permissions to the current application state or user context.
3.  **Flexible Permission Definitions:** Set rules clearly using callback functions or direct object assignments, accommodating both simple and complex logic.
4.  **Comprehensive Permission Checking:** Offers straightforward methods (`can`/`cannot`) to verify user permissions for specific actions and resources.

## How Guantr Works

Guantr uses a simple API to manage permissions. Here’s a glimpse:

### Defining Rules

Use the `setRules` method to specify allowed (`can`) or denied (`cannot`) actions on resources, optionally adding conditions.

```ts
const guantr = await createGuantr();

await guantr.setRules((can, cannot) => {
  can('read', 'post'); // Allow reading any post
  cannot('read', ['post', { archived: true }]); // Deny reading archived posts
});
```

### Checking Permissions

Verify permissions easily using the `can` or `cannot` methods.

```ts
await guantr.can('read', 'post'); // Check if reading posts is generally allowed
const post = { id: 1, title: 'Hello, World!', archived: true };
await guantr.cannot('read', ['post', post]); // Check if reading *this specific* archived post is denied
```

### Contextual Conditions

Permissions can depend on dynamic context, like the current user's ID.

```ts
// Initialize with context
const contextGuantr = await createGuantr({ getContext: () => ({ userId: '123' }) });

// Set rules using context
await contextGuantr.setRules((can, cannot) => {
  // Allow deleting posts only if the ownerId matches the context's userId
  cannot('delete', ['post', { ownerId: ['eq', '$ctx.userId'] }]);
});

// Check permission for a specific post
const post = { id: 1, title: 'My Post', ownerId: '123' };
const canDelete = await contextGuantr.can('delete', ['post', post]); // true, because ownerId matches ctx.userId
```

## Why Choose Guantr?

Guantr strikes a balance between simplicity and power. Its design integrates seamlessly into JavaScript or TypeScript projects of any scale. By using Guantr, you can implement clear, maintainable, and adaptable authorization logic.

## Join the Community

Guantr is open-source! We welcome contributions, feedback, bug reports, and feature suggestions. Your participation helps make Guantr better.

Explore the library, contribute on [GitHub](https://github.com/Hrdtr/guantr), and join the [Discussions](https://github.com/Hrdtr/guantr/discussions) to help us build a more intuitive and powerful authorization solution!
