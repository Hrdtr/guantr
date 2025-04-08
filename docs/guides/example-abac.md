# Example: Attribute-Based Access Control (ABAC) including Relationship Patterns (ReBAC)

Attribute-Based Access Control (ABAC) is a highly flexible authorization model where access rights are granted based on policies that evaluate various **attributes**. Unlike Role-Based Access Control (RBAC), which primarily focuses on user roles, ABAC considers a richer set of characteristics.

## What is ABAC?

In ABAC, access decisions can depend on attributes of:

* **Subject/User:** Who is trying to access the resource? (e.g., user ID, roles, department, clearance level)
* **Resource:** What is being accessed? (e.g., resource type, status, owner, sensitivity, creation date)
* **Action:** What operation is being attempted? (e.g., 'read', 'edit', 'delete', 'approve')
* **Environment/Context:** What are the circumstances of the access attempt? (e.g., time of day, location, device security)

## Implementing ABAC with Guantr Conditions

Guantr implements ABAC through its powerful **conditional rules** mechanism. When defining rules using `allow` or `deny`, you can provide a `condition` object. This object specifies the attributes and their expected values that must be met for the rule to apply.

Remember, condition expressions in Guantr use the format `[operator, operand]`, where `operator` is one of the available comparison functions (like `'eq'`, `'in'`, `'gt'`, etc.) and `operand` is the value to compare against (which can be a literal or reference context using `'$ctx.propertyName'`).

[Refer to the "Defining Rules" guide for a full explanation of condition structure and available operators.]

## Examples of ABAC Rules in Guantr

Let's explore different types of attribute checks:

### 1. Resource Attributes

These rules depend on the properties of the resource being accessed.

```ts
// --- Using the setRules Callback ---
await guantr.setRules((allow, deny) => {
  // Allow editing an 'article' only if its status is 'draft'
  allow('edit', ['article', { status: ['eq', 'draft'] }]);

  // Deny editing an 'article' if its status is 'published'
  // (Illustrates using deny for explicit restriction)
  deny('edit', ['article', { status: ['eq', 'published'] }]);

  // Allow viewing 'document' only if sensitivity level is less than or equal to 3
  allow('view', ['document', { sensitivityLevel: ['lte', 3] }]);
});

// --- Equivalent Rule Array ---
const rules_resource: GuantrRule</*Meta*/>[] = [
  { effect: 'allow', action: 'edit', resource: 'article', condition: { status: ['eq', 'draft'] } },
  { effect: 'deny', action: 'edit', resource: 'article', condition: { status: ['eq', 'published'] } },
  { effect: 'allow', action: 'view', resource: 'document', condition: { sensitivityLevel: ['lte', 3] } },
];
await guantr.setRules(rules_resource);
```

### 2. Context / User Attributes

These rules depend on information passed via the `getContext` function during Guantr initialization, often representing user or session attributes.

```ts
// Assumes getContext provides { userId: string, userDepartment: string }
await guantr.setRules((allow, deny) => {
  // Allow approving a 'report' if the user is in the 'finance' department
  allow('approve', ['report', { submitterDepartment: ['eq', '$ctx.userDepartment'] }]);

  // Deny accessing 'adminPanel' if user role from context is not 'admin'
  // Note: Assumes roles are handled via context attributes in this ABAC example
  deny('access', ['adminPanel', { requiredRole: ['in', '$ctx.userRoles'] }]); // Example if context provides userRoles array
  // A simpler allow might be more common:
  // allow('access', ['adminPanel', { requiredRole: ['eq', 'admin'] }]); // Check against a fixed value potentially derived from context role check elsewhere
});

// --- Equivalent Rule Array ---
const rules_context: GuantrRule</*Meta*/>[] = [
  { effect: 'allow', action: 'approve', resource: 'report', condition: { submitterDepartment: ['eq', '$ctx.userDepartment'] } },
  { effect: 'deny', action: 'access', resource: 'adminPanel', condition: { requiredRole: ['in', '$ctx.userRoles'] } },
];
await guantr.setRules(rules_context);
```

### 3. Relationship Attributes (ReBAC Pattern)

A very common and powerful application of ABAC is checking attributes that define **relationships** between the user and the resource. This specific pattern is often called **Relationship-Based Access Control (ReBAC)**. Guantr handles this seamlessly using the same conditional rule mechanism.

```ts
// Assumes getContext provides { userId: string, userGroupIds: string[] }
await guantr.setRules((allow, deny) => {
  // --- Ownership ---
  // Allow editing a 'post' if the user is the owner
  allow('edit', ['post', { ownerId: ['eq', '$ctx.userId'] }]);

  // Deny deleting a 'project' unless the user is the owner
  deny('delete', 'project'); // Deny generally first
  allow('delete', ['project', { ownerId: ['eq', '$ctx.userId'] }]); // Allow specifically for the owner

  // --- Group Membership ---
  // Allow commenting on a 'document' if the user belongs to the document's group
  allow('comment', ['document', { groupId: ['in', '$ctx.userGroupIds'] }]);

  // --- Hierarchy (Conceptual Example) ---
  // Allow viewing a 'folderItem' if the user has access to its parent folder
  // (Assumes context provides parent access info, e.g., accessibleFolderIds)
  allow('view', ['folderItem', { parentFolderId: ['in', '$ctx.accessibleFolderIds'] }]);

});

// --- Equivalent Rule Array ---
const rules_rebac: GuantrRule</*Meta*/>[] = [
  { effect: 'allow', action: 'edit', resource: 'post', condition: { ownerId: ['eq', '$ctx.userId'] } },
  { effect: 'deny', action: 'delete', resource: 'project', condition: null },
  { effect: 'allow', action: 'delete', resource: 'project', condition: { ownerId: ['eq', '$ctx.userId'] } },
  { effect: 'allow', action: 'comment', resource: 'document', condition: { groupId: ['in', '$ctx.userGroupIds'] } },
  { effect: 'allow', action: 'view', resource: 'folderItem', condition: { parentFolderId: ['in', '$ctx.accessibleFolderIds'] } },
];
await guantr.setRules(rules_rebac);
```

### 4. Combining Attributes

You can easily combine different attribute checks within the same condition object for more complex logic.

```ts
// Assumes getContext provides { userId: string }
await guantr.setRules((allow, deny) => {
  // Allow publishing an 'article' only if its status is 'approved' AND the user is the owner.
  allow('publish', ['article', {
    status: ['eq', 'approved'],
    ownerId: ['eq', '$ctx.userId']
  }]);
});

// --- Equivalent Rule Array ---
const rules_combined: GuantrRule</*Meta*/>[] = [
  { effect: 'allow', action: 'publish', resource: 'article', condition: { status: ['eq', 'approved'], ownerId: ['eq', '$ctx.userId'] } },
];
await guantr.setRules(rules_combined);
```

## Checking Permissions

Checking permissions remains the same regardless of the complexity of the rules. Use the `can` or `cannot` methods, passing the specific resource instance when checking rules with conditions.

```ts
// Example: Checking permission to edit a specific article
const article = { id: 1, title: 'Intro to ABAC', status: 'draft', ownerId: 'user-123' };
const userContext = { userId: 'user-123', userDepartment: 'tech' };
// Assume guantr was initialized with getContext returning userContext

const canEdit = await guantr.can('edit', ['article', article]); // Will evaluate rules with conditions against 'article' and 'userContext'

console.log(canEdit); // Expected: true (if the relevant 'allow' rule for draft status or ownership exists and applies)
```

## Conclusion

ABAC provides a highly flexible and fine-grained approach to authorization. Guantr's conditional rule system offers a powerful and unified way to implement ABAC policies, allowing you to evaluate attributes of resources, users (via context), and their relationships (ReBAC patterns) to make precise access control decisions.
