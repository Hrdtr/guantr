# Common Patterns

This page collects authorization patterns implemented with Guantr v2.0. Each pattern includes a complete code example using typed resource maps and the builder DSL.

---

## 1. Ownership (ReBAC)

Allow an action only when the resource's owner matches the current user.

```ts
import { createGuantr } from 'guantr';
import type { GuantrMeta, GuantrResourceMap } from 'guantr';

interface DocModel {
  id: string;
  title: string;
  ownerId: string;
  content: string;
}

type ResourceMap = GuantrResourceMap<{
  document: {
    action: 'read' | 'edit' | 'delete';
    model: DocModel;
  };
}>;

type MyMeta = GuantrMeta<ResourceMap, { userId: string }>;

const guantr = await createGuantr<MyMeta>({
  context: () => ({ userId: 'user-42' }),
});

await guantr.setRules((allow, deny) => {
  // Everyone can read
  allow('read', 'document');

  // Only the owner can edit or delete
  allow('edit', [
    'document',
    ({ eq, resource, context }) => eq(resource('ownerId'), context('userId')),
  ]);
  allow('delete', [
    'document',
    ({ eq, resource, context }) => eq(resource('ownerId'), context('userId')),
  ]);
});

const doc: DocModel = { id: 'd1', title: 'Plan', ownerId: 'user-42', content: '...' };
await guantr.can('edit', ['document', doc]); // → true (user is owner)
```

### Ownership for Unauthenticated Users

When `userId` can be `null`, use explicit nullability:

```ts
type GuestMeta = GuantrMeta<ResourceMap, { userId: string | null }>;

await guantr.setRules((allow) => {
  allow('edit', [
    'document',
    ({ eq, resource, context }) => eq(resource('ownerId'), context('userId')),
  ]);
  // If context('userId') resolves to null, eq(null, null) is true,
  // which would incorrectly treat guests as owners of documents with a
  // null ownerId. Guard against this by requiring context('userId') to be
  // non-null (e.g., using isDefined or neq(null)) before applying eq.
});
```

---

## 2. Role-Based Access

Check the user's role against required values.

```ts
type RoleMeta = GuantrMeta<
  GuantrResourceMap<{
    article: {
      action: 'read' | 'create' | 'update' | 'delete';
      model: { id: number; status: string };
    };
  }>,
  { role: 'admin' | 'editor' | 'viewer' }
>;

const guantr = await createGuantr<RoleMeta>({
  context: () => ({ role: 'editor' }),
});

await guantr.setRules((allow, deny) => {
  // Everyone can read
  allow('read', 'article');

  // Admins can do everything
  allow('create', ['article', ({ eq, context, literal }) => eq(context('role'), literal('admin'))]);
  allow('update', ['article', ({ eq, context, literal }) => eq(context('role'), literal('admin'))]);
  allow('delete', ['article', ({ eq, context, literal }) => eq(context('role'), literal('admin'))]);

  // Editors can update
  allow('update', [
    'article',
    ({ in: inOp, context, literal }) => inOp(context('role'), literal(['admin', 'editor'])),
  ]);
});
```

### Role Enum via Literal Union

The builder's `literal()` carries the precise type, so `literal('admin')` is typed as `'admin'` and `eq(context('role'), literal('admin'))` is valid because both sides are compatible. Using a wider union like `literal(['admin', 'editor'])` with `in` also type-checks because the array element type matches the context path type.

### DRY Role Checks

Extract repeated role checks into a reusable helper:

```ts
function isRole(roles: AppContext['role'][]) {
  if (roles.length === 1) {
    return ({ eq, context, literal }: Parameters<MatchConditionFn>[0]) =>
      eq(context('role'), literal(roles[0]));
  }
  return ({ in: inOp, context, literal }: Parameters<MatchConditionFn>[0]) =>
    inOp(context('role'), literal(roles));
}

await guantr.setRules((allow) => {
  allow('create', ['article', isRole(['admin', 'editor'])]);
  allow('update', ['article', isRole(['admin', 'editor'])]);
  allow('delete', ['article', isRole(['admin'])]);
});
```

---

## 3. Multi-Tenant Isolation

Restrict access to resources belonging to the user's organization.

```ts
interface TenantDocModel {
  id: string;
  orgId: string;
  title: string;
}

type TenantMeta = GuantrMeta<
  GuantrResourceMap<{
    document: { action: 'read' | 'write'; model: TenantDocModel };
  }>,
  { orgId: string }
>;

const guantr = await createGuantr<TenantMeta>({
  context: () => ({ orgId: 'org-acme' }),
});

await guantr.setRules((allow) => {
  allow('read', [
    'document',
    ({ eq, resource, context }) => eq(resource('orgId'), context('orgId')),
  ]);
  allow('write', [
    'document',
    ({ eq, resource, context }) => eq(resource('orgId'), context('orgId')),
  ]);
});

const doc: TenantDocModel = { id: 'd1', orgId: 'org-acme', title: 'Report' };
await guantr.can('read', ['document', doc]); // → true

const otherDoc: TenantDocModel = { id: 'd2', orgId: 'org-beta', title: 'Secret' };
await guantr.can('read', ['document', otherDoc]); // → false
```

---

## 4. Status-Based Access

Change permissions based on resource lifecycle state.

```ts
await guantr.setRules((allow, deny) => {
  // Published posts are readable by everyone
  allow('read', [
    'post',
    ({ eq, resource, literal }) => eq(resource('status'), literal('published')),
  ]);

  // Drafts are readable only by editors
  allow('read', [
    'post',
    ({ and, eq, resource, context, literal }) =>
      and(eq(resource('status'), literal('draft')), eq(context('role'), literal('editor'))),
  ]);

  // Archived posts are not readable by anyone — explicit deny
  deny('read', [
    'post',
    ({ eq, resource, literal }) => eq(resource('status'), literal('archived')),
  ]);
});
```

The explicit deny for `archived` ensures that even if another rule grants access, archived posts are blocked (deny overrides allow).

---

## 5. Soft-Delete

Exclude soft-deleted records from access using denial or negation.

```ts
await guantr.setRules((allow, deny) => {
  // Approach A: Deny deleted records explicitly
  deny('read', ['post', ({ ne, resource, literal }) => ne(resource('deletedAt'), literal(null))]);
  allow('read', 'post');

  // Approach B: Allow only non-deleted records with a condition
  allow('update', [
    'post',
    ({ eq, resource, literal }) => eq(resource('deletedAt'), literal(null)),
  ]);
});
```

Approach A grants broad access then denies deleted ones. Approach B gates access on the condition that `deletedAt` is null. Both are valid; choose based on whether you want a deny audit trail or a simpler allow-only policy.

---

## 6. Published Content Only

Require multiple conditions to all hold.

```ts
await guantr.setRules((allow) => {
  allow('read', [
    'article',
    ({ and, eq, resource, literal }) =>
      and(eq(resource('status'), literal('published')), eq(resource('deleted'), literal(false))),
  ]);
});
```

Combine with `or` for broader access:

```ts
allow('read', [
  'article',
  ({ and, or, eq, resource, context, literal }) =>
    and(
      eq(resource('deleted'), literal(false)),
      or(
        eq(resource('status'), literal('published')),
        eq(resource('authorId'), context('userId')), // author can always see
      ),
    ),
]);
```

---

## 7. Team Membership

Grant access when the user belongs to one of the resource's teams.

```ts
type TeamMeta = GuantrMeta<
  GuantrResourceMap<{
    project: {
      action: 'view' | 'edit';
      model: { id: string; teamIds: string[] };
    };
  }>,
  { userTeamIds: string[] }
>;

const guantr = await createGuantr<TeamMeta>({
  context: () => ({ userTeamIds: ['team-a', 'team-c'] }),
});

await guantr.setRules((allow) => {
  // User must share at least one team with the project
  allow('view', [
    'project',
    ({ hasSome, resource, context }) => hasSome(resource('teamIds'), context('userTeamIds')),
  ]);

  // All teams must overlap (user must be in every project team)
  allow('edit', [
    'project',
    ({ hasEvery, resource, context }) => hasEvery(resource('teamIds'), context('userTeamIds')),
  ]);
});

const project = { id: 'p1', teamIds: ['team-a', 'team-b'] };
await guantr.can('view', ['project', project]); // → true ('team-a' overlap)
await guantr.can('edit', ['project', project]); // → false (user lacks 'team-b')
```

---

## 8. Approval Workflow

Require all checks passed and no blocking issues.

```ts
interface ReleaseModel {
  id: string;
  checks: { status: 'passed' | 'failed' }[];
  issues: { isBlocking: boolean }[];
}

type ReleaseMeta = GuantrMeta<
  GuantrResourceMap<{
    release: { action: 'publish'; model: ReleaseModel };
  }>
>;

const guantr = await createGuantr<ReleaseMeta>();

await guantr.setRules((allow) => {
  allow('publish', [
    'release',
    ({ and, every, none, eq, resource, literal }) =>
      and(
        // Every check must be 'passed'
        every(resource('checks'), ({ eq, resource }) => eq(resource('status'), literal('passed'))),
        // No blocking issues exist
        none(resource('issues'), ({ eq, resource }) => eq(resource('isBlocking'), literal(true))),
      ),
  ]);
});

const release: ReleaseModel = {
  id: 'v2.0',
  checks: [{ status: 'passed' }, { status: 'passed' }],
  issues: [{ isBlocking: false }, { isBlocking: false }],
};
await guantr.can('publish', ['release', release]); // → true
```

---

## 9. ABAC: Attribute-to-Builder Reference

Attribute-Based Access Control maps directly to Guantr's builder methods. Use this table to translate policy attributes into conditions:

| Attribute dimension | Builder method                        | Example                                        |
| ------------------- | ------------------------------------- | ---------------------------------------------- |
| Resource field      | `resource('field')`                   | `eq(resource('status'), literal('published'))` |
| User / Session      | `context('field')`                    | `eq(context('role'), literal('admin'))`        |
| Literal constant    | `literal(value)`                      | `literal(42)`, `literal(['a', 'b'])`           |
| Cross-attribute     | `resource` vs `context`               | `eq(resource('ownerId'), context('userId'))`   |
| Logical composition | `and` / `or` / `not`                  | `and(eq(...), not(eq(...)))`                   |
| Array membership    | `has` / `hasSome` / `hasEvery` / `in` | `has(resource('tags'), literal('urgent'))`     |
| Nested array        | `some` / `every` / `none`             | `some(resource('items'), (b) => b.eq(...))`    |

Every condition is serialized to a JSON-compatible AST at definition time and evaluated against live resource instances and context at check time.

---

## Related

- **[Abstract vs Resource-Aware Checks](/guides/abstract-vs-resource-aware)** — When to use `can.abstract` vs `can` with an instance.
- **[Batch Permission Checking](/guides/abstract-vs-resource-aware#batch-checks-can-all-can-any-cannot-all-cannot-any)** — `can.all`, `can.any`, `cannot.all`, `cannot.any`.
- **[Defining Rules](/guides/defining-rules)** — Rule structure, precedence, inspecting rules.
- **[Context Usage](/guides/context-usage)** — Dynamic context patterns.
