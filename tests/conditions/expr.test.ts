import { describe, expect, it } from 'vitest';
import { createGuantr } from '../../src/index';
import { matchRuleCondition } from '../../src/utils';

describe('$expr integration tests', () => {
  it("evaluates $expr ['some', ...] as true when at least one comment is approved", async () => {
    const guantr = await createGuantr();
    await guantr.setRules([
      {
        resource: 'post',
        action: 'read',
        condition: { comments: { $expr: ['some', { approved: ['eq', true] }] } },
        effect: 'allow',
      },
    ]);
    const post = {
      id: 1,
      tags: ['typescript'],
      comments: [
        { authorId: 1, body: 'Great post!', approved: true },
        { authorId: 2, body: 'Needs work', approved: false },
      ],
    };
    expect(await guantr.can('read', ['post', post])).toBe(true);
  });

  it("evaluates $expr ['some', ...] as false when none match", async () => {
    const guantr = await createGuantr();
    await guantr.setRules([
      {
        resource: 'post',
        action: 'read',
        condition: { comments: { $expr: ['some', { approved: ['eq', false] }] } },
        effect: 'allow',
      },
    ]);
    const post = {
      id: 1,
      tags: [],
      comments: [
        { authorId: 1, body: 'Great post!', approved: true },
        { authorId: 2, body: 'Excellent!', approved: true },
      ],
    };
    expect(await guantr.can('read', ['post', post])).toBe(false);
  });

  it("evaluates $expr ['every', ...] as true when all comments are approved", () => {
    expect(
      matchRuleCondition(
        {
          id: 1,
          tags: [],
          comments: [
            { authorId: 1, body: 'Great!', approved: true },
            { authorId: 2, body: 'Excellent!', approved: true },
          ],
        },
        { comments: { $expr: ['every', { approved: ['eq', true] }] } },
      ),
    ).toBe(true);
  });

  it("evaluates $expr ['every', ...] as false when not all comments are approved", () => {
    expect(
      matchRuleCondition(
        {
          id: 1,
          tags: [],
          comments: [
            { authorId: 1, body: 'Great!', approved: true },
            { authorId: 2, body: 'Needs work', approved: false },
          ],
        },
        { comments: { $expr: ['every', { approved: ['eq', true] }] } },
      ),
    ).toBe(false);
  });

  it("evaluates $expr ['none', ...] as true when no comment is unapproved", () => {
    expect(
      matchRuleCondition(
        {
          id: 1,
          tags: [],
          comments: [
            { authorId: 1, body: 'Great!', approved: true },
            { authorId: 2, body: 'Excellent!', approved: true },
          ],
        },
        { comments: { $expr: ['none', { approved: ['eq', false] }] } },
      ),
    ).toBe(true);
  });

  it("evaluates $expr ['none', ...] as false when some comment is unapproved", () => {
    expect(
      matchRuleCondition(
        {
          id: 1,
          tags: [],
          comments: [
            { authorId: 1, body: 'Great!', approved: true },
            { authorId: 2, body: 'Needs work', approved: false },
          ],
        },
        { comments: { $expr: ['none', { approved: ['eq', false] }] } },
      ),
    ).toBe(false);
  });

  it('evaluates combined { length, $expr } as true when length matches and every comment is approved', () => {
    expect(
      matchRuleCondition(
        {
          id: 1,
          tags: [],
          comments: [
            { authorId: 1, body: 'Great!', approved: true },
            { authorId: 2, body: 'Excellent!', approved: true },
          ],
        },
        { comments: { length: ['eq', 2], $expr: ['every', { approved: ['eq', true] }] } },
      ),
    ).toBe(true);
  });

  it('evaluates combined { length, $expr } as false when length matches but $expr fails', () => {
    expect(
      matchRuleCondition(
        {
          id: 1,
          tags: [],
          comments: [
            { authorId: 1, body: 'Great!', approved: true },
            { authorId: 2, body: 'Needs work', approved: false },
          ],
        },
        { comments: { length: ['eq', 2], $expr: ['every', { approved: ['eq', true] }] } },
      ),
    ).toBe(false);
  });

  it('evaluates combined { length, $expr } as false when length fails', () => {
    expect(
      matchRuleCondition(
        {
          id: 1,
          tags: [],
          comments: [
            { authorId: 1, body: 'Great!', approved: true },
            { authorId: 2, body: 'Excellent!', approved: true },
            { authorId: 3, body: 'Nice!', approved: true },
          ],
        },
        { comments: { length: ['eq', 2], $expr: ['every', { approved: ['eq', true] }] } },
      ),
    ).toBe(false);
  });

  it("evaluates $expr ['hasSome', ...] as true when tags has some matching values", () => {
    expect(
      matchRuleCondition(
        { id: 1, tags: ['typescript', 'testing'], comments: [] },
        { tags: { $expr: ['hasSome', ['typescript', 'javascript']] } },
      ),
    ).toBe(true);
  });

  it("evaluates $expr ['hasSome', ...] as false when tags has no matching values", () => {
    expect(
      matchRuleCondition(
        { id: 1, tags: ['python', 'rust'], comments: [] },
        { tags: { $expr: ['hasSome', ['typescript', 'javascript']] } },
      ),
    ).toBe(false);
  });

  it("evaluates $expr ['has', 'typescript'] as true when tags contains 'typescript'", () => {
    expect(
      matchRuleCondition(
        { id: 1, tags: ['typescript', 'testing'], comments: [] },
        { tags: { $expr: ['has', 'typescript'] } },
      ),
    ).toBe(true);
  });

  it("evaluates $expr ['has', 'typescript'] as false when tags does not contain 'typescript'", () => {
    expect(
      matchRuleCondition(
        { id: 1, tags: ['python', 'rust'], comments: [] },
        { tags: { $expr: ['has', 'typescript'] } },
      ),
    ).toBe(false);
  });

  it("evaluates $expr ['hasEvery', ...] as true when tags contains all specified values", () => {
    expect(
      matchRuleCondition(
        { id: 1, tags: ['typescript', 'testing', 'javascript'], comments: [] },
        { tags: { $expr: ['hasEvery', ['typescript', 'testing']] } },
      ),
    ).toBe(true);
  });

  it("evaluates $expr ['hasEvery', ...] as false when tags is missing one value", () => {
    expect(
      matchRuleCondition(
        { id: 1, tags: ['typescript', 'javascript'], comments: [] },
        { tags: { $expr: ['hasEvery', ['typescript', 'testing']] } },
      ),
    ).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Deeply nested some inside some (from playground 05)
  // ---------------------------------------------------------------------------
  it('deeply nested some inside some: engineering > frontend > member with react skill', () => {
    const complex = {
      groups: [
        {
          name: 'admins',
          users: [
            { id: 1, active: true },
            { id: 2, active: false },
          ],
        },
        {
          name: 'editors',
          users: [{ id: 3, active: true }],
        },
      ],
    };
    expect(
      matchRuleCondition(complex, {
        groups: ['some', { name: ['eq', 'admins'], users: ['some', { id: ['eq', 1] }] }],
      }),
    ).toBe(true);
  });

  it('deeply nested some with nested every: not all admins users are active', () => {
    const complex = {
      groups: [
        {
          name: 'admins',
          users: [
            { id: 1, active: true },
            { id: 2, active: false },
          ],
        },
        {
          name: 'editors',
          users: [{ id: 3, active: true }],
        },
      ],
    };
    expect(
      matchRuleCondition(complex, {
        groups: ['some', { name: ['eq', 'admins'], users: ['every', { active: ['eq', true] }] }],
      }),
    ).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Empty array edge cases
  // ---------------------------------------------------------------------------
  it('some on empty array returns false', () => {
    expect(matchRuleCondition({ items: [] }, { items: ['some', { x: ['eq', 1] }] })).toBe(false);
  });

  it('every on empty array returns false', () => {
    expect(matchRuleCondition({ items: [] }, { items: ['every', { x: ['eq', 1] }] })).toBe(false);
  });

  it('none on empty array returns true', () => {
    expect(matchRuleCondition({ items: [] }, { items: ['none', { x: ['eq', 1] }] })).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Invalid $expr
  // ---------------------------------------------------------------------------
  it('evaluates an invalid $expr (plain string instead of array) as false', () => {
    // as any needed because we intentionally pass a string where an array
    // expression is expected to test runtime fallback behavior
    // oxlint-disable-next-line typescript/no-explicit-any
    const condition = { comments: { $expr: 'some' as any } } as any;
    expect(
      matchRuleCondition(
        {
          id: 1,
          tags: ['typescript'],
          comments: [{ authorId: 1, body: 'Great!', approved: true }],
        },
        condition,
      ),
    ).toBe(false);
  });
});
