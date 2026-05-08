import type { Condition, OperatorNode, MatchConditionBuilder } from '../../src/index';
import { describe, it, expect } from 'vitest';
import {
  serializeRules,
  deserializeRules,
  createGuantr,
  GuantrMeta,
  GuantrResourceMap,
  GuantrRule,
} from '../../src/index';

type Post = {
  id: number;
  title: string;
  status: string;
  archived: boolean;
  viewCount: number;
  tags: string[];
  comments: Array<{ approved: boolean; body: string }>;
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

describe('serializeRules', () => {
  it('passes through rules with no matchCondition', () => {
    const rules: GuantrRule<Meta>[] = [{ resource: 'post', action: 'read', effect: 'allow' }];

    const result = serializeRules<Meta>(rules);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(rules[0]);
    expect(result[0].matchCondition).toBeUndefined();
  });

  it('passes through rules with null matchCondition', () => {
    const rules: GuantrRule<Meta>[] = [
      { resource: 'post', action: 'read', effect: 'allow', matchCondition: null },
    ];

    const result = serializeRules<Meta>(rules);

    expect(result).toHaveLength(1);
    expect(result[0].matchCondition).toBeNull();
  });

  it('converts function-based matchCondition to Condition object', () => {
    const rules: GuantrRule<Meta>[] = [
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ eq, resource: r, literal }) => eq(r('status'), literal('published')),
      },
    ];

    const result = serializeRules<Meta>(rules);

    expect(result).toHaveLength(1);
    const mc = result[0].matchCondition;
    expect(mc).not.toBeNull();
    expect(typeof mc).toBe('object');
    const condition = mc as Condition;
    expect(condition.type).toBe('condition');
    const opNode = condition.node as OperatorNode;
    expect(opNode.operator).toBe('eq');
    expect(opNode.operands[0]).toEqual({ type: 'resource', path: 'status' });
    expect(opNode.operands[1]).toEqual({ type: 'literal', value: 'published' });
  });

  it('leaves pre-serialized Condition objects unchanged', () => {
    const preBuilt: Condition = {
      type: 'condition',
      node: {
        type: 'operator',
        operator: 'eq',
        operands: [
          { type: 'resource', path: 'status' },
          { type: 'literal', value: 'draft' },
        ],
      },
    };

    const rules: GuantrRule<Meta>[] = [
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: preBuilt,
      },
    ];

    const result = serializeRules<Meta>(rules);

    expect(result).toHaveLength(1);
    expect(result[0].matchCondition).toBe(preBuilt);
  });

  it('handles multiple rules with mixed conditions', () => {
    const rules: GuantrRule<Meta>[] = [
      { resource: 'post', action: 'read', effect: 'allow' },
      {
        resource: 'post',
        action: 'read',
        effect: 'deny',
        matchCondition: ({ eq, resource: r, literal }) => eq(r('archived'), literal(true)),
      },
      {
        resource: 'post',
        action: 'update',
        effect: 'allow',
        matchCondition: null,
      },
    ];

    const result = serializeRules<Meta>(rules);

    expect(result).toHaveLength(3);
    expect(result[0].matchCondition).toBeUndefined();
    expect(typeof result[1].matchCondition).toBe('object');
    expect(result[2].matchCondition).toBeNull();
  });

  it('handles complex nested conditions (and/or/not)', () => {
    const rules: GuantrRule<Meta>[] = [
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ eq, resource: r, literal, and, not }) =>
          and(eq(r('status'), literal('published')), not(eq(r('archived'), literal(true)))),
      },
    ];

    const result = serializeRules<Meta>(rules);

    expect(result).toHaveLength(1);
    const condition = result[0].matchCondition as Condition;
    expect(condition.type).toBe('condition');
    expect(condition.node.type).toBe('logical');
  });

  it('produces valid JSON-serializable output', () => {
    const rules: GuantrRule<Meta>[] = [
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ eq, resource: r, literal }) => eq(r('status'), literal('published')),
      },
    ];

    const result = serializeRules<Meta>(rules);
    const json = JSON.stringify(result[0].matchCondition);

    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(parsed.type).toBe('condition');
  });

  it('produces output usable by setRules without re-serialization', async () => {
    const rules: GuantrRule<Meta>[] = [
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ eq, resource: r, literal }) => eq(r('status'), literal('published')),
      },
    ];

    const serialized = serializeRules<Meta>(rules);

    const guantr = await createGuantr<Meta>();
    await guantr.setRules(serialized);

    const storedRules = await guantr.getRules();
    expect(storedRules).toHaveLength(1);
    const mc = (storedRules[0] as Record<string, unknown>).matchCondition as Condition;
    expect(mc.type).toBe('condition');
  });

  it('handles empty rules array', () => {
    const result = serializeRules<Meta>([]);

    expect(result).toHaveLength(0);
  });

  it('works with context references in conditions', () => {
    const rules: GuantrRule<Meta>[] = [
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ eq, resource: r, context }) => eq(r('id'), context('userId')),
      },
    ];

    const result = serializeRules<Meta>(rules);

    const condition = result[0].matchCondition as Condition;
    const opNode = condition.node as OperatorNode;
    expect(opNode.operands[0]).toEqual({ type: 'resource', path: 'id' });
    expect(opNode.operands[1]).toEqual({ type: 'context', path: 'userId' });
  });

  it('handles complex array operators (some/every/none)', () => {
    const rules: GuantrRule<Meta>[] = [
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ some, resource: r }) =>
          some(r('comments'), ({ eq: innerEq, resource: innerR, literal: innerLit }) =>
            innerEq(innerR('approved'), innerLit(true)),
          ),
      },
    ];

    const result = serializeRules<Meta>(rules);

    const condition = result[0].matchCondition as Condition;
    expect(condition.type).toBe('condition');
    const opNode = condition.node as OperatorNode;
    expect(opNode.operator).toBe('some');
    expect(opNode.condition).toBeDefined();
  });

  it('preserves the original array (does not mutate input)', () => {
    const fn = ({ eq, resource: r, literal }: MatchConditionBuilder<Post, AppContext>) =>
      eq(r('status'), literal('published'));
    const rules: GuantrRule<Meta>[] = [
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: fn,
      },
    ];

    serializeRules<Meta>(rules);

    expect(rules[0].matchCondition).toBe(fn);
    expect(typeof rules[0].matchCondition).toBe('function');
  });

  it('handles rules without meta (untyped GuantrRule)', () => {
    const preBuilt: Condition = {
      type: 'condition',
      node: {
        type: 'operator',
        operator: 'eq',
        operands: [
          { type: 'resource', path: 'status' },
          { type: 'literal', value: 'published' },
        ],
      },
    };

    const rules: GuantrRule[] = [
      {
        effect: 'allow',
        action: 'read',
        resource: 'post',
        matchCondition: preBuilt,
      },
    ];

    const result = serializeRules(rules);

    expect(result).toHaveLength(1);
    expect(result[0].matchCondition).toBe(preBuilt);
  });
});

describe('deserializeRules', () => {
  it('passes through rules with no matchCondition', () => {
    const rules: GuantrRule<Meta>[] = [{ resource: 'post', action: 'read', effect: 'allow' }];

    const result = deserializeRules<Meta>(rules);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(rules[0]);
  });

  it('passes through rules with null matchCondition', () => {
    const rules: GuantrRule<Meta>[] = [
      { resource: 'post', action: 'read', effect: 'allow', matchCondition: null },
    ];

    const result = deserializeRules<Meta>(rules);

    expect(result).toHaveLength(1);
    expect(result[0].matchCondition).toBeNull();
  });

  it('wraps Condition object as a function', () => {
    const condition: Condition = {
      type: 'condition',
      node: {
        type: 'operator',
        operator: 'eq',
        operands: [
          { type: 'resource', path: 'status' },
          { type: 'literal', value: 'published' },
        ],
      },
    };

    const rules: GuantrRule<Meta>[] = [
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: condition,
      },
    ];

    const result = deserializeRules<Meta>(rules);

    expect(result).toHaveLength(1);
    expect(typeof result[0].matchCondition).toBe('function');
  });

  it('wrapped function returns the original Condition when called', () => {
    const condition: Condition = {
      type: 'condition',
      node: {
        type: 'operator',
        operator: 'ne',
        operands: [
          { type: 'resource', path: 'id' },
          { type: 'literal', value: 0 },
        ],
      },
    };

    const rules: GuantrRule<Meta>[] = [
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: condition,
      },
    ];

    const deserialized = deserializeRules<Meta>(rules);
    expect(typeof deserialized[0].matchCondition).toBe('function');

    const mcFn = deserialized[0].matchCondition!;
    const output = (mcFn as unknown as (_: MatchConditionBuilder<Post, AppContext>) => Condition)(
      {} as MatchConditionBuilder<Post, AppContext>,
    );
    expect(output).toEqual(condition);
  });

  it('leaves already-function matchCondition unchanged', () => {
    const fn = ({ eq, resource: r, literal }: MatchConditionBuilder<Post, AppContext>) =>
      eq(r('status'), literal('published'));
    const rules: GuantrRule<Meta>[] = [
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: fn,
      },
    ];

    const result = deserializeRules<Meta>(rules);

    expect(result[0].matchCondition).toBe(fn);
  });

  it('round-trip: serializeRules -> deserializeRules produces equivalent functions', () => {
    const originalFn = ({ eq, resource: r, literal }: MatchConditionBuilder<Post, AppContext>) =>
      eq(r('status'), literal('published'));
    const rules: GuantrRule<Meta>[] = [
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: originalFn,
      },
    ];

    const serialized = serializeRules<Meta>(rules);
    const deserialized = deserializeRules<Meta>(serialized);

    expect(typeof deserialized[0].matchCondition).toBe('function');

    const mcFn = deserialized[0].matchCondition!;
    const output = (mcFn as unknown as (_: MatchConditionBuilder<Post, AppContext>) => Condition)(
      {} as MatchConditionBuilder<Post, AppContext>,
    );
    expect(output).toEqual(serialized[0].matchCondition as Condition);
  });

  it('round-trip: deserialized rules work with setRules', async () => {
    const condition: Condition = {
      type: 'condition',
      node: {
        type: 'operator',
        operator: 'eq',
        operands: [
          { type: 'resource', path: 'status' },
          { type: 'literal', value: 'published' },
        ],
      },
    };

    const rules: GuantrRule<Meta>[] = [
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: condition,
      },
    ];

    const deserialized = deserializeRules<Meta>(rules);

    const guantr = await createGuantr<Meta>();
    await guantr.setRules(deserialized);

    const storedRules = await guantr.getRules();
    expect(storedRules).toHaveLength(1);
    const mc = (storedRules[0] as Record<string, unknown>).matchCondition as Condition;
    expect(mc.type).toBe('condition');
    expect((mc.node as OperatorNode).operator).toBe('eq');
  });

  it('handles multiple rules with mixed conditions', () => {
    const condition: Condition = {
      type: 'condition',
      node: {
        type: 'operator',
        operator: 'eq',
        operands: [
          { type: 'resource', path: 'status' },
          { type: 'literal', value: 'published' },
        ],
      },
    };

    const rules: GuantrRule<Meta>[] = [
      { resource: 'post', action: 'read', effect: 'allow' },
      {
        resource: 'post',
        action: 'read',
        effect: 'deny',
        matchCondition: condition,
      },
      {
        resource: 'post',
        action: 'update',
        effect: 'allow',
        matchCondition: null,
      },
    ];

    const result = deserializeRules<Meta>(rules);

    expect(result).toHaveLength(3);
    expect(result[0].matchCondition).toBeUndefined();
    expect(typeof result[1].matchCondition).toBe('function');
    expect(result[2].matchCondition).toBeNull();
  });

  it('handles empty rules array', () => {
    const result = deserializeRules<Meta>([]);

    expect(result).toHaveLength(0);
  });

  it('preserves the original array (does not mutate input)', () => {
    const condition: Condition = {
      type: 'condition',
      node: {
        type: 'operator',
        operator: 'eq',
        operands: [
          { type: 'resource', path: 'status' },
          { type: 'literal', value: 'published' },
        ],
      },
    };

    const rules: GuantrRule<Meta>[] = [
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: condition,
      },
    ];

    deserializeRules<Meta>(rules);

    expect(typeof rules[0].matchCondition).toBe('object');
  });
});

describe('serializeRules + deserializeRules integration', () => {
  it('serialized rules can be directly queried by storage without calling setRules', async () => {
    const guantr = await createGuantr<Meta>();

    const rules: GuantrRule<Meta>[] = [
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ eq, resource: r, literal }) => eq(r('status'), literal('published')),
      },
    ];

    const serialized = serializeRules<Meta>(rules);
    await guantr.setRules(serialized);

    const related = await guantr.relatedRulesFor('read', 'post');
    expect(related).toHaveLength(1);
    const mc = related[0].matchCondition as Condition;
    expect(mc.type).toBe('condition');
  });

  it('pre-serialized rules allow permission checking', async () => {
    const rules: GuantrRule<Meta>[] = [
      {
        resource: 'post',
        action: 'read',
        effect: 'allow',
        matchCondition: ({ eq, resource: r, literal }) => eq(r('status'), literal('published')),
      },
    ];

    const serialized = serializeRules<Meta>(rules);

    const guantr = await createGuantr<Meta>();
    await guantr.setRules(serialized);

    const can = await guantr.can('read', [
      'post',
      {
        id: 1,
        title: 'Hello',
        status: 'published',
        archived: false,
        viewCount: 0,
        tags: [],
        comments: [],
      },
    ]);
    expect(can).toBe(true);

    const cannot = await guantr.can('read', [
      'post',
      {
        id: 2,
        title: 'Draft',
        status: 'draft',
        archived: false,
        viewCount: 0,
        tags: [],
        comments: [],
      },
    ]);
    expect(cannot).toBe(false);
  });

  it('full round-trip: serialize -> JSON -> deserialize -> setRules -> check', async () => {
    const originalRules: GuantrRule<Meta>[] = [
      { resource: 'post', action: 'read', effect: 'allow' },
      {
        resource: 'post',
        action: 'read',
        effect: 'deny',
        matchCondition: ({ eq, resource: r, literal }) => eq(r('archived'), literal(true)),
      },
    ];

    const serialized = serializeRules<Meta>(originalRules);
    const json = JSON.stringify(serialized);
    const fromDb = JSON.parse(json) as GuantrRule<Meta>[];
    const deserialized = deserializeRules<Meta>(fromDb);

    const guantr = await createGuantr<Meta>();
    await guantr.setRules(deserialized);

    const canReadActive = await guantr.can('read', [
      'post',
      {
        id: 1,
        title: 'Post',
        status: 'published',
        archived: false,
        viewCount: 0,
        tags: [],
        comments: [],
      },
    ]);
    expect(canReadActive).toBe(true);

    const canReadArchived = await guantr.can('read', [
      'post',
      {
        id: 2,
        title: 'Archived',
        status: 'published',
        archived: true,
        viewCount: 0,
        tags: [],
        comments: [],
      },
    ]);
    expect(canReadArchived).toBe(false);
  });

  it('typical use case: serialize rules file -> inject into DB -> storage serves them', async () => {
    const definedRules: GuantrRule<Meta>[] = [
      { resource: 'post', action: 'read', effect: 'allow' },
      {
        resource: 'post',
        action: 'update',
        effect: 'allow',
        matchCondition: ({ eq, resource: r, context }) => eq(r('id'), context('userId')),
      },
    ];

    const rulesForDb = serializeRules<Meta>(definedRules);

    for (const rule of rulesForDb) {
      if (rule.matchCondition != null) {
        expect(typeof rule.matchCondition).toBe('object');
      }
    }

    const json = JSON.stringify(rulesForDb);
    const stored = JSON.parse(json) as GuantrRule<Meta>[];

    const guantr = await createGuantr<Meta>({
      context: { userId: 1, role: 'admin' },
    });
    await guantr.setRules(stored);

    const canRead = await guantr.can('read', [
      'post',
      {
        id: 1,
        title: 'Test',
        status: 'draft',
        archived: false,
        viewCount: 0,
        tags: [],
        comments: [],
      },
    ]);
    expect(canRead).toBe(true);

    const canUpdateOwn = await guantr.can('update', [
      'post',
      {
        id: 1,
        title: 'Test',
        status: 'draft',
        archived: false,
        viewCount: 0,
        tags: [],
        comments: [],
      },
    ]);
    expect(canUpdateOwn).toBe(true);

    const canUpdateOther = await guantr.can('update', [
      'post',
      {
        id: 2,
        title: 'Other',
        status: 'draft',
        archived: false,
        viewCount: 0,
        tags: [],
        comments: [],
      },
    ]);
    expect(canUpdateOther).toBe(false);
  });
});
