import { describe, expect, it } from 'vitest';
import { createGuantr, Guantr } from '../../src/index';

describe('Rule lifecycle: setRules / getRules / relatedRulesFor', () => {
  // -------------------------------------------------------------------------
  // setRules
  // -------------------------------------------------------------------------
  it('setRules method should add rule to rules array (array form)', async () => {
    const guantr = await createGuantr();
    await guantr.setRules([{ effect: 'allow', action: 'read', resource: 'post', condition: null }]);
    const rules = await guantr.getRules();
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({ effect: 'allow', action: 'read', resource: 'post' });
  });

  it('setRules method should replace existing rules (array form)', async () => {
    const guantr = await createGuantr();
    await guantr.setRules([{ effect: 'allow', action: 'read', resource: 'post', condition: null }]);
    await guantr.setRules([
      { effect: 'deny', action: 'delete', resource: 'post', condition: null },
    ]);
    const rules = await guantr.getRules();
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({ effect: 'deny', action: 'delete', resource: 'post' });
  });

  it('setRules method should clear existing rules (array form)', async () => {
    const guantr = await createGuantr();
    await guantr.setRules([{ effect: 'allow', action: 'read', resource: 'post', condition: null }]);
    await guantr.setRules([]);
    const rules = await guantr.getRules();
    expect(rules).toHaveLength(0);
  });

  it('setRules with callback should add rules', async () => {
    const guantr = await createGuantr();
    await guantr.setRules((allow, deny) => {
      allow('read', 'post');
      deny('delete', ['post', { status: ['eq', 'archived'] }]);
    });
    const rules = await guantr.getRules();
    expect(rules).toHaveLength(2);
  });

  it('setRules callback should capture rules defined after await', async () => {
    const guantr = await createGuantr();
    await guantr.setRules(async (allow, deny) => {
      await Promise.resolve();
      allow('read', 'post');
      deny('delete', ['post', { published: ['eq', true] }]);
    });
    const rules = await guantr.getRules();
    expect(rules).toHaveLength(2);
  });

  it('setRules callback with conditions', async () => {
    const guantr = await createGuantr();
    await guantr.setRules((allow) => {
      allow('read', 'post');
      allow('read', ['post', { published: ['eq', true] }]);
    });
    const rules = await guantr.getRules();
    expect(rules).toHaveLength(2);
  });

  // -------------------------------------------------------------------------
  // getRules
  // -------------------------------------------------------------------------
  it('getRules returns empty array when no rules set', async () => {
    const guantr = await createGuantr();
    const rules = await guantr.getRules();
    expect(rules).toHaveLength(0);
  });

  it('getRules returns all stored rules', async () => {
    const guantr = await createGuantr();
    await guantr.setRules([
      { effect: 'allow', action: 'read', resource: 'post', condition: null },
      { effect: 'deny', action: 'delete', resource: 'post', condition: null },
    ]);
    const rules = await guantr.getRules();
    expect(rules).toHaveLength(2);
  });

  // -------------------------------------------------------------------------
  // relatedRulesFor
  // -------------------------------------------------------------------------
  it('relatedRulesFor filters by action+resource and returns rules', async () => {
    const guantr = await createGuantr();
    await guantr.setRules((allow) => {
      allow('read', 'post');
      allow('read', ['post', { published: ['eq', true] }]);
      allow('read', 'user');
    });
    const filtered = await guantr.relatedRulesFor('read', 'post');
    expect(filtered).toHaveLength(2);
    expect(filtered.every((r) => r.action === 'read' && r.resource === 'post')).toBe(true);
  });

  it('relatedRulesFor without options returns rules without contextual operands', async () => {
    const guantr = await createGuantr({
      getContext: () => ({ userId: 1 }),
    });
    await guantr.setRules([
      {
        effect: 'allow',
        action: 'read',
        resource: 'post',
        condition: { authorId: ['eq', '$ctx.userId'] },
      },
    ]);
    const rules = await guantr.relatedRulesFor('read', 'post');
    expect(rules).toHaveLength(1);
    // Without applyConditionContextualOperands, $ctx.userId is NOT resolved
    expect(JSON.stringify(rules[0].condition)).toContain('$ctx.userId');
  });

  it('relatedRulesFor with applyConditionContextualOperands resolves $ctx operands', async () => {
    const guantr = await createGuantr({
      getContext: () => ({ userId: 42 }),
    });
    await guantr.setRules([
      {
        effect: 'allow',
        action: 'read',
        resource: 'post',
        condition: { authorId: ['eq', '$ctx.userId'] },
      },
    ]);
    const rules = await guantr.relatedRulesFor('read', 'post', {
      applyConditionContextualOperands: true,
    });
    expect(rules).toHaveLength(1);
    // With applyConditionContextualOperands, $ctx.userId is resolved to 42
    expect(JSON.stringify(rules[0].condition)).toContain('42');
  });

  // -------------------------------------------------------------------------
  // maxRuleIterations validation
  // -------------------------------------------------------------------------
  it('throws TypeError when maxRuleIterations is not a positive integer', () => {
    expect(() => new Guantr({ maxRuleIterations: 0 })).toThrow(TypeError);
    expect(() => new Guantr({ maxRuleIterations: -1 })).toThrow(TypeError);
    expect(() => new Guantr({ maxRuleIterations: 1.5 })).toThrow(TypeError);
    expect(() => new Guantr({ maxRuleIterations: NaN })).toThrow(TypeError);
  });
});
