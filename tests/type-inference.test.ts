import type { ConditionOperator } from '../src/index';
/**
 * This file verifies that type inference works correctly with the v2 API.
 * It is NOT meant to be executed at runtime — only type-checked.
 */
import { describe, it } from 'vitest';
import {
  createGuantr,
  Guantr,
  GuantrMeta,
  GuantrResourceMap,
  GuantrRule,
  GuantrRuleCondition,
  GuantrRuleConditionExpression,
  GuantrContextFromMeta,
  GuantrOptions,
} from '../src/index';

// ---------------------------------------------------------------------------
// Setup: resource map and meta types
// ---------------------------------------------------------------------------
type MyResourceMap = GuantrResourceMap<{
  article: {
    action: 'read' | 'create' | 'update' | 'delete';
    model: {
      id: string;
      title: string;
      status: 'draft' | 'published';
      tags: string[];
    };
  };
  user: {
    action: 'read' | 'update';
    model: {
      id: number;
      name: string;
      role: 'admin' | 'user';
    };
  };
}>;

type MyContext = {
  userId: string;
  role: 'admin' | 'user';
};

type MyMeta = GuantrMeta<MyResourceMap, MyContext>;

describe('Type inference (compile-time only)', () => {
  it('GuantrRule without generics is untyped', () => {
    // Should compile: untyped GuantrRule accepts any strings
    const _rule: GuantrRule = {
      effect: 'allow',
      action: 'anything',
      resource: 'anything',
      condition: null,
    };

    // Should compile: condition can be any object
    const _ruleWithCondition: GuantrRule = {
      effect: 'deny',
      action: 'read',
      resource: 'post',
      condition: {
        someKey: ['eq', 'someValue'],
        nested: {
          anotherKey: ['gt', 5],
        },
      },
    };
  });

  it('GuantrRule with Meta is typed', () => {
    // Should compile: typed GuantrRule narrows resource and action
    const _rule2: GuantrRule<MyMeta> = {
      effect: 'allow',
      resource: 'article',
      action: 'read',
      condition: {
        status: ['eq', 'draft'],
        title: ['contains', 'hello'],
      },
    };

    // Verify typed rule: correct values compile
    const _rule3: GuantrRule<MyMeta> = {
      effect: 'allow',
      resource: 'article',
      action: 'read',
      condition: null,
    };
  });

  it('GuantrRuleCondition without generics is untyped', () => {
    // Should compile: untyped condition accepts any keys
    const _condition: GuantrRuleCondition = {
      anyKey: ['eq', 'value'],
      nested: {
        anotherKey: ['gt', 5],
      },
    };
  });

  it('GuantrRuleCondition with Model is typed', () => {
    // Should compile: typed condition narrows to model properties
    const _condition2: GuantrRuleCondition<{ id: number; name: string }> = {
      id: ['eq', 1],
      name: ['eq', 'test'],
    };

    // Verify typed condition: correct keys compile
    const _condition3: GuantrRuleCondition<{ id: number; name: string }> = {
      id: ['eq', 1],
      name: ['eq', 'test'],
    };
  });

  it('GuantrContextFromMeta extracts Context from Meta', () => {
    // Should compile: extracts MyContext from MyMeta
    type Extracted = GuantrContextFromMeta<MyMeta>;
    const _ctx: Extracted = { userId: '123', role: 'admin' };

    // Should be Record<string, unknown> for undefined Meta
    type ExtractedDefault = GuantrContextFromMeta<undefined>;
    const _ctxDefault: ExtractedDefault = {};
  });

  it('createGuantr with Meta infers Context from Meta', async () => {
    // Should compile: Context is inferred from MyMeta (MyContext)
    const guantr = await createGuantr<MyMeta>({
      // getContext return type is inferred as MyContext
      getContext: () => ({ userId: '123', role: 'admin' as const }),
    });

    // can/cannot are typed
    await guantr.can('read', ['article', { id: '1', title: 'Test', status: 'draft', tags: [] }]);
  });

  it('createGuantr with Meta and setRules callback', async () => {
    const guantr = await createGuantr<MyMeta>();

    // setRules callback: allow/deny are typed
    await guantr.setRules((allow, deny) => {
      // Should autocomplete: 'read' is a valid action for 'article'
      allow('read', 'article');

      // Should autocomplete: condition keys are model properties
      allow('read', ['article', { status: ['eq', 'draft'] }]);

      // $ctx autocompletion
      allow('read', ['article', { id: ['eq', '$ctx.userId'] }]);

      deny('delete', ['article', { status: ['eq', 'published'] }]);
    });
  });

  it('Guantr class constructor with Meta', () => {
    // Should compile: no Context generic needed
    const _guantr2 = new Guantr<MyMeta>({
      getContext: () => ({ userId: '123', role: 'admin' as const }),
    });
  });

  it('GuantrOptions uses GuantrContextFromMeta', () => {
    // Should compile: options typed with proper Context
    const _options: GuantrOptions<MyContext> = {
      getContext: () => ({ userId: '123', role: 'admin' }),
    };
  });

  it('ConditionOperator is still exported', () => {
    const _op: ConditionOperator = 'eq';
  });

  it('GuantrRuleConditionExpression is exported', () => {
    const _expr: GuantrRuleConditionExpression = ['eq', 'hello'];
  });
});
