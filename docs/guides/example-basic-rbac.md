# Example: Basic RBAC (Role-Based Access Control)

Role-Based Access Control (RBAC) is a common authorization strategy where permissions are associated with **roles** (like `admin`, `editor`, `viewer`), and users are assigned these roles. Access decisions are then based on the permissions granted to the user's assigned role(s). Guantr can easily implement this pattern.

## Defining Roles and Permissions

First, identify the roles within your application and the permissions tied to each. For this example, let's define rules for two roles: `admin` and `user`.

* **Admin:** Can read, create, update, and delete articles.
* **User:** Can only read articles.

We can create a function that configures a Guantr instance with the appropriate rules based on a given role.

```ts
import { createGuantr } from 'guantr';

// Define roles (using constants or enums is recommended)
const ROLE_ADMIN = 'admin';
const ROLE_USER = 'user';

/**
 * Creates and configures a Guantr instance with rules
 * specific to the provided user role.
 */
async function setupGuantrForRole(role: string) {
  // Create a new Guantr instance
  const guantr = await createGuantr();

  // Set the rules based on the role
  await guantr.setRules((allow, deny) => {
    // --- Common Permissions ---
    // All roles are allowed to read articles
    allow('read', 'article');

    // --- Admin Specific Permissions ---
    if (role === ROLE_ADMIN) {
      allow('create', 'article');
      allow('update', 'article');
      allow('delete', 'article');
    }

    // --- User Specific Permissions (or Denials) ---
    // Example: If users were explicitly denied creation
    // if (role === ROLE_USER) {
    //   deny('create', 'article');
    // }
    // Note: Often, simply not granting 'allow' is sufficient.
  });

  return guantr;
}

// Example Usage (Conceptual):
// In a real application, you'd likely call this setup function
// once per request based on the logged-in user's role.
// const adminGuantr = await setupGuantrForRole(ROLE_ADMIN);
// const userGuantr = await setupGuantrForRole(ROLE_USER);
```

**Important Note:** This basic RBAC example defines different rule sets based on the role *outside* of Guantr's condition logic. It does not use the `condition` parameter within the `allow`/`deny` rules themselves. For examples using conditions (Attribute-Based logic, which can also model roles), please see the [ABAC Guide](./example-abac.md).

## Checking Permissions in Your Application

In your application logic (e.g., API route handlers, service methods), you would typically:
1.  Determine the current user's role.
2.  Obtain a Guantr instance configured with the rules for that role (often done per-request).
3.  Use the `.can()` or `.cannot()` methods to check permissions before performing actions.

```ts
// Example: Express.js route handler (conceptual)

// Assume 'req.user.role' contains the role ('admin' or 'user')
// Assume 'getGuantrForRequest' retrieves or creates a Guantr instance
// configured for the current request's user role (using setupGuantrForRole or similar).

app.delete('/api/articles/:id', async (req, res) => {
  const userRole = req.user.role;
  const articleId = req.params.id;
  // Fetch the specific article if needed for conditional checks later
  // const article = await fetchArticle(articleId);

  // Get Guantr instance for this request/user
  const guantr = await getGuantrForRequest(req); // Or setupGuantrForRole(userRole)

  // Check if the user's role allows deleting 'article'
  // This checks the general action type based on the loaded rules.
  const canDelete = await guantr.can('delete', 'article');

  // If the rules involved conditions, you would check against the specific instance:
  // const canDeleteSpecific = await guantr.can('delete', ['article', article]);

  if (!canDelete) {
    // Note: For APIs, returning 403 (Forbidden) is standard.
    // Returning 404 (Not Found) can sometimes obscure less information.
    return res.status(403).send({ error: 'You do not have permission to delete articles.' });
  }

  // --- Permission Granted: Proceed with Action ---
  try {
    // await deleteArticle(articleId);
    res.status(200).send({ message: 'Article deleted successfully.' });
  } catch (error) {
    // Handle deletion errors
    res.status(500).send({ error: 'Failed to delete article.' });
  }
});
```

This approach provides a clear and straightforward way to implement basic Role-Based Access Control using Guantr by managing distinct rule sets per role.
