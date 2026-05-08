/**
 * Playground: Type Safety & Autocompletion Scenarios
 *
 * Covers complex type patterns for resource/context paths, nullable fields,
 * nested objects, arrays of objects, union types, and all operator combinations.
 *
 * Open this file in an IDE with TypeScript LSP to verify autocompletion on:
 *   - resource('…') / context('…') path suggestions
 *   - Operator operand type compatibility
 *   - setRules callback narrowing
 *   - GuantrRule array inference
 *   - can() / cannot() argument narrowing
 */

import type { GuantrMeta, GuantrResourceMap, GuantrRule, Condition } from '../../src/index';
import { createGuantr, serializeRules, deserializeRules } from '../../src/index';

// ===========================================================================
// Complex resource models and context
// ===========================================================================

type Profile = {
  displayName: string;
  avatarUrl?: string;
  bio: string | null;
};

type Author = {
  id: number;
  email: string;
  role: 'admin' | 'editor' | 'viewer' | null;
  profile: Profile;
  teamIds: string[];
  permissions: Array<'read' | 'write' | 'delete' | 'manage'>;
  joinedAt: string;
};

type Comment = {
  id: number;
  body: string;
  approved: boolean;
  author: { id: number; name: string; role: string | null };
  flags: string[];
  edited: boolean;
};

type Tag = {
  name: string;
  deleted: boolean;
  metadata?: { createdBy: string; priority: number };
};

type Document = {
  id: string;
  title: string;
  status: 'draft' | 'review' | 'published' | 'archived';
  classification: 'public' | 'internal' | 'confidential' | null;
  sensitivityLevel: number;
  owner: { id: number; name: string; department: string | null };
  coAuthors: Author[];
  comments: Comment[];
  tags: Tag[];
  revisions: number;
  deletedAt?: string;
  archived: boolean;
  metadata: {
    createdAt: string;
    updatedAt: string | null;
    publishedAt?: string;
    review: { assignedTo: number | null; dueDate: string | null };
  };
};

// ===========================================================================
// Context type — what's available at check time
// ===========================================================================

type AppContext = {
  userId: number;
  userRole: 'admin' | 'editor' | 'viewer';
  userDepartmentId: string | null;
  userOrgId: string;
  userTags: string[];
  userPermissions: string[];
  session: {
    ip: string;
    userAgent: string | null;
    expiresAt: string;
  };
  featureFlags: {
    canPublish: boolean;
    canDelete: boolean;
    betaFeatures: string[];
  };
};

// ===========================================================================
// Resource map + Meta
// ===========================================================================

type ResourceMap = GuantrResourceMap<{
  document: {
    action: 'read' | 'create' | 'update' | 'delete' | 'publish' | 'archive';
    model: Document;
  };
  author: {
    action: 'read' | 'update' | 'suspend' | 'restore';
    model: Author;
  };
}>;

type AppMeta = GuantrMeta<ResourceMap, AppContext>;

// ===========================================================================
// Instance
// ===========================================================================

const guantr = await createGuantr<AppMeta>({
  context: (): AppContext => ({
    userId: 42,
    userRole: 'editor',
    userDepartmentId: 'dept-eng',
    userOrgId: 'org-acme',
    userTags: ['frontend', 'typescript'],
    userPermissions: ['read', 'write'],
    session: {
      ip: '127.0.0.1',
      userAgent: 'Mozilla/5.0',
      expiresAt: '2025-01-01T00:00:00Z',
    },
    featureFlags: {
      canPublish: true,
      canDelete: false,
      betaFeatures: ['dark-mode'],
    },
  }),
});

// ===========================================================================
// 1. setRules callback — all type paths exercised
// ===========================================================================

await guantr.setRules((allow, deny) => {
  // ── Unconditional ──────────────────────────────────────────
  allow('read', 'document');
  allow('create', 'document');
  deny('delete', 'document');

  // ── resource() top-level fields ─────────────────────────────
  allow('read', [
    'document',
    ({ eq, resource, literal }) => eq(resource('status'), literal('published')),
  ]);

  deny('read', [
    'document',
    ({ ne, resource, literal }) => ne(resource('classification'), literal('confidential')),
  ]);

  allow('read', ['document', ({ gt, resource, literal }) => gt(resource('revisions'), literal(0))]);

  allow('read', [
    'document',
    ({ gte, resource, literal }) => gte(resource('sensitivityLevel'), literal(1)),
  ]);

  // ── resource() nested object paths ─────────────────────────
  allow('update', [
    'document',
    ({ eq, resource, context }) => eq(resource('owner.id'), context('userId')),
  ]);

  // Nullable nested field
  allow('read', [
    'document',
    ({ eq, resource, literal }) => eq(resource('owner.department'), literal('dept-eng')),
  ]);

  // Deep nested: metadata.review.assignedTo (nullable)
  allow('update', [
    'document',
    ({ eq, resource, context }) => eq(resource('metadata.review.assignedTo'), context('userId')),
  ]);

  // Deep nested non-nullable
  allow('read', [
    'document',
    ({ eq, resource, literal }) => eq(resource('metadata.createdAt'), literal('2024-01-01')),
  ]);

  // ── resource() optional paths (? notation) ─────────────────
  deny('read', [
    'document',
    ({ ne, resource, literal }) => ne(resource('deletedAt'), literal(null)),
  ]);

  allow('read', [
    'document',
    ({ eq, resource, literal }) => eq(resource('metadata.publishedAt'), literal('2024-06-01')),
  ]);

  // ── resource() boolean fields ──────────────────────────────
  allow('read', [
    'document',
    ({ eq, resource, literal }) => eq(resource('archived'), literal(false)),
  ]);

  // ── context() top-level fields ─────────────────────────────
  allow('publish', [
    'document',
    ({ eq, context, literal }) => eq(context('userRole'), literal('admin')),
  ]);

  deny('publish', [
    'document',
    ({ eq, context, literal }) => eq(context('userRole'), literal('viewer')),
  ]);

  // ── context() nested object paths ──────────────────────────
  allow('read', [
    'document',
    ({ eq, context, literal }) => eq(context('session.ip'), literal('127.0.0.1')),
  ]);

  allow('read', [
    'document',
    ({ eq, context, literal }) => eq(context('featureFlags.canPublish'), literal(true)),
  ]);

  // context array: userTags
  deny('read', [
    'document',
    ({ has, context, literal }) => has(context('userTags'), literal('blocked')),
  ]);

  // context nested nullable
  allow('read', [
    'document',
    ({ eq, context, literal }) => eq(context('session.userAgent'), literal('Mozilla/5.0')),
  ]);

  // ── context() vs resource() cross-reference ────────────────
  allow('update', [
    'document',
    ({ eq, resource, context }) => eq(resource('owner.id'), context('userId')),
  ]);

  allow('read', [
    'document',
    ({ eq, resource, context }) => eq(resource('owner.department'), context('userDepartmentId')),
  ]);

  // ── string operators ───────────────────────────────────────
  allow('read', [
    'document',
    ({ contains, resource, literal }) =>
      contains(resource('title'), literal('report'), { caseInsensitive: true }),
  ]);

  allow('read', [
    'document',
    ({ startsWith, resource, literal }) => startsWith(resource('title'), literal('Draft:')),
  ]);

  allow('read', [
    'document',
    ({ endsWith, resource, literal }) => endsWith(resource('title'), literal('.md')),
  ]);

  // ── array membership on context arrays ────────────────────
  deny('read', [
    'document',
    ({ has, context, literal }) => has(context('userTags'), literal('blocked')),
  ]);

  allow('read', [
    'document',
    ({ hasSome, context, literal }) =>
      hasSome(context('userTags'), literal(['frontend', 'backend'])),
  ]);

  // ── numeric comparisons ────────────────────────────────────
  allow('read', [
    'document',
    ({ gt, resource, literal }) => gt(resource('sensitivityLevel'), literal(0)),
  ]);

  allow('read', [
    'document',
    ({ lt, resource, literal }) => lt(resource('revisions'), literal(100)),
  ]);

  allow('read', [
    'document',
    ({ gte, resource, literal }) => gte(resource('sensitivityLevel'), literal(1)),
  ]);

  allow('read', [
    'document',
    ({ lte, resource, literal }) => lte(resource('sensitivityLevel'), literal(5)),
  ]);

  // ── complex array: some ────────────────────────────────────
  allow('read', [
    'document',
    ({ some, resource: r }) =>
      some(r('comments'), ({ eq, resource: cr, literal }) => eq(cr('approved'), literal(true))),
  ]);

  // Nested object inside array element
  allow('read', [
    'document',
    ({ some, resource: r }) =>
      some(r('comments'), ({ eq, resource: cr, context: c }) => eq(cr('author.id'), c('userId'))),
  ]);

  // Nullable field inside array element
  allow('read', [
    'document',
    ({ some, resource: r }) =>
      some(r('comments'), ({ eq, resource: cr, literal }) =>
        eq(cr('author.role'), literal('admin')),
      ),
  ]);

  // ── complex array: every ───────────────────────────────────
  allow('publish', [
    'document',
    ({ every, resource: r }) =>
      every(r('comments'), ({ eq, resource: cr, literal }) => eq(cr('approved'), literal(true))),
  ]);

  // ── complex array: none ────────────────────────────────────
  allow('publish', [
    'document',
    ({ none, resource: r }) =>
      none(r('tags'), ({ eq, resource: tr, literal }) => eq(tr('deleted'), literal(true))),
  ]);

  // ── complex array: some on co-authors ──────────────────────
  allow('update', [
    'document',
    ({ some, resource: r }) =>
      some(r('coAuthors'), ({ eq, resource: ar, context: c }) => eq(ar('id'), c('userId'))),
  ]);

  // ── complex array: nested object inside Author ─────────────
  allow('read', [
    'document',
    ({ some, resource: r }) =>
      some(r('coAuthors'), ({ ne, resource: ar, literal }) => ne(ar('profile.bio'), literal(null))),
  ]);

  // ── logical operators ──────────────────────────────────────
  allow('read', [
    'document',
    ({ and, eq, resource, literal }) =>
      and(eq(resource('status'), literal('published')), eq(resource('archived'), literal(false))),
  ]);

  allow('publish', [
    'document',
    ({ and, or, eq, resource, context, literal }) =>
      and(
        eq(resource('status'), literal('review')),
        or(eq(resource('owner.id'), context('userId')), eq(context('userRole'), literal('admin'))),
      ),
  ]);

  allow('read', [
    'document',
    ({ not, eq, resource, literal }) => not(eq(resource('status'), literal('archived'))),
  ]);

  // ── allow/deny with other resource types ───────────────────
  allow('read', 'author');

  allow('update', ['author', ({ eq, resource, context }) => eq(resource('id'), context('userId'))]);

  allow('suspend', [
    'author',
    ({ and, eq, in: inOp, resource, context, literal }) =>
      and(
        eq(context('userRole'), literal('admin')),
        inOp(resource('role'), literal(['editor', 'viewer'])),
      ),
  ]);

  allow('read', [
    'author',
    ({ contains, resource, literal }) => contains(resource('email'), literal('@acme.com')),
  ]);

  allow('read', [
    'author',
    ({ eq, resource, literal }) => eq(resource('profile.bio'), literal(null)),
  ]);

  allow('update', [
    'author',
    ({ hasEvery, resource, literal }) =>
      hasEvery(resource('permissions'), literal(['read', 'write'])),
  ]);
});

// ===========================================================================
// 2. GuantrRule array — typed rule objects
// ===========================================================================

// Per-resource meta types for discriminated rule arrays
type DocMeta = GuantrMeta<
  GuantrResourceMap<{
    document: ResourceMap['document'];
  }>,
  AppContext
>;
type AuthorMeta = GuantrMeta<
  GuantrResourceMap<{
    author: ResourceMap['author'];
  }>,
  AppContext
>;

const documentRules: GuantrRule<DocMeta>[] = [
  { resource: 'document', action: 'read', effect: 'allow' },
  {
    resource: 'document',
    action: 'update',
    effect: 'allow',
    matchCondition: ({ eq, resource, context }) => eq(resource('owner.id'), context('userId')),
  },
  {
    resource: 'document',
    action: 'publish',
    effect: 'deny',
    matchCondition: ({ and, eq, resource, literal }) =>
      and(eq(resource('status'), literal('archived')), eq(resource('archived'), literal(true))),
  },
  {
    resource: 'document',
    action: 'delete',
    effect: 'allow',
    matchCondition: ({ and, not, eq, resource, literal }) =>
      and(eq(resource('owner.id'), literal(42)), not(eq(resource('deletedAt'), literal(null)))),
  },
];

const authorRules: GuantrRule<AuthorMeta>[] = [
  { resource: 'author', action: 'read', effect: 'allow' },
  {
    resource: 'author',
    action: 'suspend',
    effect: 'allow',
    matchCondition: ({ eq, resource, context }) => eq(resource('id'), context('userId')),
  },
  {
    resource: 'author',
    action: 'update',
    effect: 'allow',
    matchCondition: ({ contains, resource, literal }) =>
      contains(resource('email'), literal('@acme.com')),
  },
  {
    resource: 'author',
    action: 'read',
    effect: 'allow',
    matchCondition: ({ eq, resource, literal }) => eq(resource('profile.bio'), literal(null)),
  },
  {
    resource: 'author',
    action: 'update',
    effect: 'allow',
    matchCondition: ({ hasEvery, resource, literal }) =>
      hasEvery(resource('permissions'), literal(['read', 'write'])),
  },
];

await guantr.setRules([...documentRules, ...authorRules] as GuantrRule<AppMeta>[]);

// ===========================================================================
// 3. can() / cannot() type narrowing
// ===========================================================================

const doc: Document = {
  id: 'doc-1',
  title: 'Test Document',
  status: 'published',
  classification: 'internal',
  sensitivityLevel: 2,
  owner: { id: 42, name: 'Alice', department: 'dept-eng' },
  coAuthors: [],
  comments: [],
  tags: [],
  revisions: 3,
  archived: false,
  metadata: {
    createdAt: '2024-01-01',
    updatedAt: null,
    review: { assignedTo: 42, dueDate: '2024-06-01' },
  },
};

void guantr.can('read', ['document', doc]);
void guantr.cannot('update', ['document', doc]);
void guantr.can.abstract('publish', 'document');
void guantr.cannot.abstract('archive', 'document');

void guantr.can.all([
  ['read', ['document', doc]],
  ['update', ['document', doc]],
]);
void guantr.can.any([
  ['read', ['document', doc]],
  ['publish', ['document', doc]],
]);

// ===========================================================================
// 4. serializeRules / deserializeRules typing
// ===========================================================================

const rulesForSerialization: GuantrRule<DocMeta>[] = [
  { resource: 'document', action: 'read', effect: 'allow' },
  {
    resource: 'document',
    action: 'update',
    effect: 'allow',
    matchCondition: ({ eq, resource, context }) => eq(resource('owner.id'), context('userId')),
  },
];

const serialized: GuantrRule<DocMeta>[] = serializeRules<DocMeta>(rulesForSerialization);

const firstRule = serialized[0]!;
void (firstRule.effect satisfies 'allow' | 'deny');

const deserialized: GuantrRule<DocMeta>[] = deserializeRules<DocMeta>(serialized);
void deserialized;

// ===========================================================================
// 5. relatedRulesFor / getRules typing
// ===========================================================================

void guantr.relatedRulesFor('read', 'document');
void guantr.relatedRulesFor('suspend', 'author');

void guantr.getRules().then((rules) => {
  for (const rule of rules) {
    if (rule.matchCondition && typeof rule.matchCondition !== 'function') {
      const cond = rule.matchCondition as Condition;
      void (cond.type satisfies 'condition');
    }
  }
});

// ===========================================================================
// Log success
// ===========================================================================

console.log('✅ All type-safety playground scenarios loaded successfully.');
