import type { GuantrMeta, GuantrRule, GuantrResourceMap } from '../src';
import { describe, expect, it, test } from 'vitest';
import { createGuantr } from '../src';

type MockResourceMap = GuantrResourceMap<{
  user: {
    action: 'create' | 'read' | 'update' | 'delete';
    model: {
      id: number;
      name: string;
      suspended: boolean | null;
      roles: { id: number; name: string }[];
      address: {
        line1: string;
        line2: string;
        city: string;
        state: string;
        zip: string;
        country: string;
      } | null;
    };
  };
  post: {
    action: 'create' | 'read' | 'update' | 'delete';
    model: {
      id: number;
      published: boolean | undefined;
      title: string;
      description: string | null;
      tags: string[] | null | undefined;
      lastUpdatedAt: Date | null;
    };
  };
}>;

type MockMeta = GuantrMeta<MockResourceMap>;

describe('Guantr', () => {
  test('createGuantr should return new Guantr instance', async () => {
    const guantr = await createGuantr<MockMeta>([]);

    expect(await guantr.getRules()).toEqual([]);
  });

  test('setRules method should add rule to rules array', async () => {
    const guantr = await createGuantr<MockMeta>();
    await guantr.setRules((can) => {
      can('read', 'post');
    });

    expect(await guantr.getRules()).toContainEqual({
      action: 'read',
      resource: 'post',
      condition: null,
      effect: 'allow',
    });
  });

  test('setRules method should replace existing rules', async () => {
    const guantr = await createGuantr<MockMeta>();
    await guantr.setRules([
      {
        action: 'read',
        resource: 'post',
        condition: null,
        effect: 'allow',
      },
    ]);
    await guantr.setRules(() => {});

    expect(await guantr.getRules()).toEqual([]);
  });

  test('setRules method should clear existing rules', async () => {
    const guantr = await createGuantr<MockMeta>();
    await guantr.setRules((can) => {
      can('read', 'post');
    });

    await guantr.setRules(() => {});

    expect(await guantr.getRules()).toEqual([]);
  });

  test('setRules method should add rule to rules array', async () => {
    const guantr = await createGuantr<MockMeta>();

    const rules: GuantrRule<MockMeta>[] = [
      {
        action: 'create',
        resource: 'post',
        condition: null,
        effect: 'allow',
      },
    ];

    await guantr.setRules(rules);

    expect(await guantr.getRules()).toEqual(rules);
  });

  test('setRules method should clear existing rules', async () => {
    const guantr = await createGuantr<MockMeta>();
    await guantr.setRules((can) => {
      can('read', 'post');
    });

    await guantr.setRules([]);

    expect(await guantr.getRules()).toEqual([]);
  });

  test('setRules method should replace existing rules', async () => {
    const guantr = await createGuantr<MockMeta>();
    await guantr.setRules((can) => {
      can('read', ['post', { id: ['eq', 1] }]);
    });

    const newRules: GuantrRule<MockMeta>[] = [
      {
        action: 'create',
        resource: 'post',
        condition: null,
        effect: 'allow',
      },
      {
        action: 'create',
        resource: 'post',
        condition: { title: ['startsWith', 'ANNOUNCEMENT:'] },
        effect: 'deny',
      },
    ];

    await guantr.setRules(newRules);

    expect(await guantr.getRules()).toEqual(newRules);
  });
});

describe('Guantr.can', () => {
  it('should return true if user has rule (abstract)', async () => {
    const guantr = await createGuantr<MockMeta>();
    await guantr.setRules([
      {
        action: 'read',
        resource: 'post',
        condition: null,
        effect: 'allow',
      },
    ]);

    expect(await guantr.can.abstract('read', 'post')).toBe(true);
  });

  it('should return false if user does not have rule (abstract)', async () => {
    const guantr = await createGuantr<MockMeta>();
    await guantr.setRules([]);

    expect(await guantr.can.abstract('read', 'post')).toBe(false);
  });

  it('should return false if resource or action not found in rules (abstract)', async () => {
    const guantr = await createGuantr<MockMeta>();
    await guantr.setRules([
      {
        action: 'delete',
        resource: 'post',
        condition: null,
        effect: 'allow',
      },
    ]);

    expect(await guantr.can.abstract('create', 'post')).toBe(false);
  });

  it('should return false if user has inverted rule (abstract)', async () => {
    const guantr = await createGuantr<MockMeta>();
    await guantr.setRules([
      {
        action: 'delete',
        resource: 'post',
        condition: null,
        effect: 'deny',
      },
    ]);

    expect(await guantr.can.abstract('delete', 'post')).toBe(false);
  });

  it('should be able to match condition for nested resource condition', async () => {
    const guantr = await createGuantr<MockMeta>();
    await guantr.setRules([
      {
        resource: 'user',
        action: 'read',
        condition: {
          address: {
            country: ['eq', 'id', { caseInsensitive: true }],
          },
        },
        effect: 'allow',
      },
    ]);

    const mockUser: MockResourceMap['user']['model'] = {
      id: 1,
      name: 'John Doe',
      suspended: null,
      roles: [
        { id: 1, name: 'admin' },
        { id: 2, name: 'user' },
      ],
      address: {
        line1: '123 Main St',
        line2: 'Apt 4B',
        city: 'AnyTown',
        state: 'CA',
        zip: '12345',
        country: 'ID',
      },
    };
    expect(await guantr.can('read', ['user', mockUser])).toBe(true);
  });

  it('should be able to match condition of array', async () => {
    const guantr = await createGuantr<MockMeta>();
    await guantr.setRules([
      {
        resource: 'user',
        action: 'read',
        condition: {
          roles: ['some', { name: ['eq', 'user'] }],
        },
        effect: 'allow',
      },
    ]);

    const mockUser: MockResourceMap['user']['model'] = {
      id: 1,
      name: 'John Doe',
      suspended: null,
      roles: [
        { id: 1, name: 'admin' },
        { id: 2, name: 'user' },
      ],
      address: {
        line1: '123 Main St',
        line2: 'Apt 4B',
        city: 'AnyTown',
        state: 'CA',
        zip: '12345',
        country: 'ID',
      },
    };
    expect(await guantr.can('read', ['user', mockUser])).toBe(true);
  });

  it('should be able to match condition for array length check', async () => {
    const guantr = await createGuantr<MockMeta>();
    await guantr.setRules([
      {
        resource: 'user',
        action: 'read',
        condition: {
          roles: {
            length: ['eq', 2],
          },
        },
        effect: 'allow',
      },
    ]);

    const mockUser: MockResourceMap['user']['model'] = {
      id: 1,
      name: 'John Doe',
      suspended: null,
      roles: [
        { id: 1, name: 'admin' },
        { id: 2, name: 'user' },
      ],
      address: {
        line1: '123 Main St',
        line2: 'Apt 4B',
        city: 'AnyTown',
        state: 'CA',
        zip: '12345',
        country: 'ID',
      },
    };
    expect(await guantr.can('read', ['user', mockUser])).toBe(true);
    mockUser.roles.pop();
    expect(await guantr.can('read', ['user', mockUser])).toBe(false);
  });

  it('should be able to match condition for array length check with expression', async () => {
    const guantr = await createGuantr<MockMeta>();
    await guantr.setRules([
      {
        resource: 'user',
        action: 'read',
        condition: {
          roles: {
            length: ['eq', 2],
            $expr: ['some', { name: ['eq', 'User', { caseInsensitive: true }] }],
          },
        },
        effect: 'allow',
      },
    ]);

    const mockUser: MockResourceMap['user']['model'] = {
      id: 1,
      name: 'John Doe',
      suspended: null,
      roles: [
        { id: 1, name: 'admin' },
        { id: 2, name: 'user' },
      ],
      address: {
        line1: '123 Main St',
        line2: 'Apt 4B',
        city: 'AnyTown',
        state: 'CA',
        zip: '12345',
        country: 'ID',
      },
    };
    expect(await guantr.can('read', ['user', mockUser])).toBe(true);
    mockUser.roles.pop();
    expect(await guantr.can('read', ['user', mockUser])).toBe(false);
  });

  it('should be able to match condition using context', async () => {
    const mockContext1 = {
      name: 'john doe',
      role: {
        name: 'admin',
      } as { name: string } | null,
    };

    const guantr1 = await createGuantr<MockMeta>(
      [
        {
          resource: 'user',
          action: 'read',
          condition: {
            name: ['eq', '$ctx.name', { caseInsensitive: true }],
          },
          effect: 'allow',
        },
      ],
      { getContext: () => mockContext1 },
    );

    const guantr2 = await createGuantr<MockMeta>(
      [
        {
          resource: 'user',
          action: 'read',
          condition: {
            roles: ['some', { name: ['eq', '$ctx.role?.name'] }],
          },
          effect: 'allow',
        },
      ],
      { getContext: () => mockContext1 },
    );

    const mockUser: MockResourceMap['user']['model'] = {
      id: 1,
      name: 'John Doe',
      suspended: null,
      roles: [
        { id: 1, name: 'admin' },
        { id: 2, name: 'user' },
      ],
      address: {
        line1: '123 Main St',
        line2: 'Apt 4B',
        city: 'AnyTown',
        state: 'CA',
        zip: '12345',
        country: 'ID',
      },
    };
    expect(await guantr1.can('read', ['user', mockUser])).toBe(true);
    expect(await guantr2.can('read', ['user', mockUser])).toBe(true);
  });

  it('should apply contextual operands in relatedRulesFor', async () => {
    const mockContext = {
      name: 'john doe',
    };

    const guantr = await createGuantr<MockMeta>({ getContext: () => mockContext });
    await guantr.setRules([
      {
        resource: 'user',
        action: 'read',
        condition: {
          name: ['eq', '$ctx.name', { caseInsensitive: true }],
        },
        effect: 'allow',
      },
    ]);

    const rules = await guantr.relatedRulesFor('read', 'user', {
      applyConditionContextualOperands: true,
    });
    expect(rules[0].condition).toEqual({
      name: ['eq', 'john doe', { caseInsensitive: true }],
    });
  });

  it('should be able to reach nullable context', async () => {
    const mockContext1 = {
      address: null,
    } as { address: { line1: string } | null };
    const mockContext2 = {
      address: { line1: '123 Main St' },
    } as { address: { line1: string } | null };

    const guantr1 = await createGuantr<MockMeta>({ getContext: () => mockContext1 });
    await guantr1.setRules([
      {
        resource: 'user',
        action: 'read',
        condition: {
          address: {
            line1: ['eq', '$ctx.address?.line1'],
          },
        },
        effect: 'allow',
      },
    ]);

    const guantr2 = await createGuantr<MockMeta>(
      [
        {
          resource: 'user',
          action: 'read',
          condition: {
            address: {
              line1: ['eq', '$ctx.address?.line1'],
            },
          },
          effect: 'allow',
        },
      ],
      {
        getContext: () => mockContext2,
      },
    );

    const mockUser: MockResourceMap['user']['model'] = {
      id: 1,
      name: 'John Doe',
      suspended: null,
      roles: [
        { id: 1, name: 'admin' },
        { id: 2, name: 'user' },
      ],
      address: {
        line1: '123 Main St',
        line2: 'Apt 4B',
        city: 'AnyTown',
        state: 'CA',
        zip: '12345',
        country: 'ID',
      },
    };
    expect(await guantr1.can('read', ['user', mockUser])).toBe(false);
    expect(await guantr2.can('read', ['user', mockUser])).toBe(true);
  });

  it('should handle circuit breaker in can method', async () => {
    const guantr = await createGuantr();
    const rules: GuantrRule[] = [];
    // 1001 rules should trip the default circuit breaker (limit: 1000)
    for (let i = 0; i < 1001; i++) {
      rules.push({
        resource: 'post',
        action: 'read',
        condition: null,
        effect: 'allow',
      });
    }
    await guantr.setRules(rules);
    const post = {
      id: 1,
      title: 'Hello World',
      description: '',
      lastUpdatedAt: null,
      tags: [],
    };
    await expect(guantr.can('read', ['post', post])).rejects.toThrow('Circuit breaker tripped');
  });

  it('should be able to handle overlapping rules: general -> specific', async () => {
    const guantr = await createGuantr<MockMeta>();
    await guantr.setRules([
      {
        resource: 'post',
        action: 'read',
        condition: null,
        effect: 'allow',
      },
      {
        resource: 'post',
        action: 'read',
        condition: {
          published: ['eq', true],
        },
        effect: 'allow',
      },
    ]);

    expect(await guantr.can.abstract('read', 'post')).toBe(true);
    const post = {
      id: 1,
      title: 'Hello World',
      description: '',
      lastUpdatedAt: null,
      tags: [],
    };
    expect(await guantr.can('read', ['post', { ...post, published: true }])).toBe(true);
    expect(await guantr.can('read', ['post', { ...post, published: false }])).toBe(true);
  });

  it('should be able to handle overlapping rules: specific -> general', async () => {
    const guantr = await createGuantr<MockMeta>();
    await guantr.setRules([
      {
        resource: 'post',
        action: 'read',
        condition: {
          published: ['eq', true],
        },
        effect: 'allow',
      },
      {
        resource: 'post',
        action: 'read',
        condition: null,
        effect: 'allow',
      },
    ]);

    expect(await guantr.can.abstract('read', 'post')).toBe(true);
    const post = {
      id: 1,
      title: 'Hello World',
      description: '',
      lastUpdatedAt: null,
      tags: [],
    };
    expect(await guantr.can('read', ['post', { ...post, published: true }])).toBe(true);
    expect(await guantr.can('read', ['post', { ...post, published: false }])).toBe(true);
  });

  it('should be able to handle overlapping rules: general -> specific-inverted', async () => {
    const guantr = await createGuantr<MockMeta>();
    await guantr.setRules([
      {
        resource: 'post',
        action: 'read',
        condition: null,
        effect: 'allow',
      },
      {
        resource: 'post',
        action: 'read',
        condition: {
          published: ['eq', false],
        },
        effect: 'deny',
      },
    ]);

    expect(await guantr.can.abstract('read', 'post')).toBe(true);
    const post = {
      id: 1,
      title: 'Hello World',
      description: '',
      lastUpdatedAt: null,
      tags: [],
    };
    expect(await guantr.can('read', ['post', { ...post, published: true }])).toBe(true);
    expect(await guantr.can('read', ['post', { ...post, published: false }])).toBe(false);
  });

  it('should be able to handle overlapping rules: specific-inverted -> general', async () => {
    const guantr = await createGuantr<MockMeta>();
    await guantr.setRules([
      {
        resource: 'post',
        action: 'read',
        condition: {
          published: ['eq', true],
        },
        effect: 'deny',
      },
      {
        resource: 'post',
        action: 'read',
        condition: null,
        effect: 'allow',
      },
    ]);

    expect(await guantr.can.abstract('read', 'post')).toBe(true);
    const post = {
      id: 1,
      title: 'Hello World',
      description: '',
      lastUpdatedAt: null,
      tags: [],
    };
    expect(await guantr.can('read', ['post', { ...post, published: true }])).toBe(false);
    expect(await guantr.can('read', ['post', { ...post, published: false }])).toBe(true);
  });

  it('should be able to handle overlapping rules: general-inverted -> specific-inverted', async () => {
    const guantr = await createGuantr<MockMeta>();
    await guantr.setRules([
      {
        resource: 'post',
        action: 'read',
        condition: null,
        effect: 'deny',
      },
      {
        resource: 'post',
        action: 'read',
        condition: {
          published: ['eq', false],
        },
        effect: 'deny',
      },
    ]);

    expect(await guantr.can.abstract('read', 'post')).toBe(false);
    const post = {
      id: 1,
      title: 'Hello World',
      description: '',
      lastUpdatedAt: null,
      tags: [],
    };
    expect(await guantr.can('read', ['post', { ...post, published: true }])).toBe(false);
    expect(await guantr.can('read', ['post', { ...post, published: false }])).toBe(false);
  });

  it('should be able to handle overlapping rules: specific-inverted -> general-inverted', async () => {
    const guantr = await createGuantr<MockMeta>();
    await guantr.setRules([
      {
        resource: 'post',
        action: 'read',
        condition: {
          published: ['eq', false],
        },
        effect: 'deny',
      },
      {
        resource: 'post',
        action: 'read',
        condition: null,
        effect: 'deny',
      },
    ]);

    expect(await guantr.can.abstract('read', 'post')).toBe(false);
    const post = {
      id: 1,
      title: 'Hello World',
      description: '',
      lastUpdatedAt: null,
      tags: [],
    };
    expect(await guantr.can('read', ['post', { ...post, published: true }])).toBe(false);
    expect(await guantr.can('read', ['post', { ...post, published: false }])).toBe(false);
  });

  it('should be able to handle overlapping rules: general-inverted -> specific', async () => {
    const guantr = await createGuantr<MockMeta>();
    await guantr.setRules([
      {
        resource: 'post',
        action: 'read',
        condition: null,
        effect: 'deny',
      },
      {
        resource: 'post',
        action: 'read',
        condition: {
          published: ['eq', true],
        },
        effect: 'allow',
      },
    ]);

    expect(await guantr.can.abstract('read', 'post')).toBe(true);
    const post = {
      id: 1,
      title: 'Hello World',
      description: '',
      lastUpdatedAt: null,
      tags: [],
    };
    expect(await guantr.can('read', ['post', { ...post, published: true }])).toBe(false);
    expect(await guantr.can('read', ['post', { ...post, published: false }])).toBe(false);
  });

  it('should be able to handle overlapping rules: specific -> general-inverted', async () => {
    const guantr = await createGuantr<MockMeta>();
    await guantr.setRules([
      {
        resource: 'post',
        action: 'read',
        condition: {
          published: ['eq', true],
        },
        effect: 'allow',
      },
      {
        resource: 'post',
        action: 'read',
        condition: null,
        effect: 'deny',
      },
    ]);

    expect(await guantr.can.abstract('read', 'post')).toBe(true);
    const post = {
      id: 1,
      title: 'Hello World',
      description: '',
      lastUpdatedAt: null,
      tags: [],
    };
    expect(await guantr.can('read', ['post', { ...post, published: true }])).toBe(false);
    expect(await guantr.can('read', ['post', { ...post, published: false }])).toBe(false);
  });
});

describe('Guantr.can.abstract / cannot.abstract', () => {
  it('can.abstract should return true if any allow rule exists (ignores deny rules)', async () => {
    const guantr = await createGuantr<MockMeta>();
    await guantr.setRules((can, cannot) => {
      can('read', 'post');
      cannot('read', ['post', { published: ['eq', false] }]);
    });

    // can.abstract only looks for the existence of an allow rule — deny is ignored
    expect(await guantr.can.abstract('read', 'post')).toBe(true);
  });

  it('can.abstract should return false when no allow rule exists', async () => {
    const guantr = await createGuantr<MockMeta>();
    await guantr.setRules((can, cannot) => {
      cannot('read', 'post');
    });

    expect(await guantr.can.abstract('read', 'post')).toBe(false);
  });

  it('can.abstract should return false when no rules exist at all', async () => {
    const guantr = await createGuantr<MockMeta>([]);
    expect(await guantr.can.abstract('read', 'post')).toBe(false);
  });

  it('can.abstract should return true even when only conditional allow rules exist', async () => {
    const guantr = await createGuantr<MockMeta>();
    await guantr.setRules((can) => {
      can('read', ['post', { published: ['eq', true] }]);
    });

    // Abstract check doesn't evaluate conditions — just the existence of an allow rule
    expect(await guantr.can.abstract('read', 'post')).toBe(true);
  });

  it('can.abstract should be resource-key scoped (does not bleed across resources)', async () => {
    const guantr = await createGuantr<MockMeta>();
    await guantr.setRules((can) => {
      can('read', 'user');
    });

    expect(await guantr.can.abstract('read', 'post')).toBe(false);
    expect(await guantr.can.abstract('read', 'user')).toBe(true);
  });

  it('cannotAbstract should return true when no allow rule exists', async () => {
    const guantr = await createGuantr<MockMeta>([]);
    expect(await guantr.cannot.abstract('read', 'post')).toBe(true);
  });

  it('cannotAbstract should return false when an allow rule exists', async () => {
    const guantr = await createGuantr<MockMeta>();
    await guantr.setRules((can, cannot) => {
      can('read', 'post');
      cannot('read', ['post', { published: ['eq', false] }]);
    });

    expect(await guantr.cannot.abstract('read', 'post')).toBe(false);
  });

  it('cannotAbstract is the logical negation of can.abstract', async () => {
    const guantr = await createGuantr<MockMeta>();
    await guantr.setRules((can) => {
      can('read', 'post');
    });

    const abstract = await guantr.can.abstract('read', 'post');
    const abstractNot = await guantr.cannot.abstract('read', 'post');
    expect(abstract).toBe(!abstractNot);
  });
});

describe('Guantr.setRules with async callback', () => {
  test('should capture rules defined before await', async () => {
    const guantr = await createGuantr<MockMeta>();
    await guantr.setRules(async (can) => {
      can('read', 'post');
      await Promise.resolve();
    });

    const rules = await guantr.getRules();
    expect(rules).toContainEqual({
      action: 'read',
      resource: 'post',
      condition: null,
      effect: 'allow',
    });
  });

  test('should capture rules defined after await', async () => {
    const guantr = await createGuantr<MockMeta>();
    await guantr.setRules(async (can, cannot) => {
      can('read', 'post');
      await Promise.resolve();
      cannot('delete', 'post');
    });

    const rules = await guantr.getRules();
    expect(rules).toContainEqual({
      action: 'read',
      resource: 'post',
      condition: null,
      effect: 'allow',
    });
    expect(rules).toContainEqual({
      action: 'delete',
      resource: 'post',
      condition: null,
      effect: 'deny',
    });
  });

  test('should capture rules with conditions defined after await', async () => {
    const guantr = await createGuantr<MockMeta>();
    await guantr.setRules(async (can) => {
      can('read', 'post');
      await Promise.resolve();
      can('read', ['post', { published: ['eq', true] }]);
    });

    const rules = await guantr.getRules();
    expect(rules).toHaveLength(2);
    expect(rules).toContainEqual({
      action: 'read',
      resource: 'post',
      condition: null,
      effect: 'allow',
    });
    expect(rules).toContainEqual({
      action: 'read',
      resource: 'post',
      condition: { published: ['eq', true] },
      effect: 'allow',
    });
  });

  test('should work with real async operations like fetch-like delays', async () => {
    const guantr = await createGuantr<MockMeta>();

    // Simulate fetching rules from an external source
    const fetchUserPermissions = async () => {
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { canCreate: true, canDelete: false } as const;
    };

    await guantr.setRules(async (can, cannot) => {
      can('read', 'post');
      const permissions = await fetchUserPermissions();
      if (permissions.canCreate) {
        can('create', 'post');
      }
      if (!permissions.canDelete) {
        cannot('delete', 'post');
      }
    });

    const rules = await guantr.getRules();
    expect(rules).toContainEqual({
      action: 'read',
      resource: 'post',
      condition: null,
      effect: 'allow',
    });
    expect(rules).toContainEqual({
      action: 'create',
      resource: 'post',
      condition: null,
      effect: 'allow',
    });
    expect(rules).toContainEqual({
      action: 'delete',
      resource: 'post',
      condition: null,
      effect: 'deny',
    });
  });

  test('should work with sync callbacks unchanged', async () => {
    const guantr = await createGuantr<MockMeta>();
    await guantr.setRules((can, cannot) => {
      can('read', 'post');
      cannot('delete', 'post');
    });

    const rules = await guantr.getRules();
    expect(rules).toHaveLength(2);
    expect(rules).toContainEqual({
      action: 'read',
      resource: 'post',
      condition: null,
      effect: 'allow',
    });
    expect(rules).toContainEqual({
      action: 'delete',
      resource: 'post',
      condition: null,
      effect: 'deny',
    });
  });

  test('should handle async callback that returns nothing (only await)', async () => {
    const guantr = await createGuantr<MockMeta>();
    await guantr.setRules(async (can) => {
      can('read', 'post');
      // Just awaiting something without defining more rules
      await Promise.resolve();
    });

    const rules = await guantr.getRules();
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({
      action: 'read',
      resource: 'post',
      effect: 'allow',
    });
  });

  test('should clear rules and set new ones with async callback', async () => {
    const guantr = await createGuantr<MockMeta>();

    // Set initial rules
    await guantr.setRules((can) => {
      can('read', 'user');
    });

    // Replace with async callback
    await guantr.setRules(async (can) => {
      await Promise.resolve();
      can('read', 'post');
    });

    const rules = await guantr.getRules();
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({
      action: 'read',
      resource: 'post',
      effect: 'allow',
    });
  });
});
