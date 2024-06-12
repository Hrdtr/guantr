import { describe, expect, it, test } from "vitest";
import { createGuantr } from "../src";
import type { GuantrMeta, GuantrPermission } from "../src";

type MockResourceMap = {
  user: {
    id: number,
    name: string,
    suspended: boolean | null
    roles: { id: number, name: string }[]
    address: {
      line1: string,
      line2: string
      city: string
      state: string
      zip: string
      country: string
    } | null
  },
  post: {
    id: number,
    published: boolean | undefined,
    title: string,
    description: string | null
    tags: string[] | null | undefined
    lastUpdatedAt: Date | null
  }
}

type MockAction = 'create' | 'read' | 'update' | 'delete';

type MockMeta = GuantrMeta<MockResourceMap, MockAction>;

describe('Guantr', () => {
  test('createGuantr should return new Guantr instance', () => {
    const guantr = createGuantr<MockMeta>();

    expect(guantr.context).toEqual({});
    expect(guantr.permissions).toEqual([]);
  });

  const mockContext: MockResourceMap['user'] = {
    id: 1,
    name: 'John Doe',
    suspended: null,
    roles: [{ id: 1, name: 'admin' }, { id: 2, name: 'user' }],
    address: {
      line1: '123 Main St',
      line2: 'Apt 4B',
      city: 'AnyTown',
      state: 'CA',
      zip: '12345',
      country: 'USA'
    }
  }

  test('withContext method should update instance context', () => {
    const guantr = createGuantr<MockMeta>().withContext(mockContext);

    expect(guantr.context).toEqual(mockContext);
  });

  test('withContext method should update instance context without meta', () => {
    const guantr = createGuantr().withContext(mockContext);

    expect(guantr.context).toEqual(mockContext);
  });

  test('setPermission method should add permission to permissions array', () => {
    const guantr = createGuantr<MockMeta>()
    guantr.setPermission((can) => {
      can('read', 'post');
    });

    expect(guantr.permissions).toContainEqual({
      action: 'read',
      resource: 'post',
      condition: null,
      inverted: false
    })
  });

  test('setPermission method should replace existing permissions', () => {
    const guantr = createGuantr<MockMeta>()
    guantr.setPermissions([{
      action: 'read',
      resource: 'post',
      condition: null,
      inverted: false
    }]);
    guantr.setPermission(() => {});

    expect(guantr.permissions).toEqual([])
  });

  test('setPermissions method should add permission to permissions array', () => {
    const guantr = createGuantr<MockMeta>()
    
    const permissions: GuantrPermission<MockMeta>[] = [{
      action: 'create',
      resource: 'post',
      condition: null,
      inverted: false
    }]
    
    guantr.setPermissions(permissions);

    expect(guantr.permissions).toEqual(permissions)
  });

  test('setPermissions method should replace existing permissions', () => {
    const guantr = createGuantr<MockMeta>()
    guantr.setPermission((can) => {
      can('read', ['post', { id: ['equals', 1] }]);
    });

    const newPermissions: GuantrPermission<MockMeta>[] = [
      {
        action: 'create',
        resource: 'post',
        condition: null,
        inverted: false
      },
      {
        action: 'create',
        resource: 'post',
        condition: { title: ['startsWith', 'ANNOUNCEMENT:'] },
        inverted: true
      }
    ];

    guantr.setPermissions(newPermissions);

    expect(guantr.permissions).toEqual(newPermissions);
  });
});

describe('Guantr.can', () => {
  it('should return true if user has permission', () => {
    const guantr = createGuantr<MockMeta>()
    guantr.setPermissions([{
      action: 'read',
      resource: 'post',
      condition: null,
      inverted: false
    }]);

    expect(guantr.can('read', 'post')).toBe(true);
  });

  it('should return false if user does not have permission', () => {
    const guantr = createGuantr<MockMeta>()
    guantr.setPermissions([]);

    expect(guantr.can('read', 'post')).toBe(false);
  });

  it('should return false if resource or action not found in permissions', () => {
    const guantr = createGuantr<MockMeta>()
    guantr.setPermissions([{
      action: 'delete',
      resource: 'post',
      condition: null,
      inverted: false
    }]);

    expect(guantr.can('create', 'post')).toBe(false);
  });

  it('should return false if user has inverted permission', () => {
    const guantr = createGuantr<MockMeta>()
    guantr.setPermissions([{
      action: 'delete',
      resource: 'post',
      condition: null,
      inverted: true
    }]);

    expect(guantr.can('delete', 'post')).toBe(false);
  });

  it('should handle inverted rule correctly', () => {
    const guantr = createGuantr<MockMeta>()
    guantr.setPermissions([
      {
        resource: 'post',
        action: 'read',
        condition: null,
        inverted: false
      },
      {
        resource: 'post',
        action: 'read',
        condition: {
          published: ['equals', false]
        },
        inverted: true
      }
    ])
    
    expect(guantr.can('read', 'post')).toBe(true)
    const post = {
      id: 1,
      title: 'Hello World',
      description: '',
      lastUpdatedAt: null,
      tags: []
    }
    expect(guantr.can('read', ['post', { ...post, published: true }])).toBe(true)
    expect(guantr.can('read', ['post', { ...post, published: false }])).toBe(false)
  })
})

