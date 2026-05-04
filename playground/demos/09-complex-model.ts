/**
 * Demo 9: Complex Resource Models
 * ================================
 *
 * Tests how GuantrRuleCondition<Model, Context> handles various resource
 * model shapes — nested objects, arrays, nullable fields, optional props,
 * and deeply nested structures.
 *
 * For each scenario the demo verifies:
 *   - Type-level correctness (the correct expression type is inferred)
 *   - Runtime correctness (matchRuleCondition produces the right result)
 */

import { createGuantr, GuantrMeta, GuantrResourceMap, GuantrRuleCondition } from '../../src/index';
import { testMatch } from '../utils';
import { heading, sub, assert, info } from '../utils';

/* ================================================================== */
/*  SCENARIO A: Model with nested objects                               */
/* ================================================================== */

/**
 * =====================================================================
 *  TYPE COMPLETION CHECKPOINT — NestedObjectModel
 * =====================================================================
 *
 * When writing `GuantrRuleCondition<NestedObjectModel, …>` below, your
 * editor should autocomplete these keys with the right expression types:
 *
 * ┌────────────────────────────────────────────────────────────────┐
 * │  Model key                         Expression type              │
 * ├────────────────────────────────────────────────────────────────┤
 * │  id                               NumberConditionExpression    │
 * │  title                            StringConditionExpression    │
 * │  address              → nested GuantrRuleCondition (object)    │
 * │  address.street                    StringConditionExpression    │
 * │  address.city                      StringConditionExpression    │
 * │  address.coordinates  → nested GuantrRuleCondition (object)    │
 * │  address.coordinates.lat           NumberConditionExpression    │
 * │  address.coordinates.lng           NumberConditionExpression    │
 * │  metadata              → nested GuantrRuleCondition (object)    │
 * │  metadata.publishedAt              StringConditionExpression    │
 * │  metadata.stats        → nested GuantrRuleCondition (object)    │
 * │  metadata.stats.views              NumberConditionExpression    │
 * │  metadata.stats.likes              NumberConditionExpression    │
 * └────────────────────────────────────────────────────────────────┘
 */
type NestedObjectModel = {
  id: number;
  title: string;
  address: {
    street: string;
    city: string;
    zip: string;
    country: string;
    coordinates: {
      lat: number;
      lng: number;
    };
  };
  metadata: {
    publishedAt: string;
    stats: {
      views: number;
      likes: number;
    };
  };
};

type NestedObjectCtx = { userId: number };

/* ================================================================== */
/*  SCENARIO B: Model with arrays (primitive + object)                  */
/* ================================================================== */

/**
 * =====================================================================
 *  TYPE COMPLETION CHECKPOINT — ArrayModel
 * =====================================================================
 *
 * ┌────────────────────────────────────────────────────────────────┐
 * │  Model key                         Expression                   │
 * ├────────────────────────────────────────────────────────────────┤
 * │  tags (string[])        ArrayConditionExpressionBasic          │
 * │                           → ['has', 'val']                     │
 * │                           → ['hasSome', ['a','b']]             │
 * │                           → ['hasEvery', ['a','b']]            │
 * │                           → { $expr: ..., length: [...] }      │
 * │                                                               │
 * │  comments (Array<...>)  ArrayConditionExpressionObject        │
 * │                           → ['some', {...}]                    │
 * │                           → ['every', {...}]                   │
 * │                           → ['none', {...}]                    │
 * │                                                               │
 * │  nestedArrays (number[][])  → treated as unknown[]            │
 * │    (not string|number|boolean and not Record[] — falls         │
 * │     through to never)                                          │
 * └────────────────────────────────────────────────────────────────┘
 */
type ArrayModel = {
  id: number;
  tags: string[];
  scores: number[];
  flags: boolean[];
  comments: Array<{
    id: number;
    text: string;
    authorId: number;
    moderated: boolean;
    reactions: Array<{
      userId: number;
      type: 'like' | 'heart' | 'laugh';
    }>;
  }>;
  nestedArrays: number[][];
};

type ArrayCtx = { currentUserId: number; roles: string[] };

type _ArrayMeta = GuantrMeta<
  GuantrResourceMap<{ post: { action: 'read' | 'edit' | 'delete'; model: ArrayModel } }>,
  ArrayCtx
>;

/* ================================================================== */
/*  SCENARIO C: Model with nullable / optional fields                   */
/* ================================================================== */

/**
 * =====================================================================
 *  TYPE COMPLETION CHECKPOINT — NullableModel (nullish + optional)
 * =====================================================================
 *
 * ┌────────────────────────────────────────────────────────────────┐
 * │  Model key                         Allowed expressions          │
 * ├────────────────────────────────────────────────────────────────┤
 * │  description (string|null)  ['eq', <string>]                  │
 * │                             ['eq', null]   ← nullish allowed  │
 * │                             ['contains', ...]                  │
 * │                             etc.                              │
 * │                                                               │
 * │  subtitle? (string|undef)   ['eq', <string>]                  │
 * │                             ['eq', undefined] ← optional      │
 * │                                                               │
 * │  author (object|null)       nested GuantrRuleCondition        │
 * │                             ['eq', null]                      │
 * │                                                               │
 * │  author.email (string|null) ['eq', <string>]                  │
 * │                             ['eq', null]                      │
 * │                                                               │
 * │  author.address (object|null)  nested or ['eq', null]         │
 * │  author.address.city (string|null)  eq string | eq null       │
 * │  author.address.zip? (string|undef)  eq string | eq undefined │
 * │                                                               │
 * │  tags (string[]|null)       ArrayConditionExpressionBasic     │
 * │                             ['eq', null]                      │
 * └────────────────────────────────────────────────────────────────┘
 */
type NullableModel = {
  id: number;
  title: string;
  description: string | null;
  /** Optional — may be absent entirely */
  subtitle?: string;
  author: {
    name: string;
    email: string | null;
    /** Optional nested contact */
    phone?: string;
    address: {
      street: string;
      city: string | null;
      /** Optional deep field */
      zip?: string;
    } | null;
  } | null;
  tags: string[] | null;
  metadata: Record<string, unknown>;
};

type NullableCtx = { userId: number; email: string };

type _NullableMeta = GuantrMeta<
  GuantrResourceMap<{ article: { action: 'read' | 'update'; model: NullableModel } }>,
  NullableCtx
>;

/* ================================================================== */
/*  SCENARIO D: Deeply nested model (6 levels)                          */
/* ================================================================== */

/**
 * =====================================================================
 *  TYPE COMPLETION CHECKPOINT — DeepModel (6 levels of nesting)
 * =====================================================================
 *
 *  Autocomplete should drill down through every level:
 *
 *  level1 → level2 → level3 → level4 → level5 → deepArray.some → level6.name
 *
 *  At each nested object level, the editor shows the sub-keys.
 *  At level5.deepArray, it shows ArrayConditionExpressionObject
 *  (['some', { ... }], ['every', { ... }], ['none', { ... }]).
 */
type DeepModel = {
  level1: {
    level2: {
      level3: {
        level4: {
          value: string;
          numbers: number[];
          level5: {
            flag: boolean;
            deepArray: Array<{
              id: number;
              level6: {
                name: string;
              };
            }>;
          };
        };
      };
    };
  };
};

type DeepCtx = { search: string };

/* ================================================================== */
/*  SCENARIO E: Model with union / literal / enum fields                */
/* ================================================================== */

/**
 * =====================================================================
 *  TYPE COMPLETION CHECKPOINT — UnionModel (literal unions)
 * =====================================================================
 *
 *  Because status is a string union, `['eq', …]` should suggest the
 *  literal values: 'draft' | 'published' | 'archived'.
 *
 *  Because priority is a numeric literal union,
 *  `['gte', …]` should suggest 1 | 2 | 3 | 4 | 5.
 */
type UnionModel = {
  id: number;
  status: 'draft' | 'published' | 'archived';
  visibility: 'public' | 'private' | 'team';
  kind: 'article' | 'note' | 'page';
  priority: 1 | 2 | 3 | 4 | 5;
  metadata: Record<string, unknown>;
};

type UnionCtx = { role: 'admin' | 'editor' | 'viewer' };

/* ================================================================== */
/*  Demo                                                                */
/* ================================================================== */

export async function demoComplexModel(): Promise<void> {
  heading('9. Complex Resource Models');

  /* ------------------------------------------------------------------ */
  /*  9a. Nested objects                                                 */
  /* ------------------------------------------------------------------ */
  sub('9a. Nested objects in model');

  // ┌─────────────────────────────────────────────────────────────┐
  // │  TYPE COMPLETION CHECKPOINT — nested object model          │
  // │                                                             │
  // │  Typing the condition keys should autocomplete:              │
  // │  - id              (NumberConditionExpression)               │
  // │  - title           (StringConditionExpression)               │
  // │  - address         (→ nested GuantrRuleCondition)            │
  // │    - street        (StringConditionExpression)               │
  // │    - city          (StringConditionExpression)               │
  // │    - coordinates   (→ nested GuantrRuleCondition)            │
  // │      - lat         (NumberConditionExpression)               │
  // │      - lng         (NumberConditionExpression)               │
  // │  - metadata        (→ nested GuantrRuleCondition)            │
  // │    - publishedAt   (StringConditionExpression)               │
  // │    - stats         (→ nested GuantrRuleCondition)            │
  // │      - views       (NumberConditionExpression)               │
  // │      - likes       (NumberConditionExpression)               │
  // └─────────────────────────────────────────────────────────────┘
  const nestedCond: GuantrRuleCondition<NestedObjectModel, NestedObjectCtx> = {
    id: ['eq', 1],
    title: ['eq', 'Hello'],
    address: {
      street: ['eq', '123 Main St'],
      city: ['eq', 'NYC'],
      coordinates: {
        lat: ['gte', 40.0],
        lng: ['gte', -74.0],
      },
    },
    metadata: {
      stats: {
        views: ['gt', 1000],
      },
    },
  };
  assert(nestedCond.title?.[0] === 'eq', 'Nested model: top-level string condition');
  // Type-safe access via intermediate untyped condition variable
  const nc = nestedCond as GuantrRuleCondition;
  const ncAddress = nc.address as GuantrRuleCondition;
  const ncCoords = ncAddress.coordinates as GuantrRuleCondition;
  assert(
    Array.isArray(ncCoords.lat) && ncCoords.lat[0] === 'gte',
    'Nested model: 3-level deep number condition (address.coordinates.lat)',
  );

  // Runtime verification via type-safe testMatch wrapper
  assert(
    testMatch(
      {
        id: 1,
        title: 'Hello',
        address: {
          street: '123 Main St',
          city: 'NYC',
          zip: '10001',
          country: 'US',
          coordinates: { lat: 40.7, lng: -74.0 },
        },
        metadata: { publishedAt: '2024-01-01', stats: { views: 2000, likes: 50 } },
      },
      nc,
    ),
    'Nested model: testMatch matches nested condition',
  );

  assert(
    !testMatch(
      {
        id: 1,
        title: 'Hello',
        address: {
          street: '123 Main St',
          city: 'NYC',
          zip: '10001',
          country: 'US',
          coordinates: { lat: 39.0, lng: -74.0 },
        },
        metadata: { publishedAt: '2024-01-01', stats: { views: 2000, likes: 50 } },
      },
      nc,
    ),
    'Nested model: lat 39.0 does not satisfy gte 40.0',
  );

  /* ------------------------------------------------------------------ */
  /*  9b. Arrays — primitive arrays (has + $expr)                        */
  /* ------------------------------------------------------------------ */
  sub('9b. Primitive arrays — has, hasEvery, $expr');

  // ┌─────────────────────────────────────────────────────────────┐
  // │  TYPE COMPLETION CHECKPOINT — primitive array conditions    │
  // │                                                             │
  // │  tags (string[]) should autocomplete:                       │
  // │    ['has', <string>]                                        │
  // │    ['hasSome', <string[]>]                                   │
  // │    ['hasEvery', <string[]>]                                  │
  // │    { $expr: ['has', <string>], length: [...] }              │
  // │                                                             │
  // │  scores (number[]) should autocomplete:                     │
  // │    ['has', <number>]                                        │
  // │    ['hasSome', <number[]>]                                   │
  // │    ['hasEvery', <number[]>]                                  │
  // └─────────────────────────────────────────────────────────────┘
  const arrayPrimCond: GuantrRuleCondition<ArrayModel, ArrayCtx> = {
    tags: ['has', 'tech'],
    scores: ['hasEvery', [10, 20]],
  };
  const apc = arrayPrimCond as GuantrRuleCondition;
  assert(
    Array.isArray(apc.tags) && apc.tags[0] === 'has',
    'Primitive array: tags uses has operator',
  );

  // $expr — length check combined with array expression
  const arrayExprCond: GuantrRuleCondition<ArrayModel, ArrayCtx> = {
    tags: { $expr: ['has', 'tech'], length: ['gte', 2] },
  };
  const aec = arrayExprCond as GuantrRuleCondition;
  const aecTags = aec.tags as Record<string, unknown>;
  assert(
    Array.isArray(aecTags.$expr) && aecTags.$expr[0] === 'has',
    'Primitive array: $expr combined with length check',
  );

  // Runtime verification via type-safe testMatch
  assert(
    testMatch(
      {
        id: 1,
        tags: ['news', 'tech', 'typescript'],
        scores: [10, 20, 30],
        flags: [true, false],
        comments: [],
        nestedArrays: [[1, 2]],
      },
      apc,
    ),
    'Primitive array: has tag "tech" and scores hasEvery [10,20] → true',
  );

  assert(
    !testMatch(
      { id: 1, tags: ['sports'], scores: [10], flags: [false], comments: [], nestedArrays: [[]] },
      apc,
    ),
    'Primitive array: scores hasEvery [10,20] but scores is [10] → false',
  );

  /* ------------------------------------------------------------------ */
  /*  9c. Object arrays — some / every / none                            */
  /* ------------------------------------------------------------------ */
  sub('9c. Object arrays — some, every, none');

  const objectArrayCond: GuantrRuleCondition<ArrayModel, ArrayCtx> = {
    comments: ['some', { moderated: ['eq', false] }],
  };
  const oac = objectArrayCond as GuantrRuleCondition;
  assert(
    Array.isArray(oac.comments) && oac.comments[0] === 'some',
    'Object array: comments uses some (ArrayConditionExpressionObject)',
  );

  // Multi-condition inside object array operator
  const objectArrayMultiCond: GuantrRuleCondition<ArrayModel, ArrayCtx> = {
    comments: ['some', { moderated: ['eq', true], authorId: ['eq', 42] }],
  };

  // Nested array inside object array (reactions inside comments)
  const nestedArrayInObj: GuantrRuleCondition<ArrayModel, ArrayCtx> = {
    comments: [
      'some',
      {
        reactions: ['some', { type: ['eq', 'heart'] }],
      },
    ],
  };
  const naio = nestedArrayInObj as GuantrRuleCondition;
  assert(
    Array.isArray(naio.comments) && naio.comments[0] === 'some',
    'Object array: nested array inside object element verified',
  );
  // Note: naio.comments is ['some', { reactions: ['some', {...}] }]
  // comments[0] = 'some' (operator), comments[1] = condition object
  const naioCommentCond = naio.comments[1] as unknown as GuantrRuleCondition;
  assert(
    Array.isArray(naioCommentCond.reactions) && naioCommentCond.reactions[0] === 'some',
    'Object array: nested reactions.some verified',
  );

  // Runtime verification
  const testData: ArrayModel = {
    id: 1,
    tags: [],
    scores: [],
    flags: [],
    comments: [
      {
        id: 1,
        text: 'Great!',
        authorId: 42,
        moderated: true,
        reactions: [
          { userId: 1, type: 'like' },
          { userId: 2, type: 'heart' },
        ],
      },
      { id: 2, text: 'Spam', authorId: 99, moderated: false, reactions: [] },
    ],
    nestedArrays: [],
  };

  assert(testMatch(testData, oac), 'Object array: some moderated=false → true');
  assert(
    testMatch(testData, objectArrayMultiCond as GuantrRuleCondition),
    'Object array: some moderated=true AND authorId=42 → true',
  );
  assert(
    testMatch(testData, nestedArrayInObj as GuantrRuleCondition),
    'Object array: some comment has reaction type=heart → true',
  );

  // every and none
  assert(
    !testMatch(testData, {
      comments: ['every', { moderated: ['eq', true] }],
    } as GuantrRuleCondition),
    'Object array: every moderated=true → false (comment 2 is not moderated)',
  );
  assert(
    testMatch(testData, { comments: ['none', { authorId: ['eq', 999] }] } as GuantrRuleCondition),
    'Object array: none with authorId=999 → true (no such comment)',
  );

  /* ------------------------------------------------------------------ */
  /*  9d. Nullable / optional fields                                     */
  /* ------------------------------------------------------------------ */
  sub('9d. Nullable and optional fields');

  // ┌─────────────────────────────────────────────────────────────┐
  // │  TYPE COMPLETION CHECKPOINT — nullable + optional fields    │
  // │                                                             │
  // │  description (string|null):                                  │
  // │    ✅ ['eq', 'value']  → StringConditionExpression          │
  // │    ✅ ['eq', null]     → NullishConditionExpression         │
  // │                                                             │
  // │  subtitle? (string|undefined):                              │
  // │    ✅ ['eq', 'value']  → StringConditionExpression          │
  // │    ✅ ['eq', undefined] → NullishConditionExpression        │
  // │                                                             │
  // │  author (object|null):                                      │
  // │    ✅ ['eq', null]     → NullishConditionExpression         │
  // │    ✅ → nested GuantrRuleCondition (auto-completes keys)    │
  // │                                                             │
  // │  author.email (string|null):                                │
  // │    ✅ ['eq', null]  or ['eq', 'value']                      │
  // │                                                             │
  // │  author.address (object|null):                              │
  // │    ✅ ['eq', null]  or nested                               │
  // │  author.address.city (string|null):                         │
  // │    ✅ ['eq', null]  or ['eq', 'NYC']                        │
  // │  author.address.zip? (string|undefined):                    │
  // │    ✅ ['eq', undefined]  or ['eq', '10001']                 │
  // │                                                             │
  // │  tags (string[]|null):                                      │
  // │    ✅ ['eq', null]  or array expressions                     │
  // └─────────────────────────────────────────────────────────────┘
  const nullableCond: GuantrRuleCondition<NullableModel, NullableCtx> = {
    id: ['eq', 1],
    title: ['eq', 'Hello'],
    description: ['eq', null],
    author: {
      name: ['eq', 'Alice'],
      email: ['eq', null],
      address: {
        city: ['eq', null],
      },
    },
    tags: ['eq', null],
  };

  const nc2 = nullableCond as GuantrRuleCondition;
  assert(nullableCond.description?.[0] === 'eq', 'Nullable: string|null allows eq null');
  const ncAuthor = nc2.author as GuantrRuleCondition;
  const ncAddr = ncAuthor.address as GuantrRuleCondition;
  assert(
    Array.isArray(ncAddr.city) && ncAddr.city[0] === 'eq',
    'Nullable: nested nullable object property (author.address.city can be null)',
  );

  // Optional fields - an optional field can be absent
  const optionalCond: GuantrRuleCondition<NullableModel, NullableCtx> = {
    subtitle: ['eq', undefined],
  };
  assert(optionalCond.subtitle?.[0] === 'eq', 'Optional: subtitle? allows eq undefined');

  // Runtime: nullable field not matching
  assert(
    !testMatch(
      { id: 1, title: 'Hello', description: 'exists', author: null, tags: [], metadata: {} },
      nc2,
    ),
    'Nullable: description is not null → should not match',
  );

  // Runtime: nullable fields matching
  assert(
    testMatch(
      {
        id: 1,
        title: 'Hello',
        description: null,
        author: { name: 'Alice', email: null, address: { street: '123', city: null } },
        tags: null,
        metadata: {},
      },
      nc2,
    ),
    'Nullable: all null fields match eq null',
  );

  // Runtime: author is null — nested condition traversal
  assert(
    !testMatch(
      { id: 1, title: 'Hello', description: null, author: null, tags: null, metadata: {} },
      nc2,
    ),
    'Nullable: author is null → nested checks fail gracefully',
  );

  /* ------------------------------------------------------------------ */
  /*  9e. Deeply nested model (6 levels)                                 */
  /* ------------------------------------------------------------------ */
  sub('9e. Deeply nested model (6 levels)');

  // ┌─────────────────────────────────────────────────────────────┐
  // │  TYPE COMPLETION CHECKPOINT — 6-level deep condition        │
  // │                                                             │
  // │  The autocomplete should drill down through ALL levels:      │
  // │                                                             │
  // │  level1 → level2 → level3 → level4 → value (string)        │
  // │                                      → numbers (number[])   │
  // │                                      → level5 → flag (bool) │
  // │                                               → deepArray   │
  // │                                                 → ['some',  │
  // │                                                     level6  │
  // │                                                       → name│
  // │                                                 ]            │
  // │                                                             │
  // │  Each nested level should narrow the available keys.        │
  // └─────────────────────────────────────────────────────────────┘
  const deepCond: GuantrRuleCondition<DeepModel, DeepCtx> = {
    level1: {
      level2: {
        level3: {
          level4: {
            value: ['eq', 'found'],
            level5: {
              flag: ['eq', true],
              deepArray: [
                'some',
                {
                  level6: { name: ['eq', 'target'] },
                },
              ],
            },
          },
        },
      },
    },
  };

  const dc = deepCond as GuantrRuleCondition;
  const l1 = dc.level1 as GuantrRuleCondition;
  const l2 = l1.level2 as GuantrRuleCondition;
  const l3 = l2.level3 as GuantrRuleCondition;
  const l4 = l3.level4 as GuantrRuleCondition;
  assert(
    Array.isArray(l4.value) && l4.value[0] === 'eq',
    'Deep nested: 4 levels deep string condition works',
  );
  const l5 = l4.level5 as GuantrRuleCondition;
  assert(
    Array.isArray(l5.deepArray) && l5.deepArray[0] === 'some',
    'Deep nested: 5 levels deep with some on object array works',
  );
  // deepArray is ['some', { level6: { name: [...] } }]
  const deepArrItem = l5.deepArray[1] as GuantrRuleCondition;
  const l6 = deepArrItem.level6 as GuantrRuleCondition;
  assert(
    Array.isArray(l6.name) && l6.name[0] === 'eq',
    'Deep nested: 6 levels deep with nested condition inside some works',
  );

  // Runtime
  const deepData: DeepModel = {
    level1: {
      level2: {
        level3: {
          level4: {
            value: 'found',
            numbers: [1, 2, 3],
            level5: {
              flag: true,
              deepArray: [
                { id: 1, level6: { name: 'target' } },
                { id: 2, level6: { name: 'other' } },
              ],
            },
          },
        },
      },
    },
  };
  assert(testMatch(deepData, dc), 'Deep nested: 6-level deep condition matches runtime data');

  // Deep nested — wrong value at leaf
  assert(
    !testMatch(
      {
        ...deepData,
        level1: {
          ...deepData.level1,
          level2: {
            ...deepData.level1.level2,
            level3: {
              ...deepData.level1.level2.level3,
              level4: { ...deepData.level1.level2.level3.level4, value: 'missing' },
            },
          },
        },
      },
      dc,
    ),
    'Deep nested: leaf value mismatch → false',
  );

  /* ------------------------------------------------------------------ */
  /*  9f. Union / literal types                                          */
  /* ------------------------------------------------------------------ */
  sub('9f. Union and literal types');

  // ┌─────────────────────────────────────────────────────────────┐
  // │  TYPE COMPLETION CHECKPOINT — union / literal fields        │
  // │                                                             │
  // │  status: 'draft'|'published'|'archived'                     │
  // │    ✅ ['eq', 'draft'] → auto-suggests the literals          │
  // │    ✅ ['in', ['draft', 'published']]                        │
  // │                                                             │
  // │  priority: 1|2|3|4|5                                        │
  // │    ✅ ['gte', 3] → auto-suggests 1|2|3|4|5                  │
  // │    ✅ ['in', [1, 2, 3]]                                     │
  // └─────────────────────────────────────────────────────────────┘
  const unionCond: GuantrRuleCondition<UnionModel, UnionCtx> = {
    status: ['eq', 'published'],
    visibility: ['eq', 'public'],
    kind: ['in', ['article', 'note']],
    priority: ['gte', 3],
  };

  assert(unionCond.status?.[0] === 'eq', 'Union: string union works with eq');
  assert(unionCond.priority?.[0] === 'gte', 'Union: numeric literal union works with gte');

  const uc = unionCond as GuantrRuleCondition;

  // Runtime
  assert(
    testMatch(
      {
        id: 1,
        status: 'published',
        visibility: 'public',
        kind: 'article',
        priority: 4,
        metadata: {},
      },
      uc,
    ),
    'Union model: all conditions match',
  );

  assert(
    !testMatch(
      { id: 1, status: 'draft', visibility: 'public', kind: 'article', priority: 4, metadata: {} },
      uc,
    ),
    'Union model: status=draft does not match eq published',
  );

  /* ------------------------------------------------------------------ */
  /*  9g. Context operands with complex model                             */
  /* ------------------------------------------------------------------ */
  sub('9g. Context operands with model conditions');

  const guantr = await createGuantr<_ArrayMeta>({
    getContext: () => ({ currentUserId: 42, roles: ['admin', 'editor'] }),
  });

  await guantr.setRules([
    {
      effect: 'allow',
      action: 'delete',
      resource: 'post',
      // Condition uses model.comments array with some operator
      // paired with $ctx context operand
      condition: {
        comments: [
          'some',
          {
            authorId: ['eq', '$ctx.currentUserId'],
          },
        ],
      },
    },
  ]);

  assert(
    await guantr.can('delete', [
      'post',
      {
        id: 1,
        tags: [],
        scores: [],
        flags: [],
        comments: [{ id: 1, text: 'Mine', authorId: 42, moderated: true, reactions: [] }],
        nestedArrays: [],
      },
    ]),
    'Context operand with object array: authorId matches $ctx.currentUserId',
  );

  assert(
    !(await guantr.can('delete', [
      'post',
      {
        id: 1,
        tags: [],
        scores: [],
        flags: [],
        comments: [{ id: 1, text: 'Theirs', authorId: 99, moderated: true, reactions: [] }],
        nestedArrays: [],
      },
    ])),
    'Context operand with object array: authorId 99 does not match $ctx.currentUserId',
  );

  /* ------------------------------------------------------------------ */
  /*  9h. End-to-end typed mode with complex model + context             */
  /* ------------------------------------------------------------------ */
  sub('9h. End-to-end: complex model + context');

  const fullGuantr = await createGuantr<_NullableMeta>({
    getContext: () => ({ userId: 1, email: 'admin@test.com' }),
  });

  await fullGuantr.setRules([
    // Allow reading articles with a published author
    {
      effect: 'allow',
      action: 'read',
      resource: 'article',
      condition: {
        author: {
          email: ['eq', '$ctx.email'],
          address: {
            city: ['eq', 'NYC'],
          },
        },
      },
    },
    // Allow reading if description is null (unpublished placeholders)
    {
      effect: 'allow',
      action: 'read',
      resource: 'article',
      condition: {
        description: ['eq', null],
      },
    },
  ]);

  const articleWithAuthor = {
    id: 1,
    title: 'Test',
    description: 'Full article',
    author: {
      name: 'Admin',
      email: 'admin@test.com',
      address: { street: '1 Main', city: 'NYC' },
    },
    tags: ['news'],
    metadata: {},
  };

  assert(
    await fullGuantr.can('read', ['article', articleWithAuthor]),
    'End-to-end: nested condition with $ctx.email matches author.email',
  );

  const articleWithNullDesc = {
    id: 2,
    title: 'Draft',
    description: null,
    author: null,
    tags: null,
    metadata: {},
  };

  assert(
    await fullGuantr.can('read', ['article', articleWithNullDesc]),
    'End-to-end: nullable description eq null → allowed',
  );

  /* ------------------------------------------------------------------ */
  /*  Summary                                                             */
  /* ------------------------------------------------------------------ */
  info(
    'Complex resource models verified — nested objects, primitive arrays, object arrays, nullable, optional, deep nesting, union types.',
  );
}
