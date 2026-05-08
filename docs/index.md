---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: 'Guantr'
  text: 'Flexible, type-safe'
  tagline: JavaScript library for efficient authorization and permission checking
  actions:
    - theme: brand
      text: Quick Start
      link: /quick-start
    - theme: alt
      text: Read Introduction
      link: /introduction

features:
  - icon: 🔒
    title: Type-safe
    details: Misspelled an action? Wrong field in a condition? TypeScript catches it before your code runs.
    link: /guides/typescript-integration
  - icon: 🏗️
    title: Builder DSL
    details: <code>eq</code>, <code>and</code>, <code>some</code>, <code>contains</code> — 17 operators with operand types enforced at compile time.
    link: /guides/defining-rules/condition-operators
  - icon: 📦
    title: Serializable to JSON
    details: Conditions become plain JSON. Store them wherever you want — database, config file, edge KV.
    link: /api/utilities#serializerules
  - icon: 🌐
    title: Any runtime, any framework
    details: Node, Deno, Bun, edge, browser. No opinions on your server or framework.
  - icon: 💾
    title: Bring your own storage
    details: Adapters for SQLite, PostgreSQL, Prisma, Drizzle — or write your own.
    link: /advanced-usage/custom-storage-adapter
  - icon: ⚡
    title: Deny wins, always
    details: Unconditional denies short-circuit. Conditional denies override allows. Simple, predictable.
    link: /guides/defining-rules#rule-precedence
---
