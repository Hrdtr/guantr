---
description: 'Glossary of key terms used in the Guantr documentation — ABAC, RBAC, conditions, rules, storage adapters, and other authorization concepts.'
---

# Glossary of Terms

This glossary defines key terms used in the Guantr documentation to help ensure a common understanding.

---

## **ABAC (Attribute-Based Access Control)**

An authorization model where access decisions are made based on evaluating various attributes of the subject (user), resource, action, and environment. Guantr implements ABAC through its `Condition` system. See the [ABAC Reference](/guides/common-patterns#9-abac-attribute-to-builder-reference).

## **Action**

A string representing the operation a user attempts to perform on a `Resource` (e.g., `'read'`, `'create'`, `'delete'`). Defined as part of a `Rule` and typically declared within `GuantrMeta` for type safety.

## **Condition**

An optional property within a `Rule`. It's a serialized AST tree returned by the `matchCondition` builder DSL, comprising `AstNode`s (`OperatorNode`, `LogicalNode`) wrapped in a `Condition` object. Conditions enable fine-grained control for ABAC and ReBAC patterns. Defined as `Condition`.

## **Condition Expression**

A term from Guantr v1.x. In v2, conditions are composed using the type-safe builder DSL (
`eq`, `ne`, `in`, `and`, `or`, etc.) rather than the legacy tuple format `[Operator, Operand, Options?]`. The builder returns a `Condition` AST that can be serialized to JSON for storage and evaluated at check time. See the [Migration Guide](/guides/migration-v1-to-v2.md) for details.

## **Context**

An object containing dynamic information relevant to a permission check, usually pertaining to the user or environment (e.g., user ID, roles, IP address). It's made available during rule evaluation via the builder's `context()` method inside `matchCondition` functions. The shape of this object is defined in `GuantrMeta` and provided by the `context` option.

## **Effect**

A property of a `Rule` indicating the outcome if the rule matches. It must be either `'allow'` (granting permission) or `'deny'` (revoking permission). `deny` rules take precedence over `allow` rules.

## **`context`**

An optional value or function provided in the `GuantrOptions` during `createGuantr` initialization. It provides the `Context` object used during rule evaluation. When a plain object is passed, it is used as a static context. When a function is passed, it is called on every `can`/`cannot` check (once per batch) to resolve the context. See the [Using Context Effectively Guide](/guides/context-usage.md).

## **`GuantrMeta`**

A TypeScript type (`GuantrMeta<ResourceMap, Context>`) used to define an application's complete authorization model for Guantr, including all resources, their actions, their data models (`ResourceMap`), and the shape of the `Context` object. Using `GuantrMeta` enables strong type safety and autocompletion. See the [TypeScript Integration Guide](/guides/typescript-integration.md).

## **Operand**

The value part within an AST node (specifically `OperatorNode.operands`). In v2, operands are `ValueRef` objects — either a `ResourceRef` (`{ type: 'resource', path: '...' }`), a `ContextRef` (`{ type: 'context', path: '...' }`), or a `LiteralRef` (`{ type: 'literal', value: ... }`). V1 used string-prefixed operands (`'$ctx.field'`), which are no longer supported.

## **Operator**

The keyword within an AST node specifying the comparison logic (`'eq'`, `'in'`, `'contains'`, `'gt'`, `'some'`, `'and'`, `'or'`, `'not'`, etc.). In the builder DSL, each operator corresponds to a typed method on `MatchConditionBuilder` (e.g., `builder.eq()`, `builder.and()`). See the [Condition Operators Explained Guide](/guides/defining-rules/condition-operators.md).

## **RBAC (Role-Based Access Control)**

An authorization model where permissions are assigned to predefined roles (e.g., 'admin', 'viewer'), and users are granted access based on the roles they hold. See the [Role-Based Access pattern](/guides/common-patterns#2-role-based-access).

## **ReBAC (Relationship-Based Access Control)**

An authorization model where permissions are determined based on the relationships between entities (e.g., user owns document, user is in group). Often considered a specific pattern implemented using ABAC principles. Guantr supports ReBAC patterns through `Condition`s checking relationship attributes.

## **Resource**

The entity or type of entity being acted upon (e.g., an article, a user profile, settings). In rule definitions (`GuantrRule`), the `resource` property typically refers to the string _key_ or _type name_ (e.g., `'article'`). `GuantrMeta` further defines the allowed `action`s and data `model` for each resource type.

## **Rule**

The fundamental unit defining a permission statement in Guantr. It consists of an `effect` (`'allow'` or `'deny'`), an `action` (string), a `resource` key (string), and an optional `condition` object. Defined as `GuantrRule`. Rules are managed via the `setRules` method.

## **Storage**

The mechanism responsible for persisting, retrieving (`getRules`, `queryRules`) Guantr `Rule`s, as well as optionally caching (`cache`) results. Defined by the `Storage` interface. Implementations can range from `InMemoryStorage` to custom adapters for databases or external stores. See the [Custom Storage Adapter Guide](/advanced-usage/custom-storage-adapter.md).
