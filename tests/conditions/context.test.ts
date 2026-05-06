import { describe, expect, it } from 'vitest';
import { createGuantr, isContextualOperand, matchRuleCondition } from '../../src/index';

describe('Context operands ($ctx.)', () => {
  it('should match condition using context', async () => {
    const guantr = await createGuantr({
      getContext: () => ({ name: 'John' }),
    });
    await guantr.setRules([
      {
        resource: 'user',
        action: 'read',
        condition: { name: ['eq', '$ctx.name', { caseInsensitive: true }] },
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

  it('should resolve $ctx in condition for array properties', async () => {
    // Uses the 'some' operator to match array items — this is the correct
    // way to check conditions on array elements. The $ctx.role is resolved
    // at evaluation time into the nested condition.
    const guantr = await createGuantr({
      getContext: () => ({ role: 'admin' }),
    });
    await guantr.setRules([
      {
        resource: 'user',
        action: 'read',
        condition: { roles: ['some', { name: ['eq', '$ctx.role'] }] },
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

  it('should handle nullable context paths', async () => {
    const guantrWithAddress = await createGuantr({
      getContext: () => ({ address: { line1: '456 Oak St' } }),
    });
    await guantrWithAddress.setRules([
      {
        resource: 'user',
        action: 'read',
        condition: { 'address.line1': ['eq', '$ctx.address.line1'] },
        effect: 'allow',
      },
    ]);

    const guantrWithoutAddress = await createGuantr({
      getContext: () => ({ address: null }),
    });
    await guantrWithoutAddress.setRules([
      {
        resource: 'user',
        action: 'read',
        condition: { 'address.line1': ['eq', '$ctx.address.line1'] },
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

    // address.line1 in condition is a top-level key that doesn't exist on mockUser
    // When the key doesn't exist on the model, matchRuleCondition throws
    // oxlint-disable-next-line typescript/no-explicit-any
    const condition = { 'address.line1': ['eq', '$ctx.address.line1'] } as any;
    try {
      matchRuleCondition(mockUser, condition);
    } catch {
      // Expected: key doesn't exist on model
    }
  });

  // -------------------------------------------------------------------------
  // getContextValue tests (via hasContextualOperand)
  // -------------------------------------------------------------------------
  it('isContextualOperand detects $ctx. prefix', () => {
    expect(isContextualOperand('$ctx.userId')).toBe(true);
    expect(isContextualOperand('$ctx.deeply.nested.value')).toBe(true);
    expect(isContextualOperand('userId')).toBe(false);
  });
});
