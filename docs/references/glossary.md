# Glossary of Terms

This glossary defines key terms used in the Guantr documentation to help ensure a common understanding.

---

## **ABAC (Attribute-Based Access Control)**

An authorization model where access decisions are made based on evaluating various attributes of the subject (user), resource, action, and environment. Guantr implements ABAC through its `Condition` system. See the [ABAC Guide](./guides/basic-abac.md).

## **Action**

A string representing the operation a user attempts to perform on a `Resource` (e.g., `'read'`, `'create'`, `'delete'`). Defined as part of a `Rule` and typically declared within `GuantrMeta` for type safety.

## **Condition**

An optional property within a `Rule`. It's an object defining specific criteria that must be met for the rule to apply. Keys correspond to `Resource` model properties, and values are `Condition Expressions`. Conditions enable fine-grained control for ABAC and ReBAC patterns. Defined as `GuantrRuleCondition` / `GuantrAnyRuleCondition`.

## **Condition Expression**

The value associated with a key inside a `Condition` object. It defines the specific comparison logic, typically using an array format
`[Operator, Operand, Options?]` (e.g., `['eq', 'value']`, `['in', ['a', 'b']]`). Defined as `GuantrAnyRuleConditionExpression`.

## **Context**

An object containing dynamic information relevant to a permission check, usually pertaining to the user or environment (e.g., user ID, roles, IP address). It's made available during rule evaluation via the `$ctx` prefix in `Operand`s. The shape of this object is defined in `GuantrMeta` and provided by the `getContext` function.

## **Effect**

A property of a `Rule` indicating the outcome if the rule matches. It must be either `'allow'` (granting permission) or `'deny'` (revoking permission). `deny` rules take precedence over `allow` rules.

## **`getContext`**

An optional asynchronous function provided in the `GuantrOptions` during `createGuantr` initialization. It's responsible for returning the `Context` object used during rule evaluation. See the [Using Context Effectively Guide](./using-context-effectively.md).

## **`GuantrMeta`**

A TypeScript type (`GuantrMeta<ResourceMap, Context>`) used to define an application's complete authorization model for Guantr, including all resources, their actions, their data models (`ResourceMap`), and the shape of the `Context` object. Using `GuantrMeta` enables strong type safety and autocompletion. See the [TypeScript Integration Guide](./typescript-integration.md).

## **Operand**

The value part within a `Condition Expression` (`[Operator, Operand, Options?]`) against which a resource property or context value is compared. Can be a literal value (string, number, boolean, array) or a string starting with `$ctx.` to reference a `Context` property.

## **Operator**

The keyword within a `Condition Expression` (`[Operator, Operand, Options?]`) specifying the comparison logic (e.g., `'eq'`, `'in'`, `'contains'`, `'gt'`, `'some'`). See the [Condition Operators Explained Guide](./condition-operators-explained.md).

## **RBAC (Role-Based Access Control)**

An authorization model where permissions are assigned to predefined roles (e.g., 'admin', 'viewer'), and users are granted access based on the roles they hold. See the [RBAC Guide](./guides/basic-rbac.md).

## **ReBAC (Relationship-Based Access Control)**

An authorization model where permissions are determined based on the relationships between entities (e.g., user owns document, user is in group). Often considered a specific pattern implemented using ABAC principles. Guantr supports ReBAC patterns through `Condition`s checking relationship attributes.

## **Resource**

The entity or type of entity being acted upon (e.g., an article, a user profile, settings). In rule definitions (`GuantrRule`), the `resource` property typically refers to the string *key* or *type name* (e.g., `'article'`). `GuantrMeta` further defines the allowed `action`s and data `model` for each resource type.

## **Rule**

The fundamental unit defining a permission statement in Guantr. It consists of an `effect` (`'allow'` or `'deny'`), an `action` (string), a `resource` key (string), and an optional `condition` object. Defined as `GuantrRule` / `GuantrAnyRule`. Rules are managed via the `setRules` method.

## **Storage**

The mechanism responsible for persisting, retrieving (`getRules`, `queryRules`), and clearing (`clearRules`) Guantr `Rule`s, as well as optionally caching (`cache`) results. Defined by the `Storage` interface. Implementations can range from `InMemoryStorage` to custom adapters for databases or external stores. See the [Custom Storage Adapter Guide](./advanced/storage-adapter.md).
