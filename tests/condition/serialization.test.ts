import type { Condition, OperatorNode } from '../../src/index';
/**
 * Task 8 — Tests for matchCondition serialization.
 *
 * Verifies:
 * 1. matchCondition functions are executed and replaced with Condition objects in setRules
 * 2. Simple condition serializes correctly with correct AST structure
 * 3. Nested conditions (and/or/not) preserve full AST structure
 * 4. Value refs serialize with correct type metadata (resource, context, literal)
 * 5. Complex array operators (some/every/none) with nested conditions serialize correctly
 * 6. Round-trip: serialize → deserialize produces equivalent structure
 * 7. Context refs serialize as { type: 'context', path: '...' }
 * 8. Serialized Condition is valid JSON
 * 9. Rules with both condition and matchCondition coexist
 * 10. MatchCondition function in callback form setRules is processed
 */
import { describe, it, expect } from 'vitest';
import {
  createGuantr,
  GuantrMeta,
  GuantrResourceMap,
  createMatchConditionBuilder,
} from '../../src/index';

// ---------------------------------------------------------------------------
// Sample types
// ---------------------------------------------------------------------------

type Post = {
  id: number;
  title: string;
  status: string;
  published: boolean;
  viewCount: number;
  tags: string[];
  comments: { approved: boolean; body: string }[];
};

type AppContext = {
  userId: number;
  role: string;
};

type ResourceMap = GuantrResourceMap<{
  post: {
    action: 'read' | 'create' | 'update' | 'delete';
    model: Post;
  };
}>;

type Meta = GuantrMeta<ResourceMap, AppContext>;

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function builder() {
  return createMatchConditionBuilder<Post, AppContext>();
}

// ---------------------------------------------------------------------------
// 1. Simple condition serialization via setRules (array form)
// ---------------------------------------------------------------------------

describe('matchCondition serialization — simple', () => {
  it('setRules executes matchCondition function and stores Condition', async () => {
    const guantr = await createGuantr<Meta>();

    await guantr.setRules([
      {
        resource: 'post',
        action: 'read',
        matchCondition: ({ eq, resource, literal }) => eq(resource('status'), literal('published')),
        effect: 'allow',
      },
    ]);

    const rules = await guantr.getRules();
    expect(rules).toHaveLength(1);

    const rule = rules[0] as Record<string, unknown>;
    expect(typeof rule.matchCondition).toBe('object');
    expect(rule.matchCondition).not.toBeNull();

    const mc = rule.matchCondition as Condition;
    expect(mc.type).toBe('condition');
    expect(mc.node.type).toBe('operator');

    const opNode = mc.node as OperatorNode;
    expect(opNode.operator).toBe('eq');
    expect(opNode.operands).toHaveLength(2);
    expect(opNode.operands[0]).toEqual({ type: 'resource', path: 'status' });
    expect(opNode.operands[1]).toEqual({ type: 'literal', value: 'published' });
  });

  it('matchCondition function is NOT a function after setRules', async () => {
    const guantr = await createGuantr<Meta>();

    await guantr.setRules([
      {
        resource: 'post',
        action: 'read',
        matchCondition: ({ ne, resource, literal }) => ne(resource('id'), literal(0)),
        effect: 'allow',
      },
    ]);

    const rules = await guantr.getRules();
    const rule = rules[0] as Record<string, unknown>;
    expect(typeof rule.matchCondition).toBe('object');
  });

  it('null matchCondition stays null', async () => {
    const guantr = await createGuantr<Meta>();

    await guantr.setRules([
      {
        resource: 'post',
        action: 'read',
        matchCondition: null,
        effect: 'allow',
      },
    ]);

    const rules = await guantr.getRules();
    expect((rules[0] as Record<string, unknown>).matchCondition).toBeNull();
  });

  it('undefined matchCondition stays absent/undefined', async () => {
    const guantr = await createGuantr<Meta>();

    await guantr.setRules([
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
      },
    ]);

    const rules = await guantr.getRules();
    const rule = rules[0] as Record<string, unknown>;
    expect(rule.matchCondition).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 2. Nested conditions (and/or/not) — builder-only AST structure tests
// ---------------------------------------------------------------------------

describe('matchCondition serialization — logical operators (builder)', () => {
  it('and(…) serializes with correct AST tree', () => {
    const b = builder();
    const cond = b.and(
      b.eq(b.resource('status'), b.literal('published')),
      b.gt(b.resource('viewCount'), b.literal(0)),
    );

    const json = JSON.stringify(cond);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const node = parsed.node as Record<string, unknown>;
    expect(node.type).toBe('logical');
    expect(node.operator).toBe('and');
    expect(node.operands as unknown[]).toHaveLength(2);

    const first = (node.operands as Array<Record<string, unknown>>)[0].node as Record<
      string,
      unknown
    >;
    expect(first.operator).toBe('eq');
    expect(first.operands).toEqual([
      { type: 'resource', path: 'status' },
      { type: 'literal', value: 'published' },
    ]);
  });

  it('not(…) serializes correctly', () => {
    const b = builder();
    const cond = b.not(b.eq(b.resource('published'), b.literal(true)));

    const json = JSON.stringify(cond);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const node = parsed.node as Record<string, unknown>;
    expect(node.type).toBe('logical');
    expect(node.operator).toBe('not');
    expect(node.operands as unknown[]).toHaveLength(1);
  });

  it('or(…) serializes correctly', () => {
    const b = builder();
    const cond = b.or(
      b.eq(b.resource('status'), b.literal('published')),
      b.eq(b.resource('status'), b.literal('featured')),
    );

    const json = JSON.stringify(cond);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const node = parsed.node as Record<string, unknown>;
    expect(node.type).toBe('logical');
    expect(node.operator).toBe('or');
    expect(node.operands as unknown[]).toHaveLength(2);
  });

  it('deeply nested and(or(…), not(…)) serializes correctly', () => {
    const b = builder();
    const cond = b.and(
      b.or(
        b.eq(b.resource('status'), b.literal('published')),
        b.eq(b.resource('status'), b.literal('draft')),
      ),
      b.not(b.eq(b.resource('published'), b.literal(false))),
    );

    const json = JSON.stringify(cond);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const root = parsed.node as Record<string, unknown>;
    expect(root.operator).toBe('and');
    expect(root.operands as unknown[]).toHaveLength(2);

    const orNode = (root.operands as Array<Record<string, unknown>>)[0].node as Record<
      string,
      unknown
    >;
    expect(orNode.operator).toBe('or');
    expect(orNode.operands as unknown[]).toHaveLength(2);

    const notNode = (root.operands as Array<Record<string, unknown>>)[1].node as Record<
      string,
      unknown
    >;
    expect(notNode.operator).toBe('not');
  });
});

// ---------------------------------------------------------------------------
// 3. Value ref serialization — builder-only
// ---------------------------------------------------------------------------

describe('matchCondition serialization — value refs (builder)', () => {
  it('resource ref serializes as { type: "resource", path: "…" }', () => {
    const b = builder();
    const cond = b.eq(b.resource('title'), b.literal('hello'));
    const opNode = cond.node as OperatorNode;

    const leftRef = opNode.operands[0] as unknown as Record<string, unknown>;
    expect(leftRef.type).toBe('resource');
    expect(leftRef.path).toBe('title');
    expect(Object.keys(leftRef).sort()).toEqual(['path', 'type']);
  });

  it('context ref serializes as { type: "context", path: "…" }', () => {
    const b = builder();
    const cond = b.eq(b.resource('id'), b.context('userId'));
    const opNode = cond.node as OperatorNode;

    const rightRef = opNode.operands[1] as unknown as Record<string, unknown>;
    expect(rightRef.type).toBe('context');
    expect(rightRef.path).toBe('userId');
    expect(Object.keys(rightRef).sort()).toEqual(['path', 'type']);
  });

  it('literal ref serializes as { type: "literal", value: … }', () => {
    const b = builder();
    const cond = b.eq(b.resource('id'), b.literal(42));
    const opNode = cond.node as OperatorNode;

    const rightRef = opNode.operands[1] as unknown as Record<string, unknown>;
    expect(rightRef.type).toBe('literal');
    expect(rightRef.value).toBe(42);
    expect(Object.keys(rightRef).sort()).toEqual(['type', 'value']);
  });

  it('array literal serializes correctly', () => {
    const b = builder();
    const cond = b.has(b.resource('tags'), b.literal('featured'));
    const opNode = cond.node as OperatorNode;

    expect(opNode.operator).toBe('has');
    expect(opNode.operands[0]).toEqual({ type: 'resource', path: 'tags' });
    expect(opNode.operands[1]).toEqual({ type: 'literal', value: 'featured' });
  });
});

// ---------------------------------------------------------------------------
// 4. Complex array operators with nested conditions — builder-only
// ---------------------------------------------------------------------------

describe('matchCondition serialization — complex array operators (builder)', () => {
  it('some(…) serializes with nested condition', () => {
    const b = builder();
    const cond = b.some(b.resource('comments'), ({ eq, resource, literal }) =>
      eq(resource('approved'), literal(true)),
    );
    const opNode = cond.node as OperatorNode;

    expect(opNode.operator).toBe('some');
    expect(opNode.operands[0]).toEqual({ type: 'resource', path: 'comments' });
    expect(opNode.condition).toBeDefined();

    const nested = opNode.condition!;
    expect(nested.type).toBe('condition');
    const nestedOp = nested.node as OperatorNode;
    expect(nestedOp.operator).toBe('eq');
    expect(nestedOp.operands[0]).toEqual({ type: 'resource', path: 'approved' });
    expect(nestedOp.operands[1]).toEqual({ type: 'literal', value: true });
  });

  it('every(…) serializes with nested condition', () => {
    const b = builder();
    const cond = b.every(b.resource('comments'), ({ gt, resource: _res, literal }) =>
      gt(literal(0), literal(-1)),
    );
    const opNode = cond.node as OperatorNode;
    expect(opNode.operator).toBe('every');
    expect(opNode.condition).toBeDefined();
  });

  it('none(…) serializes with nested condition', () => {
    const b = builder();
    const cond = b.none(b.resource('comments'), ({ eq, resource, literal }) =>
      eq(resource('approved'), literal(false)),
    );
    const opNode = cond.node as OperatorNode;
    expect(opNode.operator).toBe('none');
    expect(opNode.condition).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 5. Round-trip serialization
// ---------------------------------------------------------------------------

describe('matchCondition serialization — round-trip', () => {
  it('serialize → deserialize preserves full AST structure', () => {
    const b = builder();
    const cond = b.and(
      b.eq(b.resource('status'), b.literal('published')),
      b.gt(b.resource('viewCount'), b.literal(0)),
    );

    const json = JSON.stringify(cond);
    const parsed = JSON.parse(json);

    const reserialized = JSON.stringify(parsed);
    expect(reserialized).toBe(json);
  });

  it('condition with context ref round-trips correctly', () => {
    const b = builder();
    const cond = b.eq(b.resource('id'), b.context('userId'));

    const json = JSON.stringify(cond);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const node = parsed.node as Record<string, unknown>;
    expect(node.type).toBe('operator');
    expect(node.operator).toBe('eq');

    const operands = node.operands as Array<Record<string, unknown>>;
    expect(operands[0].type).toBe('resource');
    expect(operands[1].type).toBe('context');
    expect(operands[1].path).toBe('userId');
  });

  it('serialized condition is valid JSON without phantom type keys', () => {
    const b = builder();
    const cond = b.and(
      b.eq(b.resource('status'), b.literal('published')),
      b.gt(b.resource('viewCount'), b.literal(0)),
    );

    const json = JSON.stringify(cond);
    expect(json).not.toContain('ValueRefType');
    expect(json).not.toContain('Symbol');

    const parsed = JSON.parse(json);
    expect(parsed.type).toBe('condition');
    expect(parsed.node.type).toBe('logical');
  });
});

// ---------------------------------------------------------------------------
// 6. Callback form setRules with matchCondition
// ---------------------------------------------------------------------------

describe('matchCondition serialization — callback form', () => {
  it('callback form setRules processes matchCondition tuple element', async () => {
    const guantr = await createGuantr<Meta>();

    await guantr.setRules((allow) => {
      allow('read', [
        'post',
        ({ eq, resource, literal }) => eq(resource('status'), literal('published')),
      ]);
    });

    const rules = await guantr.getRules();
    expect(rules).toHaveLength(1);

    const rule = rules[0] as Record<string, unknown>;
    expect(rule.matchCondition).toBeDefined();
    const mc = rule.matchCondition as Condition;
    expect(mc.type).toBe('condition');
    const opNode = mc.node as OperatorNode;
    expect(opNode.operator).toBe('eq');
    expect(opNode.operands[0]).toEqual({ type: 'resource', path: 'status' });
  });

  it('callback form with just resource string (no condition) works', async () => {
    const guantr = await createGuantr<Meta>();

    await guantr.setRules((allow, deny) => {
      allow('read', 'post');
      deny('delete', 'post');
    });

    const rules = await guantr.getRules();
    expect(rules).toHaveLength(2);
    const rule0 = rules[0] as Record<string, unknown>;
    expect(rule0.matchCondition).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 8. Edge cases
// ---------------------------------------------------------------------------

describe('matchCondition serialization — edge cases', () => {
  it('string operator with caseInsensitive option serializes', () => {
    const b = builder();
    const cond = b.contains(b.resource('title'), b.literal('hello'), { caseInsensitive: true });
    const opNode = cond.node as OperatorNode;
    expect(opNode.operator).toBe('contains');
    expect(opNode.options).toEqual({ caseInsensitive: true });
  });

  it('in operator with literal array serializes', () => {
    const b = builder();
    const cond = b.in(b.literal('admin'), b.resource('tags'));

    const json = JSON.stringify(cond);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const node = parsed.node as Record<string, unknown>;
    expect(node.operator).toBe('in');
  });

  it('hasEvery with array literal serializes', () => {
    const b = builder();
    const cond = b.hasEvery(b.resource('tags'), b.literal(['a', 'b']));

    const json = JSON.stringify(cond);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const node = parsed.node as Record<string, unknown>;
    expect(node.operator).toBe('hasEvery');
  });

  it('empty and() serializes with empty operands', () => {
    const b = builder();
    const cond = b.and();

    const json = JSON.stringify(cond);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const node = parsed.node as Record<string, unknown>;
    expect(node.operator).toBe('and');
    expect(node.operands as unknown[]).toHaveLength(0);
  });

  it('multiple matchCondition rules in single setRules call', async () => {
    const guantr = await createGuantr<Meta>();

    await guantr.setRules([
      {
        resource: 'post',
        action: 'read',
        matchCondition: ({ eq, resource, literal }) => eq(resource('status'), literal('published')),
        effect: 'allow',
      },
      {
        resource: 'post',
        action: 'update',
        matchCondition: ({ eq, resource, context }) => eq(resource('id'), context('userId')),
        effect: 'allow',
      },
    ]);

    const rules = await guantr.getRules();
    expect(rules).toHaveLength(2);

    for (const rule of rules) {
      const r = rule as Record<string, unknown>;
      expect(typeof r.matchCondition).toBe('object');
      expect((r.matchCondition as Condition).type).toBe('condition');
    }
  });
});
