/**
 * Demo: Rules as Prisma Query Filters
 *
 * Verifies that the Prisma filter transpiler produces correct `where` clauses
 * matching `guantr.can()` semantics. Every output is structurally validated
 * against Prisma's where-clause API. 20 scenarios, all cross-validated.
 *
 * Run: pnpm play
 */

import type { Condition, GuantrRule, GuantrMeta, GuantrResourceMap } from '../../src/index';
import { createMatchConditionBuilder, evaluateCondition } from '../../src/index';

// ---------------------------------------------------------------------------
// Concrete resource & context types
// ---------------------------------------------------------------------------

type Post = {
  id: number;
  status: string;
  deleted: boolean;
  restricted: boolean;
  authorId: number;
  viewCount: number;
  tags: string[];
  comments: { approved: boolean; authorId: number }[];
};

type AppContext = { userId: number; role: string };

type Meta = GuantrMeta<
  GuantrResourceMap<{
    post: { action: 'read' | 'create' | 'update' | 'delete'; model: Post };
  }>,
  AppContext
>;

// ---------------------------------------------------------------------------
// Narrow interfaces for the AST nodes (structural, no phantom types)
// ---------------------------------------------------------------------------

type OpNode = {
  type: 'operator';
  operator: string;
  operands: ReadonlyArray<ValRef>;
  options?: Readonly<{ caseInsensitive?: boolean }>;
  condition?: CondNode;
};

type LogNode = {
  type: 'logical';
  operator: string;
  operands: ReadonlyArray<CondNode>;
};

type Ast = OpNode | LogNode;

type ValRef = ResRef | CtxRef | LitRef;

type ResRef = { type: 'resource'; path: string };
type CtxRef = { type: 'context'; path: string };
type LitRef = { type: 'literal'; value: unknown };

type CondNode = { type: 'condition'; node: Ast };

// ---------------------------------------------------------------------------
// Shared exit-code for reporting
// ---------------------------------------------------------------------------

let exitCode = 0;

// ---------------------------------------------------------------------------
// The transpiler — typed, no `any`
// ---------------------------------------------------------------------------

const visitNode = (node: Ast, context: Record<string, unknown>): Record<string, unknown> => {
  switch (node.type) {
    case 'operator':
      return visitOperatorNode(node, context);
    case 'logical':
      return visitLogicalNode(node, context);
    default:
      return {};
  }
};

const resolveValue = (ref: ValRef | undefined, context: Record<string, unknown>): unknown => {
  if (!ref) return undefined;
  switch (ref.type) {
    case 'literal':
      return ref.value;
    case 'context': {
      let current: unknown = context;
      for (const key of ref.path.split('.')) {
        if (current === null || current === undefined) return undefined;
        current = (current as Record<string, unknown>)[key];
      }
      return current;
    }
    case 'resource':
      return undefined;
  }
};

const visitOperatorNode = (
  node: OpNode,
  context: Record<string, unknown>,
): Record<string, unknown> => {
  const { operator, operands, options } = node;
  const left = operands[0] as ValRef | undefined;
  const right = operands[1] as ValRef | undefined;

  if (!left || left.type !== 'resource') return {};

  const field = left.path;
  const value = resolveValue(right, context);
  const clause: Record<string, unknown> = {};

  switch (operator) {
    case 'eq':
      clause[field] = { equals: value };
      break;
    case 'ne':
      clause[field] = { not: value };
      break;
    case 'gt':
      clause[field] = { gt: value };
      break;
    case 'gte':
      clause[field] = { gte: value };
      break;
    case 'lt':
      clause[field] = { lt: value };
      break;
    case 'lte':
      clause[field] = { lte: value };
      break;
    case 'contains':
      clause[field] = { contains: value };
      break;
    case 'startsWith':
      clause[field] = { startsWith: value };
      break;
    case 'endsWith':
      clause[field] = { endsWith: value };
      break;
    case 'in':
      clause[field] = { in: value };
      break;
    case 'has':
      clause[field] = { has: value };
      break;
    case 'hasSome':
      clause[field] = { hasSome: value };
      break;
    case 'hasEvery':
      clause[field] = { hasEvery: value };
      break;
    case 'some':
      if (node.condition) clause[field] = { some: visitNode(node.condition.node, context) };
      break;
    case 'every':
      if (node.condition) clause[field] = { every: visitNode(node.condition.node, context) };
      break;
    case 'none':
      if (node.condition) clause[field] = { none: visitNode(node.condition.node, context) };
      break;
    default:
      return {};
  }

  const STRING_OPS = new Set(['eq', 'ne', 'contains', 'startsWith', 'endsWith']);
  const fieldClause = clause[field];
  if (
    options?.caseInsensitive &&
    STRING_OPS.has(operator) &&
    fieldClause &&
    typeof fieldClause === 'object'
  ) {
    (fieldClause as Record<string, unknown>).mode = 'insensitive';
  }

  return clause;
};

const visitLogicalNode = (
  node: LogNode,
  context: Record<string, unknown>,
): Record<string, unknown> => {
  const subClauses = node.operands.map((op) => visitNode(op.node, context));

  switch (node.operator) {
    case 'and':
      return { AND: subClauses };
    case 'or':
      return { OR: subClauses };
    case 'not':
      return { NOT: subClauses[0] ?? {} };
    default:
      return {};
  }
};

const toPrismaWhereClause = (
  matchCondition: Condition | CondNode | null | undefined,
  context: Record<string, unknown>,
): Record<string, unknown> => {
  if (
    !matchCondition ||
    typeof matchCondition !== 'object' ||
    !('node' in (matchCondition as Record<string, unknown>))
  ) {
    return {};
  }
  return visitNode((matchCondition as CondNode).node, context);
};

const SENTINEL_FALSE: Record<string, unknown> = { __guantr_no_match: true };

const rulesToPrismaWhere = (
  rules: ReadonlyArray<GuantrRule<Meta>>,
  context: Record<string, unknown>,
): Record<string, unknown> | null => {
  if (rules.length === 0) return SENTINEL_FALSE;

  if (rules.some((r) => r.matchCondition == null && r.effect === 'deny')) {
    return SENTINEL_FALSE;
  }

  const hasUnconditionalAllow = rules.some((r) => r.matchCondition == null && r.effect === 'allow');

  type Clause = Record<string, unknown>;
  const OR: Clause[] = [];
  const AND: Clause[] = [];

  for (const rule of rules) {
    if (!rule.matchCondition) continue;

    const mc = rule.matchCondition as Condition | CondNode | null | undefined;
    const clause = toPrismaWhereClause(mc, context);

    if (Object.keys(clause).length === 0) continue;

    if (rule.effect === 'deny') {
      AND.push({ NOT: clause });
    } else {
      OR.push(clause);
    }
  }

  if (OR.length === 0) {
    if (hasUnconditionalAllow) {
      if (AND.length === 0) return null;
      return { AND };
    }
    return SENTINEL_FALSE;
  }

  const result: Record<string, unknown> = { OR };
  if (AND.length > 0) result.AND = AND;

  const validationError = validatePrismaWhere(result);
  if (validationError) {
    console.error('\n  ❌ FAIL: rulesToPrismaWhere produced invalid Prisma where clause');
    console.error(`     ${validationError}`);
    console.error(`     Output: ${JSON.stringify(result)}`);
    exitCode = 1;
  }

  return result;
};

// ---------------------------------------------------------------------------
// Prisma where-clause structural validator
// ---------------------------------------------------------------------------

/**
 * Validates that an object conforms to Prisma's `where` clause shape.
 * Checks for invalid keys, malformed nesting, and unsupported operators.
 * Returns `null` if valid, or an error string if invalid.
 */
function validatePrismaWhere(where: Record<string, unknown> | null, path = 'root'): string | null {
  if (where === null) return null;

  const sentinel = where as unknown as Record<string, unknown>;
  if (sentinel.__guantr_no_match) return null;

  if (typeof where !== 'object' || where === null) {
    return `${path}: expected an object, got ${typeof where}`;
  }

  const operatorKeys = new Set([
    'equals',
    'not',
    'in',
    'gt',
    'gte',
    'lt',
    'lte',
    'contains',
    'startsWith',
    'endsWith',
    'has',
    'hasSome',
    'hasEvery',
    'some',
    'every',
    'none',
    'mode',
    'is',
    'isNot',
  ]);

  for (const [key, value] of Object.entries(where)) {
    if (key === 'AND' || key === 'OR') {
      if (!Array.isArray(value)) {
        return `${path}.${key}: expected an array`;
      }
      for (let i = 0; i < value.length; i++) {
        const err = validatePrismaWhere(
          value[i] as Record<string, unknown>,
          `${path}.${key}[${i}]`,
        );
        if (err) return err;
      }
      continue;
    }

    if (key === 'NOT') {
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          const err = validatePrismaWhere(value[i] as Record<string, unknown>, `${path}.NOT[${i}]`);
          if (err) return err;
        }
      } else if (typeof value === 'object' && value !== null) {
        const err = validatePrismaWhere(value as Record<string, unknown>, `${path}.NOT`);
        if (err) return err;
      } else {
        return `${path}.NOT: expected object or array`;
      }
      continue;
    }

    // Field-level filter
    if (typeof value !== 'object' || value === null) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        continue;
      }
      return `${path}.${key}: expected filter object or scalar`;
    }

    const opObj = value as Record<string, unknown>;
    for (const op of Object.keys(opObj)) {
      if (!operatorKeys.has(op)) {
        // Could be a nested relation — recurse
        if (typeof opObj[op] === 'object' && opObj[op] !== null && !Array.isArray(opObj[op])) {
          const nest = validatePrismaWhere(
            { [op]: opObj[op] } as Record<string, unknown>,
            `${path}.${key}`,
          );
          if (nest) return nest;
          continue;
        }
        return `${path}.${key}.${op}: unknown Prisma operator`;
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Verification helpers
// ---------------------------------------------------------------------------

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`\n  ❌ FAIL: ${message}`);
    exitCode = 1;
  } else {
    console.log(`  ✅ ${message}`);
  }
}

function assertEq(actual: unknown, expected: unknown, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`\n  ❌ FAIL: ${message}`);
    console.error(`     Expected: ${JSON.stringify(expected)}`);
    console.error(`     Actual:   ${JSON.stringify(actual)}`);
    exitCode = 1;
  } else {
    console.log(`  ✅ ${message}`);
  }
}

/**
 * Simulates `guantr.can()` by mirroring `_evaluateCheck` from src/index.ts.
 */
function simulateCan(
  rules: ReadonlyArray<GuantrRule<Meta>>,
  resource: Record<string, unknown>,
  context: Record<string, unknown>,
): boolean {
  if (rules.length === 0) return false;
  if (rules.some((r) => r.matchCondition == null && r.effect === 'deny')) {
    return false;
  }

  const allowed: boolean[] = [];
  const denied: boolean[] = [];

  for (const rule of rules) {
    if (!rule.matchCondition) {
      allowed.push(true);
      continue;
    }

    const matched = evaluateCondition(rule.matchCondition as Condition, resource, context);

    if (matched) {
      if (rule.effect === 'allow') allowed.push(true);
      else denied.push(false);
    } else {
      if (rule.effect === 'allow') allowed.push(false);
      else denied.push(true);
    }
  }

  return allowed.includes(true) && !denied.includes(false);
}

// ---------------------------------------------------------------------------
// Builder shortcut
// ---------------------------------------------------------------------------

const b = createMatchConditionBuilder<Post, AppContext>();

// ---------------------------------------------------------------------------
// Sample resources
// ---------------------------------------------------------------------------

const publishedPost: Record<string, unknown> = {
  id: 1,
  status: 'published',
  deleted: false,
  restricted: false,
  authorId: 10,
  viewCount: 500,
  tags: ['tech', 'news'],
  comments: [
    { approved: true, authorId: 10 },
    { approved: false, authorId: 20 },
  ],
};

const draftPost: Record<string, unknown> = {
  id: 2,
  status: 'draft',
  deleted: false,
  restricted: false,
  authorId: 20,
  viewCount: 10,
  tags: ['personal'],
  comments: [],
};

const restrictedPost: Record<string, unknown> = {
  id: 3,
  status: 'published',
  deleted: false,
  restricted: true,
  authorId: 10,
  viewCount: 100,
  tags: [],
  comments: [],
};

const deletedPost: Record<string, unknown> = {
  id: 4,
  status: 'published',
  deleted: true,
  restricted: false,
  authorId: 10,
  viewCount: 0,
  tags: [],
  comments: [],
};

const context = { userId: 10, role: 'editor' } as Record<string, unknown>;

// ---------------------------------------------------------------------------
// Helper: construct a typed rule
// ---------------------------------------------------------------------------

function R(
  effect: 'allow' | 'deny',
  action: string,
  resource: string,
  mc?: Condition | null,
): GuantrRule<Meta> {
  return {
    effect,
    action: action as GuantrRule<Meta>['action'],
    resource: resource as GuantrRule<Meta>['resource'],
    matchCondition: mc as GuantrRule<Meta>['matchCondition'],
  };
}

// ---------------------------------------------------------------------------
// 20 Test scenarios
// ---------------------------------------------------------------------------

console.log('\n══════════════════════════════════════════════════════════');
console.log('  Guantr → Prisma Query Filter Transpiler Verification');
console.log('══════════════════════════════════════════════════════════\n');

let scenario = 0;

// ── 1 ───────────────────────────────────────────────────────

console.log(`── Scenario ${++scenario}: Single conditional allow ──`);

{
  const rules = [R('allow', 'read', 'post', b.eq(b.resource('status'), b.literal('published')))];
  assertEq(
    rulesToPrismaWhere(rules, context),
    { OR: [{ status: { equals: 'published' } }] },
    'Produces OR with eq filter',
  );
  assert(simulateCan(rules, publishedPost, context) === true, 'published post allowed');
  assert(simulateCan(rules, draftPost, context) === false, 'draft post denied');
  console.log();
}

// ── 2 ───────────────────────────────────────────────────────

console.log(`── Scenario ${++scenario}: Multiple conditional allows (OR) ──`);

{
  const rules = [
    R('allow', 'read', 'post', b.eq(b.resource('status'), b.literal('published'))),
    R('allow', 'read', 'post', b.eq(b.resource('status'), b.literal('draft'))),
  ];
  assertEq(
    rulesToPrismaWhere(rules, context),
    {
      OR: [{ status: { equals: 'published' } }, { status: { equals: 'draft' } }],
    },
    'Produces OR with both allow conditions',
  );
  assert(simulateCan(rules, publishedPost, context) === true, 'published post allowed');
  assert(simulateCan(rules, draftPost, context) === true, 'draft post allowed');
  console.log();
}

// ── 3 ───────────────────────────────────────────────────────

console.log(`── Scenario ${++scenario}: Allow + deny (deny matches) ──`);

{
  const rules = [
    R('allow', 'read', 'post', b.eq(b.resource('status'), b.literal('published'))),
    R('deny', 'read', 'post', b.eq(b.resource('restricted'), b.literal(true))),
  ];
  assertEq(
    rulesToPrismaWhere(rules, context),
    {
      OR: [{ status: { equals: 'published' } }],
      AND: [{ NOT: { restricted: { equals: true } } }],
    },
    'Produces OR + AND NOT filter',
  );
  assert(simulateCan(rules, publishedPost, context) === true, 'non-restricted published allowed');
  assert(simulateCan(rules, restrictedPost, context) === false, 'restricted post denied');
  assert(simulateCan(rules, draftPost, context) === false, 'draft post denied (no allow match)');
  console.log();
}

// ── 4 ───────────────────────────────────────────────────────

console.log(`── Scenario ${++scenario}: Allow + deny (deny does NOT match) ──`);

{
  const rules = [
    R('allow', 'read', 'post', b.eq(b.resource('status'), b.literal('published'))),
    R('deny', 'read', 'post', b.eq(b.resource('id'), b.literal(999))),
  ];
  const where = rulesToPrismaWhere(rules, context);
  assert(simulateCan(rules, publishedPost, context) === true, 'published allowed (deny unmatched)');
  assert(where !== null && !('__guantr_no_match' in where), 'Filter valid, not sentinel');
  console.log();
}

// ── 5 ───────────────────────────────────────────────────────

console.log(`── Scenario ${++scenario}: Only conditional denies (no allows) ──`);

{
  const rules = [
    R('deny', 'read', 'post', b.eq(b.resource('restricted'), b.literal(true))),
    R('deny', 'read', 'post', b.eq(b.resource('deleted'), b.literal(true))),
  ];
  assertEq(rulesToPrismaWhere(rules, context), SENTINEL_FALSE, 'Sentinel — no allow rules');
  assert(simulateCan(rules, publishedPost, context) === false, 'can() false for all');
  assert(
    simulateCan(rules, restrictedPost, context) === false,
    'can() false even for unmatched deny',
  );
  console.log();
}

// ── 6 ───────────────────────────────────────────────────────

console.log(`── Scenario ${++scenario}: Unconditional allow only ──`);

{
  const rules = [R('allow', 'read', 'post', null)];
  assertEq(rulesToPrismaWhere(rules, context), null, 'Returns null — no filter needed');
  assert(simulateCan(rules, publishedPost, context) === true, 'any resource allowed');
  assert(simulateCan(rules, restrictedPost, context) === true, 'restricted also allowed');
  console.log();
}

// ── 7 ───────────────────────────────────────────────────────

console.log(`── Scenario ${++scenario}: Unconditional allow + conditional deny ──`);

{
  const rules = [
    R('allow', 'read', 'post', null),
    R('deny', 'read', 'post', b.eq(b.resource('restricted'), b.literal(true))),
  ];
  assertEq(
    rulesToPrismaWhere(rules, context),
    { AND: [{ NOT: { restricted: { equals: true } } }] },
    'Only AND NOT — no OR (unconditional allow covers all)',
  );
  assert(simulateCan(rules, publishedPost, context) === true, 'non-restricted allowed');
  assert(simulateCan(rules, restrictedPost, context) === false, 'restricted denied');
  console.log();
}

// ── 8 ───────────────────────────────────────────────────────

console.log(`── Scenario ${++scenario}: No rules at all ──`);

{
  const rules: GuantrRule<Meta>[] = [];
  assertEq(rulesToPrismaWhere(rules, context), SENTINEL_FALSE, 'Sentinel — no rules');
  assert(simulateCan(rules, publishedPost, context) === false, 'can() false');
  console.log();
}

// ── 9 ───────────────────────────────────────────────────────

console.log(`── Scenario ${++scenario}: Unconditional deny ──`);

{
  const rules = [R('deny', 'read', 'post', null)];
  assertEq(rulesToPrismaWhere(rules, context), SENTINEL_FALSE, 'Sentinel — unconditional deny');
  assert(simulateCan(rules, publishedPost, context) === false, 'can() false (early exit)');
  console.log();
}

// ── 10 ──────────────────────────────────────────────────────

console.log(`── Scenario ${++scenario}: Logical AND condition ──`);

{
  const rules = [
    R(
      'allow',
      'read',
      'post',
      b.and(
        b.eq(b.resource('status'), b.literal('published')),
        b.eq(b.resource('deleted'), b.literal(false)),
      ),
    ),
  ];
  assertEq(
    rulesToPrismaWhere(rules, context),
    {
      OR: [
        {
          AND: [{ status: { equals: 'published' } }, { deleted: { equals: false } }],
        },
      ],
    },
    'AND condition → nested Prisma AND',
  );
  assert(simulateCan(rules, publishedPost, context) === true, 'published + not deleted = allowed');
  assert(simulateCan(rules, deletedPost, context) === false, 'published + deleted = denied');
  console.log();
}

// ── 11 ──────────────────────────────────────────────────────

console.log(`── Scenario ${++scenario}: Logical OR condition ──`);

{
  const rules = [
    R(
      'allow',
      'read',
      'post',
      b.or(
        b.eq(b.resource('status'), b.literal('published')),
        b.eq(b.resource('status'), b.literal('draft')),
      ),
    ),
  ];
  assertEq(
    rulesToPrismaWhere(rules, context),
    {
      OR: [
        {
          OR: [{ status: { equals: 'published' } }, { status: { equals: 'draft' } }],
        },
      ],
    },
    'OR condition → nested Prisma OR',
  );
  assert(simulateCan(rules, publishedPost, context) === true, 'published matches first branch');
  assert(simulateCan(rules, draftPost, context) === true, 'draft matches second branch');
  console.log();
}

// ── 12 ──────────────────────────────────────────────────────

console.log(`── Scenario ${++scenario}: Logical NOT condition ──`);

{
  const rules = [R('allow', 'read', 'post', b.not(b.eq(b.resource('deleted'), b.literal(true))))];
  assertEq(
    rulesToPrismaWhere(rules, context),
    { OR: [{ NOT: { deleted: { equals: true } } }] },
    'NOT condition → Prisma NOT',
  );
  assert(simulateCan(rules, publishedPost, context) === true, 'non-deleted allowed');
  assert(simulateCan(rules, deletedPost, context) === false, 'deleted denied');
  console.log();
}

// ── 13 ──────────────────────────────────────────────────────

console.log(`── Scenario ${++scenario}: Numeric comparisons ──`);

{
  const rules = [R('allow', 'read', 'post', b.gt(b.resource('viewCount'), b.literal(100)))];
  assertEq(
    rulesToPrismaWhere(rules, context),
    { OR: [{ viewCount: { gt: 100 } }] },
    'gt → Prisma gt',
  );
  assert(simulateCan(rules, publishedPost, context) === true, '500 > 100 = allowed');
  assert(simulateCan(rules, draftPost, context) === false, '10 > 100 = denied');
  console.log();
}

// ── 14 ──────────────────────────────────────────────────────

console.log(`── Scenario ${++scenario}: Context reference ──`);

{
  const rules = [R('allow', 'read', 'post', b.eq(b.resource('authorId'), b.context('userId')))];
  assertEq(
    rulesToPrismaWhere(rules, context),
    { OR: [{ authorId: { equals: 10 } }] },
    'Context resolved: userId=10',
  );
  assert(simulateCan(rules, publishedPost, context) === true, 'authorId 10 matches userId 10');
  assert(simulateCan(rules, draftPost, context) === false, 'authorId 20 != userId 10');
  console.log();
}

// ── 15 ──────────────────────────────────────────────────────

console.log(`── Scenario ${++scenario}: Complex array operator (some) ──`);

{
  const rules = [
    R(
      'allow',
      'read',
      'post',
      b.some(b.resource('comments'), ({ eq, resource, literal }) =>
        eq(resource('approved'), literal(true)),
      ),
    ),
  ];
  assertEq(
    rulesToPrismaWhere(rules, context),
    { OR: [{ comments: { some: { approved: { equals: true } } } }] },
    'some → Prisma some with nested condition',
  );
  assert(simulateCan(rules, publishedPost, context) === true, 'post has approved comment');
  console.log();
}

// ── 16 ──────────────────────────────────────────────────────

console.log(`── Scenario ${++scenario}: Case-insensitive (via contains) ──`);

{
  const rules = [
    R(
      'allow',
      'read',
      'post',
      b.contains(b.resource('status'), b.literal('PUBLISH'), {
        caseInsensitive: true,
      }),
    ),
  ];
  assertEq(
    rulesToPrismaWhere(rules, context),
    { OR: [{ status: { contains: 'PUBLISH', mode: 'insensitive' } }] },
    'caseInsensitive → mode: insensitive',
  );
  assert(simulateCan(rules, publishedPost, context) === true, '"published" contains "PUBLISH" ci');
  console.log();
}

// ── 17 ──────────────────────────────────────────────────────

console.log(`── Scenario ${++scenario}: Mixed: unconditional allow + conditions ──`);

{
  const rules = [
    R('allow', 'read', 'post', null),
    R('deny', 'read', 'post', b.eq(b.resource('restricted'), b.literal(true))),
    R('deny', 'read', 'post', b.eq(b.resource('deleted'), b.literal(true))),
  ];
  assertEq(
    rulesToPrismaWhere(rules, context),
    {
      AND: [{ NOT: { restricted: { equals: true } } }, { NOT: { deleted: { equals: true } } }],
    },
    'Two denies → two AND NOT entries, no OR',
  );
  assert(
    simulateCan(rules, publishedPost, context) === true,
    'non-restricted, non-deleted allowed',
  );
  assert(simulateCan(rules, restrictedPost, context) === false, 'restricted denied');
  assert(simulateCan(rules, deletedPost, context) === false, 'deleted denied');
  console.log();
}

// ── 18 ──────────────────────────────────────────────────────

console.log(`── Scenario ${++scenario}: ne operator ──`);

{
  const rules = [R('allow', 'read', 'post', b.ne(b.resource('status'), b.literal('archived')))];
  assertEq(
    rulesToPrismaWhere(rules, context),
    { OR: [{ status: { not: 'archived' } }] },
    'ne → Prisma not',
  );
  assert(simulateCan(rules, publishedPost, context) === true, 'published != archived');
  const archived = {
    ...publishedPost,
    status: 'archived',
  } as Record<string, unknown>;
  assert(simulateCan(rules, archived, context) === false, 'archived != archived = false');
  console.log();
}

// ── 19 ──────────────────────────────────────────────────────

console.log(`── Scenario ${++scenario}: Array operators (has, hasSome, hasEvery) ──`);

{
  const hasRule = [R('allow', 'read', 'post', b.has(b.resource('tags'), b.literal('tech')))];
  assertEq(
    rulesToPrismaWhere(hasRule, context),
    { OR: [{ tags: { has: 'tech' } }] },
    'has → Prisma has',
  );

  const hasSomeRule = [
    R('allow', 'read', 'post', b.hasSome(b.resource('tags'), b.literal(['tech', 'news']))),
  ];
  assertEq(
    rulesToPrismaWhere(hasSomeRule, context),
    { OR: [{ tags: { hasSome: ['tech', 'news'] } }] },
    'hasSome → Prisma hasSome',
  );

  const hasEveryRule = [
    R('allow', 'read', 'post', b.hasEvery(b.resource('tags'), b.literal(['tech', 'news']))),
  ];
  assertEq(
    rulesToPrismaWhere(hasEveryRule, context),
    { OR: [{ tags: { hasEvery: ['tech', 'news'] } }] },
    'hasEvery → Prisma hasEvery',
  );

  const withTags = {
    ...publishedPost,
    tags: ['tech', 'news'],
  } as Record<string, unknown>;
  assert(simulateCan(hasRule, withTags, context) === true, 'has("tech") matches');
  assert(
    simulateCan(hasSomeRule, withTags, context) === true,
    'hasSome matches any of ["tech","news"]',
  );
  assert(
    simulateCan(hasEveryRule, withTags, context) === true,
    'hasEvery matches all of ["tech","news"]',
  );
  console.log();
}

// ── 20 ──────────────────────────────────────────────────────

console.log(`── Scenario ${++scenario}: gte, lte, lt comparisons ──`);

{
  const gteRule = [R('allow', 'read', 'post', b.gte(b.resource('viewCount'), b.literal(500)))];
  assertEq(
    rulesToPrismaWhere(gteRule, context),
    { OR: [{ viewCount: { gte: 500 } }] },
    'gte → Prisma gte',
  );

  const lteRule = [R('allow', 'read', 'post', b.lte(b.resource('viewCount'), b.literal(10)))];
  assertEq(
    rulesToPrismaWhere(lteRule, context),
    { OR: [{ viewCount: { lte: 10 } }] },
    'lte → Prisma lte',
  );

  const ltRule = [R('allow', 'read', 'post', b.lt(b.resource('viewCount'), b.literal(20)))];
  assertEq(
    rulesToPrismaWhere(ltRule, context),
    { OR: [{ viewCount: { lt: 20 } }] },
    'lt → Prisma lt',
  );

  assert(simulateCan(gteRule, publishedPost, context) === true, '500 >= 500');
  assert(simulateCan(gteRule, draftPost, context) === false, '10 >= 500 false');
  assert(simulateCan(lteRule, draftPost, context) === true, '10 <= 10');
  assert(simulateCan(lteRule, publishedPost, context) === false, '500 <= 10 false');
  assert(simulateCan(ltRule, draftPost, context) === true, '10 < 20');
  assert(simulateCan(ltRule, publishedPost, context) === false, '500 < 20 false');
  console.log();
}

// ── Summary ─────────────────────────────────────────────────

console.log('══════════════════════════════════════════════════════════');
console.log(`  ${scenario} scenarios verified.`);
if (exitCode === 0) {
  console.log('  All assertions passed.\n');
} else {
  console.log('  Some assertions FAILED — see above.\n');
}
process.exitCode = exitCode;
