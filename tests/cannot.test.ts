import { describe, expect, it } from 'vitest';
import { Guantr, GuantrCircuitBreakerError } from '../src/index';

describe('Guantr.cannot', () => {
  // 1. returns true when no rules exist
  it('returns true when no rules exist', async () => {
    const guantr = new Guantr();

    expect(await guantr.cannot('read', ['post', { id: 1 }])).toBe(true);
  });

  // 2. returns false when unconditional allow rule matches
  it('returns false when unconditional allow rule matches', async () => {
    const guantr = new Guantr();
    await guantr.setRules([{ effect: 'allow', action: 'read', resource: 'post', condition: null }]);

    expect(await guantr.cannot('read', ['post', { id: 1 }])).toBe(false);
  });

  // 3. returns true when only unconditional deny rule exists (no allow rule → allowed[] never gets true)
  it('returns true when only unconditional deny rule exists', async () => {
    const guantr = new Guantr();
    await guantr.setRules([{ effect: 'deny', action: 'read', resource: 'post', condition: null }]);

    // Unconditional deny triggers early exit in _can → false; cannot() negates → true
    expect(await guantr.cannot('read', ['post', { id: 1 }])).toBe(true);
  });

  // 4. returns true when a conditional deny overrides an allow
  it('returns true when a conditional deny overrides an allow', async () => {
    const guantr = new Guantr();
    await guantr.setRules([
      { effect: 'allow', action: 'read', resource: 'post', condition: null },
      {
        effect: 'deny',
        action: 'read',
        resource: 'post',
        condition: { published: ['eq', true] } as any,
      },
    ]);

    // Deny rule matches for published:true → denied.push(false) → result false → cannot() true
    expect(await guantr.cannot('read', ['post', { published: true }])).toBe(true);
    // Deny rule does NOT match for published:false → result true → cannot() false
    expect(await guantr.cannot('read', ['post', { published: false }])).toBe(false);
  });

  // 5. conditional cannot — only matching allow rule
  it('conditional cannot — only matching allow rule', async () => {
    const guantr = new Guantr();
    await guantr.setRules([
      {
        effect: 'allow',
        action: 'read',
        resource: 'post',
        condition: { published: ['eq', true] } as any,
      },
    ]);

    expect(await guantr.cannot('read', ['post', { published: true }])).toBe(false);
    expect(await guantr.cannot('read', ['post', { published: false }])).toBe(true);
  });

  // 6. is the logical negation of can()
  it('is the logical negation of can()', async () => {
    const guantr = new Guantr();
    await guantr.setRules([
      {
        effect: 'allow',
        action: 'read',
        resource: 'post',
        condition: { id: ['eq', 1] } as any,
      },
    ]);

    const canId1 = await guantr.can('read', ['post', { id: 1 }]);
    const cannotId1 = await guantr.cannot('read', ['post', { id: 1 }]);
    expect(canId1).toBe(!cannotId1);

    const canId2 = await guantr.can('read', ['post', { id: 2 }]);
    const cannotId2 = await guantr.cannot('read', ['post', { id: 2 }]);
    expect(canId2).toBe(!cannotId2);
  });

  // 7. works with context-dependent conditions
  it('works with context-dependent conditions', async () => {
    const guantr = new Guantr({ getContext: () => ({ userId: 5 }) });
    await guantr.setRules([
      {
        effect: 'allow',
        action: 'update',
        resource: 'post',
        condition: { authorId: ['eq', '$ctx.userId'] } as any,
      },
    ]);

    // authorId matches context userId → can() true → cannot() false
    expect(await guantr.cannot('update', ['post', { authorId: 5 }])).toBe(false);
    // authorId differs from context userId → can() false → cannot() true
    expect(await guantr.cannot('update', ['post', { authorId: 6 }])).toBe(true);
  });

  // 8. cannot.abstract returns true when no allow rule exists
  it('cannot.abstract returns true when no allow rule exists', async () => {
    const guantr = new Guantr();

    expect(await guantr.cannot.abstract('read', 'post')).toBe(true);
  });

  // 9. cannot.abstract returns false when an allow rule exists
  it('cannot.abstract returns false when an allow rule exists', async () => {
    const guantr = new Guantr();
    await guantr.setRules([{ effect: 'allow', action: 'read', resource: 'post', condition: null }]);

    expect(await guantr.cannot.abstract('read', 'post')).toBe(false);
  });

  // 10. cannot.abstract ignores deny rules — only checks if any allow rule exists
  it('cannot.abstract ignores deny rules', async () => {
    const guantr = new Guantr();
    await guantr.setRules([
      { effect: 'allow', action: 'read', resource: 'post', condition: null },
      {
        effect: 'deny',
        action: 'read',
        resource: 'post',
        condition: { published: ['eq', false] } as any,
      },
    ]);

    // An allow rule exists, so can.abstract() → true, cannot.abstract() → false
    // The deny rule is completely ignored by the abstract check
    expect(await guantr.cannot.abstract('read', 'post')).toBe(false);
  });

  // 11. cannot.abstract is the logical negation of can.abstract
  it('cannot.abstract is the logical negation of can.abstract', async () => {
    // Without allow rule
    const guantr = new Guantr();
    const canAbstractNoRule = await guantr.can.abstract('read', 'post');
    const cannotAbstractNoRule = await guantr.cannot.abstract('read', 'post');
    expect(canAbstractNoRule).toBe(!cannotAbstractNoRule);

    // With allow rule (fresh instance to avoid stale cache)
    const guantr2 = new Guantr();
    await guantr2.setRules([
      { effect: 'allow', action: 'read', resource: 'post', condition: null },
    ]);
    const canAbstractWithRule = await guantr2.can.abstract('read', 'post');
    const cannotAbstractWithRule = await guantr2.cannot.abstract('read', 'post');
    expect(canAbstractWithRule).toBe(!cannotAbstractWithRule);
  });

  // 12. throws GuantrCircuitBreakerError when maxRuleIterations is exceeded
  it('throws GuantrCircuitBreakerError when limit exceeded', async () => {
    const guantr = new Guantr({ maxRuleIterations: 1 });
    await guantr.setRules([
      { effect: 'allow', action: 'read', resource: 'post', condition: null },
      { effect: 'allow', action: 'read', resource: 'post', condition: { title: ['eq', 'Test'] } },
    ]);

    // _can throws after the first iteration (1 > 0); cannot() propagates the error
    await expect(guantr.cannot('read', ['post', { id: 1 }])).rejects.toThrowError(
      GuantrCircuitBreakerError,
    );
  });

  // 13. works with setRules callback form (allow/deny notation)
  it('works with setRules callback form', async () => {
    const guantr = new Guantr();
    await guantr.setRules((allow, deny) => {
      allow('read', 'post'); // creates unconditional allow rule for read/post
      deny('delete', 'post'); // creates unconditional deny rule for delete/post
    });

    // Suppress string-mode deprecation warnings around these assertions
    const prev = Guantr.devWarnings;
    Guantr.devWarnings = false;
    try {
      // Unconditional allow for read → can() true → cannot() false
      expect(await guantr.cannot('read', ['post', { id: 1 }])).toBe(false);

      // No allow rule for delete (only deny) → can.abstract() false → cannot.abstract() true
      expect(await guantr.cannot.abstract('delete', 'post')).toBe(true);
    } finally {
      Guantr.devWarnings = prev;
    }
  });

  // 14. works with the async setRules callback
  it('works with the async setRules callback', async () => {
    const guantr = new Guantr();
    await guantr.setRules(async (allow) => {
      await new Promise((r) => setTimeout(r, 0));
      allow('read', ['post', { published: ['eq', true] }]);
    });

    // Allow rule condition matched → can() true → cannot() false
    expect(await guantr.cannot('read', ['post', { published: true }])).toBe(false);
    // Allow rule condition not matched → can() false → cannot() true
    expect(await guantr.cannot('read', ['post', { published: false }])).toBe(true);
  });
});
