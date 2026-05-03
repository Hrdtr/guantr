import { describe, expect, it } from 'vitest';
import {
  createGuantr,
  GuantrInvalidConditionError,
  GuantrInvalidConditionOperatorError,
  Guantr,
} from '../src/index';
import { InMemoryStorage } from '../src/storage';
import {
  isValidConditionExpression,
  matchConditionExpression,
  validateConditionForStrict,
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
// isValidConditionExpression — strict flag
// ---------------------------------------------------------------------------
describe('isValidConditionExpression (strict)', () => {
  it('returns true for a well-formed expression with a known operator', () => {
    expect(isValidConditionExpression(['eq', 'foo'], true)).toBe(true);
    expect(isValidConditionExpression(['in', ['a', 'b']], true)).toBe(true);
    expect(isValidConditionExpression(['gt', 5], true)).toBe(true);
  });

  it('returns false for an unknown operator in strict mode', () => {
    expect(isValidConditionExpression(['like', 'foo'], true)).toBe(false);
    expect(isValidConditionExpression(['notEq', 'bar'], true)).toBe(false);
  });

  it('returns true for an unknown operator in non-strict mode (legacy behavior)', () => {
    expect(isValidConditionExpression(['like', 'foo'])).toBe(true);
    expect(isValidConditionExpression(['like', 'foo'], false)).toBe(true);
  });

  it('returns false for structurally malformed expressions regardless of strict', () => {
    expect(isValidConditionExpression(null)).toBe(false);
    expect(isValidConditionExpression([])).toBe(false);
    expect(isValidConditionExpression(['eq'])).toBe(false); // only 1 element
    expect(isValidConditionExpression([42, 'foo'])).toBe(false); // operator not a string
    expect(isValidConditionExpression(['eq'], true)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateConditionForStrict
// ---------------------------------------------------------------------------
describe('validateConditionForStrict', () => {
  it('accepts null or undefined conditions without throwing', () => {
    expect(() => validateConditionForStrict(null)).not.toThrow();
    expect(() => validateConditionForStrict(null)).not.toThrow(); // null is the only nullable form in the type
  });

  it('accepts a valid flat condition without throwing', () => {
    expect(() =>
      validateConditionForStrict({ id: ['eq', 1], title: ['contains', 'hello'] }),
    ).not.toThrow();
  });

  it('accepts a valid nested condition without throwing', () => {
    expect(() =>
      validateConditionForStrict({
        address: {
          city: ['eq', 'NYC'],
          zip: ['in', ['10001', '10002']],
        },
      }),
    ).not.toThrow();
  });

  it('accepts some/every/none with a valid nested condition', () => {
    expect(() =>
      validateConditionForStrict({
        comments: ['some', { authorId: ['eq', 1] }],
      }),
    ).not.toThrow();
  });

  it('throws GuantrInvalidConditionError for an unknown operator', () => {
    expect(() => validateConditionForStrict({ id: ['unknownOp' as any, 1] })).toThrowError(
      GuantrInvalidConditionError,
    );
  });

  it('includes the operator name and path in the error message', () => {
    let caught: GuantrInvalidConditionError | undefined;
    try {
      validateConditionForStrict({ title: ['like' as any, 'foo'] });
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
    expect(() => validateConditionForStrict({ id: ['eq'] as any })).toThrowError(
      GuantrInvalidConditionError,
    );
  });

  it('throws for a malformed expression (non-string operator)', () => {
    expect(() => validateConditionForStrict({ id: [42 as any, 'foo'] })).toThrowError(
      GuantrInvalidConditionError,
    );
  });

  it('throws for a non-array, non-object condition value', () => {
    expect(() => validateConditionForStrict({ id: 'invalid' as any })).toThrowError(
      GuantrInvalidConditionError,
    );
  });

  it('throws for an unknown operator inside some/every/none operand', () => {
    expect(() =>
      validateConditionForStrict({
        comments: ['some', { authorId: ['like' as any, 1] }],
      }),
    ).toThrowError(GuantrInvalidConditionError);
  });

  it('throws for an unknown operator in a deeply nested condition', () => {
    expect(() =>
      validateConditionForStrict({
        author: { address: { city: ['like' as any, 'NYC'] } },
      }),
    ).toThrowError(GuantrInvalidConditionError);
  });

  it('throws for an invalid $expr', () => {
    expect(() =>
      validateConditionForStrict({
        tags: {
          $expr: ['badOp' as any, 'foo'],
          length: ['gt', 0],
        } as any,
      }),
    ).toThrowError(GuantrInvalidConditionError);
  });
});

// ---------------------------------------------------------------------------
// matchConditionExpression — strict flag
// ---------------------------------------------------------------------------
describe('matchConditionExpression (strict)', () => {
  it('returns false for an unknown operator in non-strict mode (legacy)', () => {
    expect(
      matchConditionExpression({ value: 'foo', expression: ['unknownOp' as any, 'foo'] }),
    ).toBe(false);
  });

  it('throws GuantrInvalidConditionOperatorError for an unknown operator in strict mode', () => {
    expect(() =>
      matchConditionExpression({
        value: 'foo',
        expression: ['unknownOp' as any, 'foo'],
        strict: true,
      }),
    ).toThrowError(GuantrInvalidConditionOperatorError);
  });

  it('includes the operator in the thrown error', () => {
    let caught: GuantrInvalidConditionOperatorError | undefined;
    try {
      matchConditionExpression({
        value: 'foo',
        expression: ['notEq' as any, 'foo'],
        strict: true,
      });
    } catch (e) {
      caught = e as GuantrInvalidConditionOperatorError;
    }
    expect(caught).toBeInstanceOf(GuantrInvalidConditionOperatorError);
    expect(caught!.operator).toBe('notEq');
    expect(caught!.message).toContain('"notEq"');
  });

  it('evaluates known operators normally in strict mode', () => {
    expect(
      matchConditionExpression({ value: 'hello', expression: ['eq', 'hello'], strict: true }),
    ).toBe(true);
    expect(matchConditionExpression({ value: 5, expression: ['gt', 3], strict: true })).toBe(true);
    expect(
      matchConditionExpression({ value: 'world', expression: ['contains', 'or'], strict: true }),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Guantr.setRules — strict mode validation at definition time
// ---------------------------------------------------------------------------
describe('Guantr setRules (strict: true)', () => {
  it('accepts valid rules without throwing', async () => {
    const guantr = await createGuantr({ strict: true });
    await expect(
      guantr.setRules((allow) => {
        allow('read', ['post', { title: ['contains', 'hello'] }]);
      }),
    ).resolves.toBeUndefined();
  });

  it('throws GuantrInvalidConditionError via callback form when an operator is unknown', async () => {
    const guantr = await createGuantr({ strict: true });
    await expect(
      guantr.setRules((allow) => {
        allow('read', ['post', { title: ['like' as any, 'hello'] }]);
      }),
    ).rejects.toThrowError(GuantrInvalidConditionError);
  });

  it('throws GuantrInvalidConditionError via array form when an operator is unknown', async () => {
    const guantr = await createGuantr({ strict: true });
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

  it('throws for a malformed condition expression in strict mode', async () => {
    const guantr = await createGuantr({ strict: true });
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

  it('does NOT throw for an unknown operator in non-strict mode (legacy)', async () => {
    const guantr = await createGuantr({ strict: false });
    await expect(
      guantr.setRules([
        {
          effect: 'allow',
          action: 'read',
          resource: 'post',
          condition: { title: ['like' as any, 'hello'] },
        },
      ]),
    ).resolves.toBeUndefined();
  });

  it('does NOT throw by default (strict defaults to false — no breaking change)', async () => {
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
    ).resolves.toBeUndefined();
  });

  it('skips validation for rules with null condition', async () => {
    const guantr = await createGuantr({ strict: true });
    await expect(
      guantr.setRules([{ effect: 'allow', action: 'read', resource: 'post', condition: null }]),
    ).resolves.toBeUndefined();
  });

  it('validates nested conditions inside some/every/none operands', async () => {
    const guantr = await createGuantr({ strict: true });
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
});

// ---------------------------------------------------------------------------
// Guantr.can — strict mode propagated to evaluation
// ---------------------------------------------------------------------------
describe('Guantr.can (strict: true) — evaluation-time throw', () => {
  it('throws GuantrInvalidConditionOperatorError when evaluating a rule with an unknown operator in strict mode', async () => {
    // Populate storage directly (bypassing Guantr.setRules validation) so we can
    // test the evaluation-time throw path in strict mode.
    const storage = new InMemoryStorage();
    await storage.setRules([
      {
        effect: 'allow',
        action: 'read',
        resource: 'post',
        condition: { title: ['like' as any, 'hello world'] },
      },
    ]);

    const strictGuantr = new Guantr({ strict: true, storage });

    await expect(
      strictGuantr.can('read', [
        'post',
        { id: 1, title: 'hello world', published: true, tags: [], comments: [] } satisfies MockPost,
      ]),
    ).rejects.toThrowError(GuantrInvalidConditionOperatorError);
  });

  it('evaluates normally in strict mode when all operators are valid', async () => {
    const guantr = await createGuantr({ strict: true });
    await guantr.setRules((allow) => {
      allow('read', ['post', { published: ['eq', true] }]);
    });

    const post: MockPost = { id: 1, title: 'Hello', published: true, tags: [], comments: [] };
    expect(await guantr.can('read', ['post', post])).toBe(true);

    const draft: MockPost = { ...post, published: false };
    expect(await guantr.can('read', ['post', draft])).toBe(false);
  });
});
