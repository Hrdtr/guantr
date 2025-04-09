# Comparison with Alternatives

Choosing an authorization solution involves considering various factors like your application architecture, team's familiarity with tools, required level of flexibility, and performance needs. This page provides a brief comparison between Guantr and other popular authorization libraries/systems to help you understand Guantr's positioning.

**Note:** This comparison is not exhaustive and focuses on high-level design philosophies and features. We recommend evaluating each solution based on your specific requirements.

## Guantr: Philosophy & Strengths

* **Approach:** Library-first, JavaScript/TypeScript-centric. Authorization logic is defined and managed within your application code using familiar language constructs (objects, arrays, functions).
* **Strengths:**
    * **Excellent TypeScript Integration:** `GuantrMeta` provides strong type safety, autocompletion, and refactoring confidence for rules, context, and checks.
    * **Embedded Logic:** Rules live alongside your application code, which can simplify development workflows for smaller teams or monoliths.
    * **Flexible Condition System:** Offers a clear `[operator, operand]` syntax for defining attribute-based and relationship-based conditions.
    * **Customizable:** Pluggable `Storage` adapter interface allows using different backends (in-memory, DBs, custom) for rule persistence and caching.
    * **Context-Aware:** Integrates easily with request-specific or user-specific data via the `getContext` mechanism.
* **Trade-offs:**
    * Primarily targets the JS/TS ecosystem.
    * Policy logic is coupled with application code, unlike decoupled policy engines.
    * Uses a specific condition syntax rather than a standardized policy language like OPA's Rego or Google's CEL.

## Comparison Points

### Guantr vs. CASL

* **Similarities:** Both are isomorphic JavaScript/TypeScript authorization libraries. Both emphasize defining permissions within the application code using JS/TS. Both support fine-grained permissions, conditions, and context awareness. Guantr acknowledges inspiration from CASL.
* **Key Differences & Guantr Focus:**
    * **Typing:** Guantr uses `GuantrMeta` for defining the entire authorization model (resources, actions, models, context) upfront, providing potentially more comprehensive compile-time safety across the whole system compared to CASL's ability-centric definitions.
    * **Condition Syntax:** Guantr employs a specific array-based `[operator, operand]` syntax for conditions, while CASL uses a more object-oriented or MongoDB-like query syntax for conditions.
    * **Storage:** Guantr defines a distinct `Storage` interface with methods like `queryRules`, allowing different backend implementations for rule persistence and caching. CASL's core is generally focused on defining abilities, with persistence handled separately or via integrations like `@casl/prisma`.

* **Choose Guantr if:** You prioritize a highly integrated TypeScript experience with a structured meta-definition, prefer the `[operator, operand]` condition style, and want a clear interface for custom rule storage.

### Guantr vs. Oso

* **Key Difference:** Guantr is a library for defining rules *within* your JS/TS code. Oso is primarily a policy engine that evaluates policies written in a separate, declarative language called Polar. Oso can be used as a library embedded in your application or potentially as a service.
* **Guantr Strengths:** Tighter integration with JS/TS types and tooling (`GuantrMeta`), potentially simpler setup if you prefer keeping logic within your main codebase. No separate policy language to learn if your team is primarily JS/TS focused.
* **Oso Strengths:** Decoupled policies written in Polar are language-agnostic (the policy can be evaluated from different application languages via Oso libraries). Polar is designed specifically for authorization logic. Strong modeling capabilities for RBAC, ReBAC, and ABAC.
* **Trade-offs:** Embedded JS/TS logic (Guantr) vs. Decoupled Polar policies (Oso). Learning curve of Polar vs. using JS objects/arrays.

* **Choose Guantr if:** You want to define authorization rules directly within your JavaScript/TypeScript application, leveraging the existing language and type system.
* **Choose Oso if:** You need decoupled authorization policies, want to use a dedicated policy language (Polar), or need to enforce the same policies across applications written in different languages.

### Guantr vs. Cerbos

* **Key Difference:** Guantr is a library embedded within your application. Cerbos is typically deployed as a **standalone, stateless authorization service (PDP)** that your application communicates with (e.g., via API/gRPC). Cerbos can also be embedded using WASM.
* **Policy Language:** Cerbos uses policies defined primarily in YAML, with conditions expressed using Google's Common Expression Language (CEL). Guantr uses JS/TS objects and arrays.
* **Guantr Strengths:** Simpler architecture for single applications or monoliths (no separate service to deploy/manage). Authorization logic is co-located with application code.
* **Cerbos Strengths:** Language-agnostic (any application that can call its API can use it). Designed for microservices and scalability. Centralized policy management, testing, and GitOps workflows via Cerbos Hub. Policies are fully decoupled from application code.
* **Trade-offs:** Embedded library (Guantr) vs. External service (Cerbos). JS/TS specific vs. Language-agnostic. Simplicity vs. Centralization/Scalability.

* **Choose Guantr if:** You prefer embedding authorization logic directly within your JS/TS application and don't require a separate authorization service or language-agnostic policies.
* **Choose Cerbos if:** You need a language-agnostic, decoupled authorization solution, are building microservices, require centralized policy management and deployment workflows, or need high scalability handled by a dedicated service.

## Conclusion

Guantr excels as a **type-safe, flexible, JavaScript/TypeScript-native authorization library**. It's well-suited for projects where developers prefer defining authorization rules directly within their application code, leveraging the power of TypeScript for safety and maintainability.

* Compared to **CASL**, it offers a similar library-based approach but with distinct typing (`GuantrMeta`) and condition syntax (`[op, operand]`) paradigms.
* Compared to **Oso**, it keeps logic within JS/TS instead of using a separate policy language (Polar).
* Compared to **Cerbos**, it provides an embedded library experience rather than a decoupled authorization service.

The best choice always depends on your specific project architecture, team expertise, scalability requirements, and policy management needs.
