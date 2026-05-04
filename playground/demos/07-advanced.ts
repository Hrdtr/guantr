/**
 * Demo 7: Advanced Real-World Scenarios
 * ======================================
 *
 * Covers:
 *   - Full RBAC (Role-Based Access Control) with admin, editor, viewer roles
 *   - Multi-tenant isolation
 *   - Content moderation workflow
 *   - Complex nested conditions with depth 3+
 *   - Condition validation errors
 *   - Utility function exports (isContextualOperand, isConditionExpressionLike)
 */

import type { Post, BlogContext } from '../utils';
import {
  createGuantr,
  GuantrMeta,
  GuantrResourceMap,
  GuantrCircuitBreakerError,
  GuantrInvalidConditionError,
  GuantrInvalidConditionOperatorError,
  matchRuleCondition,
  isConditionExpressionLike,
  isContextualOperand,
} from '../../src/index';
import { heading, sub, assert, info } from '../utils';
import { publishedPost, draftPost } from '../utils';

/* ================================================================== */
/*  SCENARIO A: Full Blog RBAC                                          */
/* ================================================================== */

type RbacResourceMap = GuantrResourceMap<{
  post: { action: 'create' | 'read' | 'update' | 'delete' | 'publish'; model: Post };
}>;

type RbacMeta = GuantrMeta<RbacResourceMap, BlogContext>;

async function scenarioRBAC(): Promise<void> {
  sub('Scenario A: Blog RBAC (admin vs editor vs viewer)');

  async function buildGuantr(ctx: BlogContext) {
    const g = await createGuantr<RbacMeta>({ getContext: () => ctx });

    await g.setRules([
      // ── Level 1: Base permissions (everyone) ──
      {
        effect: 'allow',
        action: 'read',
        resource: 'post',
        condition: { status: ['eq', 'published'] },
      },
      { effect: 'allow', action: 'create', resource: 'post', condition: null },

      // ── Level 2: Editor permissions ──
      {
        effect: 'allow',
        action: 'publish',
        resource: 'post',
        condition: { status: ['eq', 'published'] },
      },
      { effect: 'allow', action: 'update', resource: 'post', condition: null },

      // ── Level 3: Admin permissions (overrides) ──
      {
        effect: 'allow',
        action: 'delete',
        resource: 'post',
        condition: { authorId: ['eq', '$ctx.userId'] },
      },

      // ── Deny rules (always win) ──
      {
        effect: 'deny',
        action: 'delete',
        resource: 'post',
        condition: { status: ['eq', 'published'] },
      },
      {
        effect: 'deny',
        action: 'publish',
        resource: 'post',
        condition: { status: ['eq', 'draft'] },
      },
    ]);

    return g;
  }

  const admins = await buildGuantr({ userId: 1, userRole: 'admin', isAuthenticated: true });
  const editors = await buildGuantr({ userId: 2, userRole: 'editor', isAuthenticated: true });

  const pub = publishedPost();
  const draft = draftPost();

  // Admin assertions
  assert(await admins.can('read', ['post', pub]), 'RBAC: admin can read published');
  assert(await admins.can('create', ['post', draft]), 'RBAC: admin can create');
  assert(
    !(await admins.can('delete', ['post', pub])),
    'RBAC: admin cannot delete published (deny override)',
  );
  assert(await admins.can('publish', ['post', pub]), 'RBAC: admin can publish published');

  // Editor assertions
  assert(await editors.can('read', ['post', pub]), 'RBAC: editor can read published');
  assert(await editors.can('publish', ['post', pub]), 'RBAC: editor can publish');
  assert(!(await editors.can('delete', ['post', pub])), 'RBAC: editor cannot delete published');
}

/* ================================================================== */
/*  SCENARIO B: Multi-Tenant CMS                                        */
/* ================================================================== */

type TenantContext = {
  userId: number;
  tenantId: number;
  role: 'owner' | 'admin' | 'member';
};

type TenantResourceMap = GuantrResourceMap<{
  project: {
    action: 'read' | 'update' | 'delete' | 'invite';
    model: {
      id: number;
      tenantId: number;
      name: string;
      ownerId: number;
      members: Array<{ userId: number; role: string }>;
    };
  };
  document: {
    action: 'read' | 'create' | 'update' | 'delete';
    model: { id: number; projectId: number; title: string; content: string; createdBy: number };
  };
}>;

type TenantMeta = GuantrMeta<TenantResourceMap, TenantContext>;

async function scenarioMultiTenant(): Promise<void> {
  sub('Scenario B: Multi-Tenant CMS');

  const guantr = await createGuantr<TenantMeta>({
    getContext: () => ({ userId: 1, tenantId: 5, role: 'owner' }),
  });

  await guantr.setRules([
    // Tenant isolation: users can only access projects in their tenant
    {
      effect: 'allow',
      action: 'read',
      resource: 'project',
      condition: { tenantId: ['eq', '$ctx.tenantId'] },
    },
    // Owner can delete own project
    {
      effect: 'allow',
      action: 'delete',
      resource: 'project',
      condition: { ownerId: ['eq', '$ctx.userId'], tenantId: ['eq', '$ctx.tenantId'] },
    },
    // Members can read documents in tenant projects
    { effect: 'allow', action: 'read', resource: 'document', condition: null },
  ]);

  const myProject = { id: 1, tenantId: 5, name: 'My Project', ownerId: 1, members: [] };
  const otherProject = { id: 2, tenantId: 99, name: 'Other', ownerId: 2, members: [] };

  assert(
    await guantr.can('read', ['project', myProject]),
    'Multi-tenant: user can read project in their tenant',
  );
  assert(
    !(await guantr.can('read', ['project', otherProject])),
    'Multi-tenant: user cannot read other tenant project',
  );
  assert(
    await guantr.can('delete', ['project', myProject]),
    'Multi-tenant: owner can delete own project',
  );
}

/* ================================================================== */
/*  SCENARIO C: Content Moderation                                      */
/* ================================================================== */

type ModContext = {
  moderatorId: number;
  canDelete: boolean;
};

type ModResourceMap = GuantrResourceMap<{
  comment: {
    action: 'read' | 'approve' | 'reject' | 'delete';
    model: {
      id: number;
      text: string;
      flagged: boolean;
      reports: number;
      authorReputation: number;
      tags: string[];
    };
  };
}>;

type ModMeta = GuantrMeta<ModResourceMap, ModContext>;

async function scenarioModeration(): Promise<void> {
  sub('Scenario C: Content Moderation');

  const guantr = await createGuantr<ModMeta>({
    getContext: () => ({ moderatorId: 1, canDelete: true }),
  });

  await guantr.setRules([
    // Auto-approve trusted authors
    {
      effect: 'allow',
      action: 'approve',
      resource: 'comment',
      condition: { authorReputation: ['gte', 100] },
    },
    // Flagged comments with high reports need review
    {
      effect: 'allow',
      action: 'read',
      resource: 'comment',
      condition: { flagged: ['eq', true], reports: ['gte', 3] },
    },
    // Delete only if allowed by context and comment is flagged
    {
      effect: 'allow',
      action: 'delete',
      resource: 'comment',
      condition: { flagged: ['eq', true], tags: ['has', 'spam'] },
    },
    // Deny approving high-report comments
    { effect: 'deny', action: 'approve', resource: 'comment', condition: { reports: ['gte', 10] } },
  ]);

  const spamComment = {
    id: 1,
    text: 'Buy now!',
    flagged: true,
    reports: 5,
    authorReputation: 1,
    tags: ['spam', 'promo'],
  };
  const trustedComment = {
    id: 2,
    text: 'Great article',
    flagged: false,
    reports: 0,
    authorReputation: 200,
    tags: [],
  };

  assert(
    await guantr.can('read', ['comment', spamComment]),
    'Moderation: can read flagged+reported comment',
  );
  assert(
    await guantr.can('approve', ['comment', trustedComment]),
    'Moderation: can auto-approve trusted author',
  );
  assert(
    !(await guantr.can('approve', ['comment', spamComment])),
    'Moderation: cannot approve reported+flagged comment',
  );
  assert(
    await guantr.can('delete', ['comment', spamComment]),
    'Moderation: can delete spam comment',
  );
}

/* ================================================================== */
/*  SCENARIO D: Complex Nested Conditions (Depth 3+)                    */
/* ================================================================== */

async function scenarioDeepNested(): Promise<void> {
  sub('Scenario D: Deeply nested conditions (depth 3+)');

  const deepModel = {
    level1: {
      level2: {
        level3: {
          value: 'deeply-nested',
          numbers: [1, 2, 3],
        },
      },
    },
  };

  assert(
    matchRuleCondition(deepModel, {
      level1: { level2: { level3: { value: ['eq', 'deeply-nested'] } } },
    }),
    '3-level deep nested condition matches',
  );

  assert(
    !matchRuleCondition(deepModel, {
      level1: { level2: { level3: { value: ['eq', 'wrong'] } } },
    }),
    '3-level deep nested condition rejects wrong value',
  );

  // Deep $expr
  assert(
    matchRuleCondition(deepModel, {
      level1: { level2: { level3: { numbers: { $expr: ['has', 2], length: ['gte', 2] } } } },
    }),
    '3-level deep $expr combined with length check',
  );

  // Mixed: some with deep nesting
  const nestedSome = {
    departments: [
      {
        name: 'engineering',
        teams: [
          { name: 'frontend', members: [{ id: 1, skills: ['ts', 'react'] }] },
          { name: 'backend', members: [{ id: 2, skills: ['ts', 'node'] }] },
        ],
      },
    ],
  };

  assert(
    matchRuleCondition(nestedSome, {
      departments: [
        'some',
        {
          name: ['eq', 'engineering'],
          teams: [
            'some',
            {
              name: ['eq', 'frontend'],
              members: ['some', { skills: ['has', 'react'] }],
            },
          ],
        },
      ],
    }),
    '4-level nested some: engineering > frontend > member with react skill',
  );
}

/* ================================================================== */
/*  SCENARIO E: Utility Exports                                         */
/* ================================================================== */

async function scenarioUtilities(): Promise<void> {
  sub('Scenario E: Exported utilities');

  // isConditionExpressionLike
  assert(isConditionExpressionLike(['eq', 'val']), 'isConditionExpressionLike: detects valid expr');
  assert(isConditionExpressionLike(['in', ['a', 'b']]), 'isConditionExpressionLike: array operand');
  assert(!isConditionExpressionLike('not array'), 'isConditionExpressionLike: rejects non-array');
  assert(!isConditionExpressionLike(['only']), 'isConditionExpressionLike: rejects short array');
  assert(
    !isConditionExpressionLike([1, 'val']),
    'isConditionExpressionLike: rejects non-string operator',
  );

  // isContextualOperand
  assert(isContextualOperand('$ctx.userId'), 'isContextualOperand: detects $ctx prefix');
  assert(
    isContextualOperand('$ctx.deeply.nested.value'),
    'isContextualOperand: detects nested $ctx path',
  );
  assert(!isContextualOperand('userId'), 'isContextualOperand: rejects non-$ctx string');
  // Intentionally passing a non-string to test runtime branch
  assert(!isContextualOperand(42 as unknown as string), 'isContextualOperand: rejects non-string');

  // Error classes
  const cbError = new GuantrCircuitBreakerError('read', 'post', 100);
  assert(cbError.action === 'read', 'GuantrCircuitBreakerError: action');
  assert(cbError.resource === 'post', 'GuantrCircuitBreakerError: resource');
  assert(cbError.limit === 100, 'GuantrCircuitBreakerError: limit');

  const icError = new GuantrInvalidConditionError({ bad: 'value' }, 'test reason');
  assert(icError.reason === 'test reason', 'GuantrInvalidConditionError: reason');

  const icoError = new GuantrInvalidConditionOperatorError('badOp');
  assert(icoError.operator === 'badOp', 'GuantrInvalidConditionOperatorError: operator');
}

/* ================================================================== */
/*  Main                                                                */
/* ================================================================== */

export async function demoAdvanced(): Promise<void> {
  heading('7. Advanced Real-World Scenarios');

  await scenarioRBAC();
  await scenarioMultiTenant();
  await scenarioModeration();
  await scenarioDeepNested();
  await scenarioUtilities();

  info('All advanced scenarios completed.');
}
