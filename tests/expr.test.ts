import { describe, expect, it } from 'vitest';
import { createGuantr } from '../src/index';
import { matchRuleCondition } from '../src/utils';

type Post = {
  id: number;
  tags: string[];
  comments: { authorId: number; body: string; approved: boolean }[];
};

describe('$expr integration tests', () => {
  // -------------------------------------------------------------------------
  // Case 1: $expr ['some', ...] — integration test, true when at least one matches
  // -------------------------------------------------------------------------
  it("evaluates $expr ['some', ...] as true when at least one comment is approved (integration)", async () => {
    const guantr = await createGuantr();
    await guantr.setRules([
      {
        resource: 'post',
        action: 'read',
        condition: {
          comments: { $expr: ['some', { approved: ['eq', true] }] },
        } as any,
        effect: 'allow',
      },
    ]);

    const post: Record<string, unknown> = {
      id: 1,
      tags: ['typescript'],
      comments: [
        { authorId: 1, body: 'Great post!', approved: true },
        { authorId: 2, body: 'Needs work', approved: false },
      ],
    };

    expect(await guantr.can('read', ['post', post])).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Case 2: $expr ['some', ...] — integration test, false when none match
  // -------------------------------------------------------------------------
  it("evaluates $expr ['some', { approved: ['eq', false] }] as false when all comments are approved (integration)", async () => {
    const guantr = await createGuantr();
    await guantr.setRules([
      {
        resource: 'post',
        action: 'read',
        condition: {
          comments: { $expr: ['some', { approved: ['eq', false] }] },
        } as any,
        effect: 'allow',
      },
    ]);

    const post: Record<string, unknown> = {
      id: 1,
      tags: [],
      comments: [
        { authorId: 1, body: 'Great post!', approved: true },
        { authorId: 2, body: 'Excellent!', approved: true },
      ],
    };

    expect(await guantr.can('read', ['post', post])).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Case 3: $expr ['every', ...] — true when all approved, false when not all
  // -------------------------------------------------------------------------
  it("evaluates $expr ['every', ...] as true when all comments are approved", () => {
    const post: Post = {
      id: 1,
      tags: [],
      comments: [
        { authorId: 1, body: 'Great!', approved: true },
        { authorId: 2, body: 'Excellent!', approved: true },
      ],
    };

    expect(
      matchRuleCondition(post as Record<string, unknown>, {
        comments: { $expr: ['every', { approved: ['eq', true] }] } as any,
      }),
    ).toBe(true);
  });

  it("evaluates $expr ['every', ...] as false when not all comments are approved", () => {
    const post: Post = {
      id: 1,
      tags: [],
      comments: [
        { authorId: 1, body: 'Great!', approved: true },
        { authorId: 2, body: 'Needs work', approved: false },
      ],
    };

    expect(
      matchRuleCondition(post as Record<string, unknown>, {
        comments: { $expr: ['every', { approved: ['eq', true] }] } as any,
      }),
    ).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Case 4: $expr ['none', ...] — true when no unapproved, false when some unapproved
  // -------------------------------------------------------------------------
  it("evaluates $expr ['none', ...] as true when no comment is unapproved", () => {
    const post: Post = {
      id: 1,
      tags: [],
      comments: [
        { authorId: 1, body: 'Great!', approved: true },
        { authorId: 2, body: 'Excellent!', approved: true },
      ],
    };

    expect(
      matchRuleCondition(post as Record<string, unknown>, {
        comments: { $expr: ['none', { approved: ['eq', false] }] } as any,
      }),
    ).toBe(true);
  });

  it("evaluates $expr ['none', ...] as false when some comment is unapproved", () => {
    const post: Post = {
      id: 1,
      tags: [],
      comments: [
        { authorId: 1, body: 'Great!', approved: true },
        { authorId: 2, body: 'Needs work', approved: false },
      ],
    };

    expect(
      matchRuleCondition(post as Record<string, unknown>, {
        comments: { $expr: ['none', { approved: ['eq', false] }] } as any,
      }),
    ).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Case 5: combined { length, $expr } — all three sub-cases
  // -------------------------------------------------------------------------
  it('evaluates combined { length, $expr } as true when length matches and every comment is approved', () => {
    const post: Post = {
      id: 1,
      tags: [],
      comments: [
        { authorId: 1, body: 'Great!', approved: true },
        { authorId: 2, body: 'Excellent!', approved: true },
      ],
    };

    expect(
      matchRuleCondition(post as Record<string, unknown>, {
        comments: {
          length: ['eq', 2],
          $expr: ['every', { approved: ['eq', true] }],
        } as any,
      }),
    ).toBe(true);
  });

  it('evaluates combined { length, $expr } as false when length matches but $expr fails', () => {
    const post: Post = {
      id: 1,
      tags: [],
      comments: [
        { authorId: 1, body: 'Great!', approved: true },
        { authorId: 2, body: 'Needs work', approved: false },
      ],
    };

    expect(
      matchRuleCondition(post as Record<string, unknown>, {
        comments: {
          length: ['eq', 2],
          $expr: ['every', { approved: ['eq', true] }],
        } as any,
      }),
    ).toBe(false);
  });

  it('evaluates combined { length, $expr } as false when length fails (3 items, expected 2)', () => {
    const post: Post = {
      id: 1,
      tags: [],
      comments: [
        { authorId: 1, body: 'Great!', approved: true },
        { authorId: 2, body: 'Excellent!', approved: true },
        { authorId: 3, body: 'Nice!', approved: true },
      ],
    };

    expect(
      matchRuleCondition(post as Record<string, unknown>, {
        comments: {
          length: ['eq', 2],
          $expr: ['every', { approved: ['eq', true] }],
        } as any,
      }),
    ).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Case 6: $expr ['hasSome', ...] on a string array
  // -------------------------------------------------------------------------
  it("evaluates $expr ['hasSome', ...] as true when tags has some matching values", () => {
    const post: Post = {
      id: 1,
      tags: ['typescript', 'testing'],
      comments: [],
    };

    expect(
      matchRuleCondition(post as Record<string, unknown>, {
        tags: { $expr: ['hasSome', ['typescript', 'javascript']] } as any,
      }),
    ).toBe(true);
  });

  it("evaluates $expr ['hasSome', ...] as false when tags has no matching values", () => {
    const post: Post = {
      id: 1,
      tags: ['python', 'rust'],
      comments: [],
    };

    expect(
      matchRuleCondition(post as Record<string, unknown>, {
        tags: { $expr: ['hasSome', ['typescript', 'javascript']] } as any,
      }),
    ).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Case 7: $expr ['has', ...] on a string array
  // -------------------------------------------------------------------------
  it("evaluates $expr ['has', 'typescript'] as true when tags contains 'typescript'", () => {
    const post: Post = {
      id: 1,
      tags: ['typescript', 'testing'],
      comments: [],
    };

    expect(
      matchRuleCondition(post as Record<string, unknown>, {
        tags: { $expr: ['has', 'typescript'] } as any,
      }),
    ).toBe(true);
  });

  it("evaluates $expr ['has', 'typescript'] as false when tags does not contain 'typescript'", () => {
    const post: Post = {
      id: 1,
      tags: ['python', 'rust'],
      comments: [],
    };

    expect(
      matchRuleCondition(post as Record<string, unknown>, {
        tags: { $expr: ['has', 'typescript'] } as any,
      }),
    ).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Case 8: $expr ['hasEvery', ...] on a string array
  // -------------------------------------------------------------------------
  it("evaluates $expr ['hasEvery', ...] as true when tags contains all specified values", () => {
    const post: Post = {
      id: 1,
      tags: ['typescript', 'testing', 'javascript'],
      comments: [],
    };

    expect(
      matchRuleCondition(post as Record<string, unknown>, {
        tags: { $expr: ['hasEvery', ['typescript', 'testing']] } as any,
      }),
    ).toBe(true);
  });

  it("evaluates $expr ['hasEvery', ...] as false when tags is missing one of the specified values", () => {
    const post: Post = {
      id: 1,
      tags: ['typescript', 'javascript'],
      comments: [],
    };

    expect(
      matchRuleCondition(post as Record<string, unknown>, {
        tags: { $expr: ['hasEvery', ['typescript', 'testing']] } as any,
      }),
    ).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Case 9: invalid $expr (non-array plain string) → isValidConditionExpression fails → false
  // -------------------------------------------------------------------------
  it('evaluates an invalid $expr (plain string instead of array) as false', () => {
    const post: Post = {
      id: 1,
      tags: ['typescript'],
      comments: [{ authorId: 1, body: 'Great!', approved: true }],
    };

    expect(
      matchRuleCondition(post as Record<string, unknown>, {
        comments: { $expr: 'some' as any } as any,
      }),
    ).toBe(false);
  });
});
