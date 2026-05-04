import { describe, expect, it } from 'vitest';
import {
  createGuantr,
  GuantrInvalidConditionError,
  GuantrInvalidConditionOperatorError,
  Guantr,
} from '../src/index';
import { InMemoryStorage } from '../src/storage';
import {
  isConditionExpressionLike,
  matchConditionExpression,
  validateCondition,
  KNOWN_OPERATORS,
} from '../src/utils';

// ---------------------------------------------------------------------------
// Shared resource map used across tests
// ---------------------------------------------------------------------------
type MockPost = {
  id: number;
  title: string;
  published: boolean;
  tags: string[];
  comments: { authorId: number; body: string }[];
};

// ---------------------------------------------------------------------------
// KNOWN_OPERATORS
// ---------------------------------------------------------------------------
describe('KNOWN_OPERATORS', () => {
  it('should contain all expected operators', () => {
    const expected = [
      'eq',
      'in',
      'contains',
      'startsWith',
      'endsWith',
      'gt',
      'gte',
      'has',
      'hasSome',
      'hasEvery',
      'some',
      'every',
      'none',
    ];
    for (const op of expected) {
      expect(KNOWN_OPERATORS.has(op)).toBe(true);
    }
  });

  it('should not contain unknown operators', () => {
    expect(KNOWN_OPERATORS.has('like')).toBe(false);
    expect(KNOWN_OPERATORS.has('notEq')).toBe(false);
    expect(KNOWN_OPERATORS.has('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isConditionExpressionLike — structural check only
// ---------------------------------------------------------------------------
describe('isConditionExpressionLike', () => {
  it('returns true for a well-formed expression with a known operator', () => {
    expect(isConditionExpressionLike(['eq', 'foo'])).toBe(true);
    expect(isConditionExpressionLike(['in', ['a', 'b']])).toBe(true);
    expect(isConditionExpressionLike(['gt', 5])).toBe(true);
  });

  it('returns true for an unknown operator (structural check only)', () => {
    expect(isConditionExpressionLike(['like', 'foo'])).toBe(true);
    expect(isConditionExpressionLike(['notEq', 'bar'])).toBe(true);
  });

  it('returns false for structurally malformed expressions', () => {
    expect(isConditionExpressionLike(null)).toBe(false);
    expect(isConditionExpressionLike([])).toBe(false);
    expect(isConditionExpressionLike(['eq'])).toBe(false); // only 1 element
    expect(isConditionExpressionLike([42, 'foo'])).toBe(false); // operator not a string
  });
});

// ---------------------------------------------------------------------------
// validateCondition
// ---------------------------------------------------------------------------
describe('validateCondition', () => {
  it('accepts null condition without throwing', () => {
    expect(() => validateCondition(null)).not.toThrow();
  });

  it('accepts a valid flat condition without throwing', () => {
    expect(() => validateCondition({ id: ['eq', 1], title: ['contains', 'hello'] })).not.toThrow();
  });

  it('accepts a valid nested condition without throwing', () => {
    expect(() =>
      validateCondition({
        address: {
          city: ['eq', 'NYC'],
          zip: ['in', ['10001', '10002']],
        },
      }),
    ).not.toThrow();
  });

  it('accepts some/every/none with a valid nested condition', () => {
    expect(() =>
      validateCondition({
        comments: ['some', { authorId: ['eq', 1] }],
      }),
    ).not.toThrow();
  });

  it('throws GuantrInvalidConditionError for an unknown operator', () => {
    expect(() => validateCondition({ id: ['unknownOp' as any, 1] })).toThrowError(
      GuantrInvalidConditionError,
    );
  });

  it('includes the operator name and path in the error message', () => {
    let caught: GuantrInvalidConditionError | undefined;
    try {
      validateCondition({ title: ['like' as any, 'foo'] });
    } catch (e) {
      caught = e as GuantrInvalidConditionError;
    }
    expect(caught).toBeInstanceOf(GuantrInvalidConditionError);
    expect(caught!.message).toContain('"like"');
    expect(caught!.message).toContain('"title"');
    expect(caught!.condition).toEqual(['like', 'foo']);
    expect(caught!.reason).toContain('"like"');
  });

  it('throws for a malformed expression (too short)', () => {
    expect(() => validateCondition({ id: ['eq'] as any })).toThrowError(
      GuantrInvalidConditionError,
    );
  });

  it('throws for a malformed expression (non-string operator)', () => {
    expect(() => validateCondition({ id: [42 as any, 'foo'] })).toThrowError(
      GuantrInvalidConditionError,
    );
  });

  it('throws for a non-array, non-object condition value', () => {
    expect(() => validateCondition({ id: 'invalid' as any })).toThrowError(
      GuantrInvalidConditionError,
    );
  });

  it('throws for an unknown operator inside some/every/none operand', () => {
    expect(() =>
      validateCondition({
        comments: ['some', { authorId: ['like' as any, 1] }],
      }),
    ).toThrowError(GuantrInvalidConditionError);
  });

  it('throws for an unknown operator in a deeply nested condition', () => {
    expect(() =>
      validateCondition({
        author: { address: { city: ['like' as any, 'NYC'] } },
      }),
    ).toThrowError(GuantrInvalidConditionError);
  });

  it('throws for an invalid $expr', () => {
    expect(() =>
      validateCondition({
        tags: {
          $expr: ['badOp' as any, 'foo'],
          length: ['gt', 0],
        } as any,
      }),
    ).toThrowError(GuantrInvalidConditionError);
  });
});

// ---------------------------------------------------------------------------
// matchConditionExpression — always throws on unknown operator
// ---------------------------------------------------------------------------
describe('matchConditionExpression', () => {
  it('throws GuantrInvalidConditionOperatorError for an unknown operator', () => {
    expect(() =>
      matchConditionExpression({
        value: 'foo',
        expression: ['unknownOp' as any, 'foo'],
      }),
    ).toThrowError(GuantrInvalidConditionOperatorError);
  });

  it('includes the operator in the thrown error', () => {
    let caught: GuantrInvalidConditionOperatorError | undefined;
    try {
      matchConditionExpression({
        value: 'foo',
        expression: ['notEq' as any, 'foo'],
      });
    } catch (e) {
      caught = e as GuantrInvalidConditionOperatorError;
    }
    expect(caught).toBeInstanceOf(GuantrInvalidConditionOperatorError);
    expect(caught!.operator).toBe('notEq');
    expect(caught!.message).toContain('"notEq"');
  });

  it('evaluates known operators normally', () => {
    expect(matchConditionExpression({ value: 'hello', expression: ['eq', 'hello'] })).toBe(true);
    expect(matchConditionExpression({ value: 5, expression: ['gt', 3] })).toBe(true);
    expect(matchConditionExpression({ value: 'world', expression: ['contains', 'or'] })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Guantr.setRules — always validates conditions at definition time
// ---------------------------------------------------------------------------
describe('Guantr setRules — validation at definition time', () => {
  it('accepts valid rules without throwing', async () => {
    const guantr = await createGuantr();
    await expect(
      guantr.setRules((allow) => {
        allow('read', ['post', { title: ['contains', 'hello'] }]);
      }),
    ).resolves.toBeUndefined();
  });

  it('throws GuantrInvalidConditionError via callback form when an operator is unknown', async () => {
    const guantr = await createGuantr();
    await expect(
      guantr.setRules((allow) => {
        allow('read', ['post', { title: ['like' as any, 'hello'] }]);
      }),
    ).rejects.toThrowError(GuantrInvalidConditionError);
  });

  it('throws GuantrInvalidConditionError via array form when an operator is unknown', async () => {
    const guantr = await createGuantr();
    await expect(
      guantr.setRules([
        {
          effect: 'allow',
          action: 'read',
          resource: 'post',
          condition: { title: ['like' as any, 'hello'] },
        },
      ]),
    ).rejects.toThrowError(GuantrInvalidConditionError);
  });

  it('throws for a malformed condition expression', async () => {
    const guantr = await createGuantr();
    await expect(
      guantr.setRules([
        {
          effect: 'allow',
          action: 'read',
          resource: 'post',
          condition: { title: ['eq'] as any },
        },
      ]),
    ).rejects.toThrowError(GuantrInvalidConditionError);
  });

  it('skips validation for rules with null condition', async () => {
    const guantr = await createGuantr();
    await expect(
      guantr.setRules([{ effect: 'allow', action: 'read', resource: 'post', condition: null }]),
    ).resolves.toBeUndefined();
  });

  it('validates nested conditions inside some/every/none operands', async () => {
    const guantr = await createGuantr();
    await expect(
      guantr.setRules([
        {
          effect: 'allow',
          action: 'read',
          resource: 'post',
          condition: {
            comments: ['some', { authorId: ['badOp' as any, 1] }],
          },
        },
      ]),
    ).rejects.toThrowError(GuantrInvalidConditionError);
  });

  it('throws for rules with unknown operator passed at creation via createGuantr', async () => {
    await expect(
      createGuantr([
        {
          effect: 'allow',
          action: 'read',
          resource: 'post',
          condition: { title: ['unknownOp' as any, 'hello'] },
        },
      ]),
    ).rejects.toThrowError(GuantrInvalidConditionError);
  });
});

// ---------------------------------------------------------------------------
// Guantr.can — evaluation-time throw for rules that bypass setRules validation
// ---------------------------------------------------------------------------
describe('Guantr.can — evaluation-time operator validation', () => {
  it('throws GuantrInvalidConditionOperatorError when evaluating a rule with an unknown operator', async () => {
    // Populate storage directly (bypassing Guantr.setRules validation) so we can
    // test the evaluation-time throw path.
    const storage = new InMemoryStorage();
    await storage.setRules([
      {
        effect: 'allow',
        action: 'read',
        resource: 'post',
        condition: { title: ['like' as any, 'hello world'] },
      },
    ]);

    const guantr = new Guantr({ storage });

    await expect(
      guantr.can('read', [
        'post',
        { id: 1, title: 'hello world', published: true, tags: [], comments: [] } satisfies MockPost,
      ]),
    ).rejects.toThrowError(GuantrInvalidConditionOperatorError);
  });

  it('throws for an unknown operator in nested some/every/none operand at evaluation time', async () => {
    const storage = new InMemoryStorage();
    await storage.setRules([
      {
        effect: 'allow',
        action: 'read',
        resource: 'post',
        condition: { comments: ['some', { authorId: ['badOp' as any, 1] }] },
      },
    ]);
    const guantr = new Guantr({ storage });

    const post: MockPost = {
      id: 1,
      title: 'hello',
      published: true,
      tags: [],
      comments: [{ authorId: 1, body: 'test' }],
    };
    await expect(guantr.can('read', ['post', post])).rejects.toThrowError(
      GuantrInvalidConditionOperatorError,
    );
  });

  it('evaluates normally when all operators are valid', async () => {
    const guantr = await createGuantr();
    await guantr.setRules((allow) => {
      allow('read', ['post', { published: ['eq', true] }]);
    });

    const post: MockPost = { id: 1, title: 'Hello', published: true, tags: [], comments: [] };
    expect(await guantr.can('read', ['post', post])).toBe(true);

    const draft: MockPost = { ...post, published: false };
    expect(await guantr.can('read', ['post', draft])).toBe(false);
  });

  it('evaluates known operators correctly when storage is pre-populated', async () => {
    const storage = new InMemoryStorage();
    await storage.setRules([
      {
        effect: 'allow',
        action: 'read',
        resource: 'post',
        condition: { title: ['contains', 'hello'] },
      },
    ]);
    const guantr = new Guantr({ storage });

    const post: MockPost = { id: 1, title: 'hello world', published: true, tags: [], comments: [] };
    expect(await guantr.can('read', ['post', post])).toBe(true);

    const noMatch: MockPost = { id: 2, title: 'goodbye', published: true, tags: [], comments: [] };
    expect(await guantr.can('read', ['post', noMatch])).toBe(false);
  });
});
