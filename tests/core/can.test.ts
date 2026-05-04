import { describe, expect, it } from 'vitest';
import { createGuantr, Guantr, GuantrCircuitBreakerError } from '../../src/index';

describe('Guantr.can', () => {
  it('should be able to match condition for nested resource condition', async () => {
    const guantr = await createGuantr();
    await guantr.setRules([
      {
        resource: 'user',
        action: 'read',
        condition: { address: { country: ['eq', 'US', { caseInsensitive: true }] } },
        effect: 'allow',
      },
    ]);
    const mockUser = {
      id: 1,
      name: 'John',
      suspended: false,
      roles: [{ id: 1, name: 'admin' }],
      address: { line1: '123 Main St', city: 'Anytown', state: 'NY', zip: '12345', country: 'US' },
    };
    expect(await guantr.can('read', ['user', mockUser])).toBe(true);
  });

  it('should be able to match condition of array', async () => {
    // Uses the 'some' operator to check conditions on array items — this
    // is the correct pattern for matching array element properties.
    const guantr = await createGuantr();
    await guantr.setRules([
      {
        resource: 'user',
        action: 'read',
        condition: { roles: ['some', { name: ['eq', 'admin'] }] },
        effect: 'allow',
      },
    ]);
    const mockUser = {
      id: 1,
      name: 'John',
      suspended: false,
      roles: [{ id: 1, name: 'admin' }],
      address: { line1: '123 Main St', city: 'Anytown', state: 'NY', zip: '12345', country: 'US' },
    };
    expect(await guantr.can('read', ['user', mockUser])).toBe(true);
  });

  it('should be able to match condition for array length check', async () => {
    const guantr = await createGuantr();
    await guantr.setRules([
      {
        resource: 'user',
        action: 'read',
        condition: { roles: { length: ['gte', 1] } },
        effect: 'allow',
      },
    ]);
    const mockUser = {
      id: 1,
      name: 'John',
      suspended: false,
      roles: [{ id: 1, name: 'admin' }],
      address: { line1: '123 Main St', city: 'Anytown', state: 'NY', zip: '12345', country: 'US' },
    };
    expect(await guantr.can('read', ['user', mockUser])).toBe(true);
  });

  it('should be able to match condition for array length check with expression', async () => {
    const guantr = await createGuantr();
    await guantr.setRules([
      {
        resource: 'user',
        action: 'read',
        condition: { roles: { length: ['gte', 1], $expr: ['some', { name: ['eq', 'admin'] }] } },
        effect: 'allow',
      },
    ]);
    const mockUser = {
      id: 1,
      name: 'John',
      suspended: false,
      roles: [{ id: 1, name: 'admin' }],
      address: { line1: '123 Main St', city: 'Anytown', state: 'NY', zip: '12345', country: 'US' },
    };
    expect(await guantr.can('read', ['user', mockUser])).toBe(true);
  });

  it('should return false if user does not have rule (abstract)', async () => {
    const guantr = await createGuantr();
    expect(await guantr.can('read', ['post', { id: 1 }])).toBe(false);
  });

  it('should return false if resource or action not found in rules', async () => {
    const guantr = await createGuantr();
    await guantr.setRules([{ effect: 'allow', action: 'read', resource: 'post', condition: null }]);
    expect(await guantr.can('delete', ['post', { id: 1 }])).toBe(false);
  });

  it('should handle circuit breaker in can method', async () => {
    const guantr = new Guantr({ maxRuleIterations: 1 });
    await guantr.setRules([
      { effect: 'allow', action: 'read', resource: 'post', condition: null },
      { effect: 'allow', action: 'read', resource: 'post', condition: { title: ['eq', 'Test'] } },
    ]);
    const post = {
      id: 1,
      title: 'Test',
      description: '...',
      lastUpdatedAt: new Date(),
      tags: ['a'],
    };
    await expect(guantr.can('read', ['post', post])).rejects.toThrow(GuantrCircuitBreakerError);
  });

  it('should handle overlapping rules: general -> specific', async () => {
    const guantr = await createGuantr();
    await guantr.setRules([
      { effect: 'allow', action: 'read', resource: 'post', condition: null },
      { effect: 'deny', action: 'read', resource: 'post', condition: { published: ['eq', true] } },
    ]);
    const post = { id: 1, title: 'Test', published: true };
    expect(await guantr.can('read', ['post', post])).toBe(false);
  });

  it('should handle overlapping rules: specific -> general', async () => {
    const guantr = await createGuantr();
    await guantr.setRules([
      { effect: 'deny', action: 'read', resource: 'post', condition: { published: ['eq', true] } },
      { effect: 'allow', action: 'read', resource: 'post', condition: null },
    ]);
    const post = { id: 1, title: 'Test', published: true };
    // Deny rule overrides allow for published posts
    expect(await guantr.can('read', ['post', post])).toBe(false);
  });

  it('should handle overlapping rules: general -> specific-inverted', async () => {
    const guantr = await createGuantr();
    await guantr.setRules([
      { effect: 'allow', action: 'read', resource: 'post', condition: null },
      { effect: 'deny', action: 'read', resource: 'post', condition: { published: ['eq', false] } },
    ]);
    const publishedPost = { id: 1, title: 'Test', published: true };
    const draftPost = { id: 2, title: 'Draft', published: false };
    expect(await guantr.can('read', ['post', publishedPost])).toBe(true);
    expect(await guantr.can('read', ['post', draftPost])).toBe(false);
  });

  it('should handle overlapping rules: specific-inverted -> general', async () => {
    const guantr = await createGuantr();
    await guantr.setRules([
      { effect: 'deny', action: 'read', resource: 'post', condition: { published: ['eq', false] } },
      { effect: 'allow', action: 'read', resource: 'post', condition: null },
    ]);
    const publishedPost = { id: 1, title: 'Test', published: true };
    const draftPost = { id: 2, title: 'Draft', published: false };
    expect(await guantr.can('read', ['post', publishedPost])).toBe(true);
    expect(await guantr.can('read', ['post', draftPost])).toBe(false);
  });

  it('should handle overlapping rules: general-inverted -> specific-inverted', async () => {
    // Unconditional deny causes early exit — no rule can override it
    const guantr = await createGuantr();
    await guantr.setRules([
      { effect: 'deny', action: 'read', resource: 'post', condition: null },
      {
        effect: 'allow',
        action: 'read',
        resource: 'post',
        condition: { published: ['eq', false] },
      },
    ]);
    const publishedPost = { id: 1, title: 'Test', published: true };
    const draftPost = { id: 2, title: 'Draft', published: false };
    expect(await guantr.can('read', ['post', publishedPost])).toBe(false);
    expect(await guantr.can('read', ['post', draftPost])).toBe(false);
  });

  it('should handle overlapping rules: specific-inverted -> general-inverted', async () => {
    // Unconditional deny causes early exit — no rule can override it
    const guantr = await createGuantr();
    await guantr.setRules([
      {
        effect: 'allow',
        action: 'read',
        resource: 'post',
        condition: { published: ['eq', false] },
      },
      { effect: 'deny', action: 'read', resource: 'post', condition: null },
    ]);
    const publishedPost = { id: 1, title: 'Test', published: true };
    const draftPost = { id: 2, title: 'Draft', published: false };
    expect(await guantr.can('read', ['post', publishedPost])).toBe(false);
    expect(await guantr.can('read', ['post', draftPost])).toBe(false);
  });

  it('should handle overlapping rules: general-inverted -> specific', async () => {
    // Unconditional deny causes early exit — no rule can override it
    const guantr = await createGuantr();
    await guantr.setRules([
      { effect: 'deny', action: 'read', resource: 'post', condition: null },
      { effect: 'allow', action: 'read', resource: 'post', condition: { published: ['eq', true] } },
    ]);
    const publishedPost = { id: 1, title: 'Test', published: true };
    const draftPost = { id: 2, title: 'Draft', published: false };
    expect(await guantr.can('read', ['post', publishedPost])).toBe(false);
    expect(await guantr.can('read', ['post', draftPost])).toBe(false);
  });

  it('should handle overlapping rules: specific -> general-inverted', async () => {
    // Unconditional deny causes early exit — no rule can override it
    const guantr = await createGuantr();
    await guantr.setRules([
      { effect: 'allow', action: 'read', resource: 'post', condition: { published: ['eq', true] } },
      { effect: 'deny', action: 'read', resource: 'post', condition: null },
    ]);
    const publishedPost = { id: 1, title: 'Test', published: true };
    const draftPost = { id: 2, title: 'Draft', published: false };
    expect(await guantr.can('read', ['post', publishedPost])).toBe(false);
    expect(await guantr.can('read', ['post', draftPost])).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Circuit breaker with many rules (from playground)
  // -------------------------------------------------------------------------
  it('throws circuit breaker with many rules exceeding maxRuleIterations', async () => {
    const guantr = new Guantr({ maxRuleIterations: 50 });
    const manyRules: Array<{
      effect: 'allow';
      action: string;
      resource: string;
      condition: { id: ['eq', number] };
    }> = [];
    for (let i = 0; i < 51; i++) {
      manyRules.push({
        effect: 'allow',
        action: 'read',
        resource: 'post',
        condition: { id: ['eq', i] },
      });
    }
    await guantr.setRules(manyRules);
    await expect(guantr.can('read', ['post', { id: 999 }])).rejects.toThrow(
      GuantrCircuitBreakerError,
    );
  });

  // -------------------------------------------------------------------------
  // RBAC scenario (from playground 07-advanced)
  // -------------------------------------------------------------------------
  it('RBAC: admin can read published but not delete published (deny override)', async () => {
    const guantr = await createGuantr({
      getContext: () => ({ userId: 1, userRole: 'admin', isAuthenticated: true }),
    });
    await guantr.setRules([
      { effect: 'allow', action: 'read', resource: 'post', condition: null },
      { effect: 'allow', action: 'create', resource: 'post', condition: null },
      {
        effect: 'allow',
        action: 'delete',
        resource: 'post',
        condition: { authorId: ['eq', '$ctx.userId'] },
      },
      {
        effect: 'deny',
        action: 'delete',
        resource: 'post',
        condition: { status: ['eq', 'published'] },
      },
    ]);

    const publishedPost = { id: 1, title: 'Published', status: 'published', authorId: 1 };

    expect(await guantr.can('read', ['post', publishedPost])).toBe(true);
    expect(await guantr.can('create', ['post', publishedPost])).toBe(true);
    // Deny override for published posts
    expect(await guantr.can('delete', ['post', publishedPost])).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Multi-tenant scenario (from playground 07-advanced)
  // -------------------------------------------------------------------------
  it('multi-tenant: users can only access projects in their tenant', async () => {
    const guantr = await createGuantr({
      getContext: () => ({ userId: 1, tenantId: 5, role: 'owner' as const }),
    });
    await guantr.setRules([
      {
        effect: 'allow',
        action: 'read',
        resource: 'project',
        condition: { tenantId: ['eq', '$ctx.tenantId'] },
      },
      {
        effect: 'allow',
        action: 'delete',
        resource: 'project',
        condition: { ownerId: ['eq', '$ctx.userId'], tenantId: ['eq', '$ctx.tenantId'] },
      },
    ]);

    const myProject = { id: 1, tenantId: 5, name: 'My Project', ownerId: 1 };
    const otherProject = { id: 2, tenantId: 99, name: 'Other', ownerId: 2 };

    expect(await guantr.can('read', ['project', myProject])).toBe(true);
    expect(await guantr.can('read', ['project', otherProject])).toBe(false);
    expect(await guantr.can('delete', ['project', myProject])).toBe(true);
  });
});
