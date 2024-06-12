# Guantr: A Flexible, Type-Safe Authorization Library for JavaScript

In the rapidly evolving world of web and application development, managing user permissions and access control is a fundamental yet complex challenge. To address this, we are excited to introduce **Guantr**, a versatile and type-safe JavaScript library designed to streamline and enhance your authorization needs.

Inspired by the robust features of [CASL](https://github.com/stalniy/casl) created by [Sergii Stotskyi](https://github.com/stalniy), Guantr offers a modern, efficient approach to permission management, making it easier for developers to secure their applications.

## What is Guantr?

Guantr is a JavaScript library tailored for developers who need a reliable and flexible way to handle permissions and access control within their applications. It provides a straightforward yet powerful framework for defining and checking permissions, ensuring that users can only access what they are allowed to.

## Key Features

1. **Type Safety:** Guantr leverages TypeScript to provide a type-safe environment, reducing runtime errors and enhancing code maintainability. This makes it easier to define permissions and resources with strong type-checking guarantees.

2. **Contextual Authorization:** With Guantr, permissions can be contextual. This means you can define permissions based on dynamic conditions that depend on the current state or context of your application.

3. **Flexible Permission Definitions:** Guantr allows you to define permissions in a flexible manner. You can specify permissions using callback functions, which provide a clear and concise way to set up complex authorization rules.

4. **Comprehensive Permission Checking:** The library offers detailed methods to check if a user can or cannot perform certain actions on specified resources. This helps in implementing fine-grained access control policies.

## How Guantr Works?

Guantr provides a straightforward API to manage and check permissions. Here’s a quick overview of how you can utilize Guantr in your project:

### Defining Permissions

Permissions are defined using the `setPermission` method. You can specify what actions are allowed or denied on specific resources, optionally providing conditions for more granular control.

```ts
const guantr = createGuantr();

guantr.setPermission((can, cannot) => {
  can('read', 'post');
  cannot('read', ['post', { archived: true }]);
});
```

In this example, the user is allowed to read any post but cannot read posts with the `archived` flag set to `true`.

### Checking Permissions

Once permissions are set, checking them is as simple as calling the can or cannot methods:

```ts
guantr.can('read', 'post');
guantr.cannot('read', ['post', { archived: true }]);
```

### Contextual Conditions

Guantr supports context-based permissions, which are useful when permissions depend on dynamic conditions:

```ts
const contextGuantr = createGuantr().withContext({ userId: '123' });

contextGuantr.setPermission((can, cannot) => {
  can('read', 'Post');
  cannot('delete', ['Post', { owner: '$context.userId' }]);
});

const canDelete = contextGuantr.can('delete', ['Post', { owner: '123' }]); // true
```

Here, the permission to delete a post is evaluated based on the context (e.g., the current user's ID).

## Why Choose Guantr?

Guantr stands out due to its balance of simplicity and flexibility. Its design allows for seamless integration into any JavaScript or TypeScript project, whether it's a small application or a large-scale enterprise solution. By adopting Guantr, you ensure that your authorization logic is clear, maintainable, and adaptable to changing requirements.

## Join the Community

Guantr is open-source, and we welcome contributions and feedback from the community. Whether you're interested in reporting bugs, suggesting new features, or contributing code, your participation is invaluable to us.

Join us on our journey to make authorization and permission management more intuitive and powerful with Guantr!

---

Guantr is a testament to the power of open-source development and the inspiration from foundational libraries like CASL. We invite you to explore, contribute, and take advantage of the capabilities Guantr brings to your applications.
