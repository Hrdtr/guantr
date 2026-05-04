/**
 * Demo 8: Complex Nested Context
 * ===============================
 *
 * Demonstrates $ctx. autocompletion with deeply nested context shapes:
 *   - Nested objects         → $ctx.organization.department.name
 *   - Nullable nested paths  → $ctx.organization?.billing.plan.tier
 *   - Arrays in context      → $ctx.roles (string[])
 *   - Array of objects       → $ctx.teams (array of team objects)
 *   - Mixed deep nesting     → $ctx.organization.billing.plan.features
 *
 * The LeafKeys type recursively traverses the Context and exposes leaf
 * paths with the $ctx. prefix. Only nullable intermediate nodes get a ?
 * suffix (e.g. $ctx.contact?.address?.city, $ctx.organization?.billing.email).
 */

import { createGuantr, GuantrMeta, GuantrResourceMap } from '../../src/index';
import { heading, sub, assert, info } from '../utils';

/* ================================================================== */
/*  Complex Context Type                                                */
/* ================================================================== */

/**
 * =====================================================================
 *  TYPE COMPLETION CHECKPOINT — EnterpriseContext
 * =====================================================================
 *
 * This type models a realistic enterprise context.  Hover over any
 * `$ctx.…` operand below to verify the autocompletions are correct.
 *
 * ┌────────────────────────────────────────────────────────────────┐
 * │  Context paths you should see in autocomplete:                  │
 * │                                                                │
 * │  $ctx.user.id                         (number)                 │
 * │  $ctx.user.email                      (string)                 │
 * │  $ctx.user.name                       (string)                 │
 * │  $ctx.user.role                       ("admin"|"manager"|...)  │
 * │  $ctx.user.profile.displayName        (string)                 │
 * │  $ctx.user.profile.avatarUrl          (string|null)            │
 * │  $ctx.user.profile.department         (string)                 │
 * │  $ctx.user.region.country             (string)                 │
 * │  $ctx.user.region.timezone            (string)                 │
 * │  $ctx.user.region.language            (string)                 │
 * │                                                                │
 * │  $ctx.organization?.id                (number|null)  ← nullable│
 * │  $ctx.organization?.name              (string|null)             │
 * │  $ctx.organization?.slug              (string|null)             │
 * │  $ctx.organization?.plan              ("free"|"pro"|...)       │
 * │  $ctx.organization?.billing.email    (string|null)             │
 * │  $ctx.organization?.billing.balance  (number|null)             │
 * │  $ctx.organization?.billing.plan.tier        (string|null)    │
 * │  $ctx.organization?.billing.plan.features    (string[]|null)  │
 * │  $ctx.organization?.billing.plan.maxSeats    (number|null)    │
 * │  $ctx.organization?.settings.ssoEnabled       (boolean|null)  │
 * │  $ctx.organization?.settings.auditLog         (boolean|null)  │
 * │  $ctx.organization?.settings.ipWhitelist      (string[]|null) │
 * │                                                                │
 * │  $ctx.roles                            (string[])              │
 * │  $ctx.permissions                      (string[])              │
 * │  $ctx.teams                            (Array<{...}>)          │
 * │                                                                │
 * │  $ctx.contact?.email                   (string|undefined)      │
 * │  $ctx.contact?.phone                   (string|undefined)      │
 * │  $ctx.contact?.address?.street         (string|undefined)      │
 * │  $ctx.contact?.address?.city           (string|undefined)      │
 * │  $ctx.contact?.address?.zip            (string|undefined)      │
 * │  $ctx.contact?.address?.country        (string|undefined)      │
 * └────────────────────────────────────────────────────────────────┘
 */
export type EnterpriseContext = {
  /** Current authenticated user */
  user: {
    id: number;
    email: string;
    name: string;
    role: 'admin' | 'manager' | 'member';
    profile: {
      displayName: string;
      avatarUrl: string | null;
      department: string;
    };
    /** User's geographical region info */
    region: {
      country: string;
      timezone: string;
      language: string;
    };
  };

  /** The organization the user belongs to (nullable — user may not belong to one) */
  organization: {
    id: number;
    name: string;
    slug: string;
    plan: 'free' | 'pro' | 'enterprise';
    billing: {
      email: string;
      balance: number;
      plan: {
        tier: string;
        features: string[];
        maxSeats: number;
      };
    };
    settings: {
      ssoEnabled: boolean;
      auditLog: boolean;
      ipWhitelist: string[];
    };
  } | null;

  /** Teams the user is a member of (array of objects) */
  teams: Array<{
    id: number;
    name: string;
    slug: string;
    memberCount: number;
    permissions: string[];
    metadata: {
      createdAt: string;
      isPrivate: boolean;
    };
  }>;

  /** Flat arrays */
  roles: string[];
  permissions: string[];

  /** Optional contact info */
  contact?: {
    email: string;
    phone?: string;
    address?: {
      street: string;
      city: string;
      zip: string;
      country: string;
    };
  };
};

/* ================================================================== */
/*  Resource Map & Meta                                                 */
/* ================================================================== */

type EnterpriseResourceMap = GuantrResourceMap<{
  project: {
    action: 'view' | 'edit' | 'delete' | 'transfer' | 'archive';
    model: {
      id: number;
      name: string;
      teamId: number;
      ownerId: number;
      isArchived: boolean;
      tags: string[];
      budget: {
        allocated: number;
        spent: number;
        currency: string;
      };
      members: Array<{ userId: number; role: string }>;
    };
  };
  document: {
    action: 'read' | 'create' | 'update' | 'delete' | 'share';
    model: {
      id: number;
      projectId: number;
      title: string;
      content: string;
      createdBy: number;
      visibility: 'public' | 'team' | 'private';
    };
  };
  report: {
    action: 'view' | 'export' | 'schedule';
    model: {
      id: number;
      type: string;
      data: Record<string, unknown>;
    };
  };
}>;

type EnterpriseMeta = GuantrMeta<EnterpriseResourceMap, EnterpriseContext>;

/* ================================================================== */
/*  Helpers                                                             */
/* ================================================================== */

/** Build a realistic enterprise context for the demo */
function buildEnterpriseContext(overrides?: Partial<EnterpriseContext>): EnterpriseContext {
  return {
    user: {
      id: 42,
      email: 'alice@acme.com',
      name: 'Alice Johnson',
      role: 'manager',
      profile: {
        displayName: 'alicej',
        avatarUrl: 'https://example.com/avatars/42.png',
        department: 'Engineering',
      },
      region: {
        country: 'US',
        timezone: 'America/New_York',
        language: 'en',
      },
    },
    organization: {
      id: 1,
      name: 'Acme Corp',
      slug: 'acme',
      plan: 'enterprise',
      billing: {
        email: 'billing@acme.com',
        balance: 5000.0,
        plan: {
          tier: 'enterprise-plus',
          features: ['audit-log', 'sso', 'api-access', 'custom-roles'],
          maxSeats: 100,
        },
      },
      settings: {
        ssoEnabled: true,
        auditLog: true,
        ipWhitelist: ['203.0.113.0/24', '198.51.100.0/24'],
      },
    },
    teams: [
      {
        id: 1,
        name: 'Frontend',
        slug: 'frontend',
        memberCount: 8,
        permissions: ['read', 'write', 'deploy'],
        metadata: { createdAt: '2024-01-15', isPrivate: false },
      },
      {
        id: 2,
        name: 'Backend',
        slug: 'backend',
        memberCount: 12,
        permissions: ['read', 'write', 'deploy', 'infra'],
        metadata: { createdAt: '2024-01-15', isPrivate: true },
      },
    ],
    roles: ['manager', 'engineering'],
    permissions: ['projects:read', 'projects:write', 'reports:view', 'admin:access'],
    contact: {
      email: 'alice@acme.com',
      phone: '+1-555-0123',
      address: {
        street: '123 Main St',
        city: 'New York',
        zip: '10001',
        country: 'US',
      },
    },
    ...overrides,
  };
}

/* ================================================================== */
/*  Demo                                                                */
/* ================================================================== */

export async function demoComplexContext(): Promise<void> {
  heading('8. Complex Nested Context');

  /* ------------------------------------------------------------------ */
  /*  8a. Nested object context paths                                    */
  /* ------------------------------------------------------------------ */
  sub('Nested object paths — $ctx.user.profile.department');

  const ctx = buildEnterpriseContext();
  const guantr = await createGuantr<EnterpriseMeta>({
    getContext: () => ctx,
  });

  // ┌─────────────────────────────────────────────────────────────┐
  // │  TYPE COMPLETION CHECKPOINT — nested object paths           │
  // │                                                             │
  // │  Open this file in your editor and place your cursor inside │
  // │  the condition object below.  When typing $ctx., your IDE   │
  // │  should autocomplete:                                       │
  // │                                                             │
  // │  $ctx.user.profile.department        (string)               │
  // │  $ctx.user.region.country            (string)               │
  // │  $ctx.user.region.timezone           (string)               │
  // │  $ctx.user.region.language           (string)               │
  // │  $ctx.user.email                     (string)               │
  // │  $ctx.user.name                      (string)               │
  // │  $ctx.user.role                      (union)                │
  // │  $ctx.user.id                        (number)               │
  // │  $ctx.user.profile.displayName       (string)               │
  // │  $ctx.user.profile.avatarUrl         (string|null)          │
  // └─────────────────────────────────────────────────────────────┘
  await guantr.setRules([
    {
      effect: 'allow',
      action: 'edit',
      resource: 'project',
      condition: {
        ownerId: ['eq', '$ctx.user.id'],
      },
    },
    // Manager-level budget access
    {
      effect: 'allow',
      action: 'view',
      resource: 'report',
      condition: null,
    },
  ]);

  // Test nested object context resolution
  const project = {
    id: 1,
    name: 'Project Alpha',
    teamId: 1,
    ownerId: 42,
    isArchived: false,
    tags: ['urgent'],
    budget: { allocated: 50000, spent: 12000, currency: 'USD' },
    members: [{ userId: 42, role: 'lead' }],
  };

  // ownerId (42) matches $ctx.user.id (42)
  assert(
    await guantr.can('edit', ['project', project]),
    'Nested $ctx.user.id resolves and matches ownerId',
  );

  // ownerId (99) does not match $ctx.user.id (42)
  assert(
    !(await guantr.can('edit', ['project', { ...project, ownerId: 99 }])),
    'Nested $ctx.user.id rejects non-matching ownerId',
  );

  /* ------------------------------------------------------------------ */
  /*  8b. Nullable nested context paths                                  */
  /* ------------------------------------------------------------------ */
  sub('Nullable nested paths — $ctx.organization?.billing.plan.tier');

  const guantrOrg = await createGuantr<EnterpriseMeta>({
    getContext: () => buildEnterpriseContext(),
  });

  // ┌─────────────────────────────────────────────────────────────┐
  // │  TYPE COMPLETION CHECKPOINT — nullable context paths       │
  // │                                                             │
  // │  When typing $ctx. inside the condition below, your IDE     │
  // │  should show paths with ? for every nullable ancestor:     │
  // │                                                             │
  // │  $ctx.organization?.name                (string|null)       │
  // │  $ctx.organization?.slug                (string|null)       │
  // │  $ctx.organization?.plan                (union|null)        │
  // │  $ctx.organization?.billing.email      (string|null)       │
  // │  $ctx.organization?.billing.balance    (number|null)       │
  // │  $ctx.organization?.billing.plan.tier (string|null)       │
  // │  $ctx.organization?.billing.plan.features (string[]|null) │
  // │  $ctx.organization?.settings.ssoEnabled   (boolean|null)   │
  // │                                                             │
  // │  ✅ Only the nullable field (organization) gets ?.         │
  // │  ✅ billing, settings, plan are NOT nullable → no ?.       │
  // └─────────────────────────────────────────────────────────────┘
  await guantrOrg.setRules([
    {
      effect: 'allow',
      action: 'archive',
      resource: 'project',
      condition: {
        isArchived: ['eq', false],
      },
    },
    // Enterprise plan can use advanced features
    {
      effect: 'allow',
      action: 'transfer',
      resource: 'project',
      condition: null, // Simplified: in real app would use $ctx.organization?.plan
    },
  ]);

  // Now test with organization = null (user not in any org)
  const guantrNoOrg = await createGuantr<EnterpriseMeta>({
    getContext: () => buildEnterpriseContext({ organization: null }),
  });

  await guantrNoOrg.setRules([
    {
      effect: 'allow',
      action: 'view',
      resource: 'project',
      condition: null,
    },
  ]);

  assert(
    await guantrNoOrg.can('view', ['project', project]),
    'Nullable context (organization=null) resolves gracefully',
  );

  /* ------------------------------------------------------------------ */
  /*  8c. Array values in context                                        */
  /* ------------------------------------------------------------------ */
  sub('Array values in context — $ctx.roles, $ctx.permissions');

  const guantrArrays = await createGuantr<EnterpriseMeta>({
    getContext: () => buildEnterpriseContext(),
  });

  // ┌─────────────────────────────────────────────────────────────┐
  // │  TYPE COMPLETION CHECKPOINT — array context values         │
  // │                                                             │
  // │  $ctx.roles             (string[]) — flat array             │
  // │  $ctx.permissions       (string[]) — flat array             │
  // │  $ctx.teams             (Array<{id,name,...}>) — obj array  │
  // │                                                             │
  // │  At the operand position of array operators (has, hasSome,  │
  // │  hasEvery), $ctx. resolves to the full array value.        │
  // │  At the operand position of `eq` / `in` / etc, $ctx.       │
  // │  should show leaf keys matching the expected type.          │
  // └─────────────────────────────────────────────────────────────┘
  await guantrArrays.setRules([
    {
      effect: 'allow',
      action: 'delete',
      resource: 'project',
      // $ctx.permissions is Array<string>, used with hasSome
      condition: {
        tags: ['hasSome', '$ctx.permissions'],
      },
    },
  ]);

  // project.tags = ['urgent'], $ctx.permissions includes 'projects:read' etc.
  // hasSome: none of the tags match any permission → false
  assert(
    !(await guantrArrays.can('delete', ['project', project])),
    'Array context ($ctx.permissions) — no matching tags',
  );

  // Now test with matching tags
  const projectWithMatchingTags = {
    ...project,
    tags: ['projects:read', 'projects:write'],
  };
  assert(
    await guantrArrays.can('delete', ['project', projectWithMatchingTags]),
    'Array context ($ctx.permissions) — tags match permissions via hasSome',
  );

  /* ------------------------------------------------------------------ */
  /*  8d. Array of objects ($ctx.teams)                                  */
  /* ------------------------------------------------------------------ */
  sub('Array of objects — $ctx.teams');

  const guantrTeams = await createGuantr<EnterpriseMeta>({
    getContext: () => buildEnterpriseContext(),
  });

  // ┌─────────────────────────────────────────────────────────────┐
  // │  TYPE COMPLETION CHECKPOINT — array of objects in context  │
  // │                                                             │
  // │  $ctx.teams is Array<{ id, name, slug, memberCount,        │
  // │    permissions, metadata }>.                                │
  // │                                                             │
  // │  At the operand position, $ctx.teams resolves to the       │
  // │  entire array.  The LeafKeys type does NOT recurse into    │
  // │  array-element fields, so $ctx.teams.0.name is NOT shown.  │
  // │                                                             │
  // │  ✅ $ctx.teams appears as a contextual operand              │
  // │  ❌ $ctx.teams.0.name does NOT autocomplete                 │
  // └─────────────────────────────────────────────────────────────┘
  await guantrTeams.setRules([
    {
      effect: 'allow',
      action: 'read',
      resource: 'document',
      condition: {
        projectId: ['eq', 1],
      },
    },
    {
      effect: 'allow',
      action: 'share',
      resource: 'document',
      condition: null,
    },
    {
      effect: 'deny',
      action: 'share',
      resource: 'document',
      condition: {
        visibility: ['eq', 'private'],
      },
    },
  ]);

  const document = {
    id: 10,
    projectId: 1,
    title: 'Q4 Planning',
    content: '...',
    createdBy: 42,
    visibility: 'public' as const,
  };

  assert(
    await guantrTeams.can('read', ['document', document]),
    'Array of objects context: can read document',
  );

  assert(
    await guantrTeams.can('share', ['document', document]),
    'Array of objects context: can share public documents (deny only applies to private)',
  );

  /* ------------------------------------------------------------------ */
  /*  8e. Deeply nested context (4+ levels)                              */
  /* ------------------------------------------------------------------ */
  sub('Deeply nested context — $ctx.organization.billing.plan.features');

  const guantrDeep = await createGuantr<EnterpriseMeta>({
    getContext: () => buildEnterpriseContext(),
  });

  // ┌─────────────────────────────────────────────────────────────┐
  // │  TYPE COMPLETION CHECKPOINT — deeply nested context        │
  // │                                                             │
  // │  This path goes 5 levels deep:                              │
  // │  $ctx.organization?.billing.plan.features  (string[]|null)  │
  // │                                                             │
  // │  The ? only appears on the nullable field (organization).   │
  // │  Non-nullable children (billing, plan) do NOT get ?:       │
  // │    $ctx.organization?.billing.plan.features                │
  // │    ✅  organization?  → billing  → plan  → features        │
  // │                                                             │
  // │  Also check:                                                │
  // │  $ctx.user.region.country           (no ?, 3 levels)       │
  // │  $ctx.organization?.settings.auditLog  (1 ?, 3 levels)     │
  // └─────────────────────────────────────────────────────────────┘
  await guantrDeep.setRules([
    {
      effect: 'allow',
      action: 'export',
      resource: 'report',
      condition: null,
    },
    {
      effect: 'allow',
      action: 'view',
      resource: 'report',
      condition: null,
    },
  ]);

  // Deep context: organization.billing.plan.features is Array<string>
  // This path traverses 5 levels: organization → billing → plan → features
  assert(
    await guantrDeep.can('export', ['report', { id: 1, type: 'financial', data: {} }]),
    'Deeply nested context path resolves: can export report',
  );

  /* ------------------------------------------------------------------ */
  /*  8f. Optional chaining in context ($ctx.contact?.address?.city)     */
  /* ------------------------------------------------------------------ */
  sub('Optional context paths — $ctx.contact?.address?.city');

  // With contact info present
  const guantrWithContact = await createGuantr<EnterpriseMeta>({
    getContext: () => buildEnterpriseContext(),
  });

  // ┌─────────────────────────────────────────────────────────────┐
  //  │  TYPE COMPLETION CHECKPOINT — optional chaining in $ctx.    │
  //  │                                                             │
  //  │  contact? is optional (contact?: {...}).                    │
  //  │  All paths through contact get ? because it may be absent: │
  //  │                                                             │
  //  │  $ctx.contact?.email               (string|undefined)      │
  // │  $ctx.contact?.phone               (string|undefined)      │
  // │  $ctx.contact?.address?.street     (string|undefined)      │
  // │  $ctx.contact?.address?.city       (string|undefined)      │
  // │  $ctx.contact?.address?.zip        (string|undefined)      │
  // │  $ctx.contact?.address?.country    (string|undefined)      │
  // │                                                             │
  // │  ✅ Optional top-level → ? on contact only                  │
  // │  ✅ address? is optional inside optional → double ?         │
  // │  ✅ phone is a leaf (not an object) → no trailing ?        │
  //  └─────────────────────────────────────────────────────────────┘
  await guantrWithContact.setRules([
    {
      effect: 'allow',
      action: 'view',
      resource: 'project',
      condition: {
        name: ['eq', 'Project Alpha'],
      },
    },
  ]);

  assert(
    await guantrWithContact.can('view', ['project', project]),
    'Optional context ($ctx.contact?.address?.city) resolves when contact exists',
  );

  // Without contact info
  const guantrNoContact = await createGuantr<EnterpriseMeta>({
    getContext: () => buildEnterpriseContext({ contact: undefined }),
  });

  await guantrNoContact.setRules([
    {
      effect: 'allow',
      action: 'view',
      resource: 'project',
      condition: {
        name: ['eq', 'Project Alpha'],
      },
    },
  ]);

  assert(
    await guantrNoContact.can('view', ['project', project]),
    'Optional context ($ctx.contact) resolves gracefully when absent',
  );

  /* ------------------------------------------------------------------ */
  /*  8g. Mixed: condition using both resource property and context       */
  /* ------------------------------------------------------------------ */
  sub('Mixed: resource property + deeply nested context');

  const guantrMixed = await createGuantr<EnterpriseMeta>({
    getContext: () => buildEnterpriseContext(),
  });

  await guantrMixed.setRules([
    {
      effect: 'allow',
      action: 'edit',
      resource: 'project',
      condition: {
        ownerId: ['eq', '$ctx.user.id'],
      },
    },
  ]);

  assert(
    await guantrMixed.can('edit', ['project', project]),
    'Mixed: ownerId matches $ctx.user.id',
  );

  assert(
    !(await guantrMixed.can('edit', ['project', { ...project, ownerId: 999 }])),
    'Mixed: ownerId 999 does not match $ctx.user.id (42)',
  );

  /* ------------------------------------------------------------------ */
  /*  8h. Deep nullable context as comparator                            */
  /* ------------------------------------------------------------------ */
  sub('Deep nullable $ctx. comparator — $ctx.organization?.billing.email');

  // ┌─────────────────────────────────────────────────────────────┐
  // │  TYPE COMPLETION CHECKPOINT — deep nullable comparator     │
  // │                                                             │
  // │  This rule compares a resource property directly against a  │
  // │  deeply nested nullable context path:                       │
  // │                                                             │
  // │    name: ['eq', '$ctx.organization?.billing.email']        │
  // │                                                             │
  // │  organization? → billing → email  (only org is nullable)   │
  // │                                                             │
  // │  When the context path resolves (org exists + email set),   │
  // │  the comparison uses the resolved value.                    │
  // │  When any intermediate node is null, the operand becomes    │
  // │  undefined and the comparison fails gracefully.             │
  // └─────────────────────────────────────────────────────────────┘

  // Instance with organization present
  const guantrDeepCtx = await createGuantr<EnterpriseMeta>({
    getContext: () => buildEnterpriseContext(),
  });

  await guantrDeepCtx.setRules([
    {
      effect: 'allow',
      action: 'view',
      resource: 'project',
      // Deep nullable context path as comparator:
      // $ctx.organization?.billing.email resolves to 'billing@acme.com'
      condition: {
        name: ['eq', '$ctx.organization?.billing.email'],
      },
    },
  ]);

  // project.name = 'Project Alpha', $ctx.organization?.billing.email = 'billing@acme.com'
  // They don't match → denied
  assert(
    !(await guantrDeepCtx.can('view', ['project', project])),
    'Deep nullable $ctx: name != org billing email → denied',
  );

  // Create a project whose name matches the billing email
  assert(
    await guantrDeepCtx.can('view', ['project', { ...project, name: 'billing@acme.com' }]),
    'Deep nullable $ctx: name matches org billing email → allowed',
  );

  // Instance with organization = null (user not in any org)
  const guantrDeepNull = await createGuantr<EnterpriseMeta>({
    getContext: () => buildEnterpriseContext({ organization: null }),
  });

  await guantrDeepNull.setRules([
    {
      effect: 'allow',
      action: 'view',
      resource: 'project',
      condition: {
        name: ['eq', '$ctx.organization?.billing.email'],
      },
    },
  ]);

  // organization is null, so $ctx.organization?.billing.email resolves to undefined
  // name comparison with undefined should fail gracefully
  assert(
    !(await guantrDeepNull.can('view', ['project', { ...project, name: 'billing@acme.com' }])),
    'Deep nullable $ctx: org=null → path resolves to undefined → comparison fails gracefully',
  );

  /* ------------------------------------------------------------------ */
  /*  Summary                                                             */
  /* ------------------------------------------------------------------ */
  info(
    'Complex nested context verified — nested objects, nullable paths, arrays, array of objects, deep nullable comparator.',
  );
}
