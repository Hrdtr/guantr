# Changelog

## v2.0.0

[compare changes](https://github.com/Hrdtr/guantr/compare/v1.1.0...v2.0.0)

### 🚀 Enhancements

- ⚠️  Remove string-mode from can and cannot ([ac2491d](https://github.com/Hrdtr/guantr/commit/ac2491d))
- ⚠️  Remove ctx. alias for contextual operands ([eebd795](https://github.com/Hrdtr/guantr/commit/eebd795))
- **core:** Throw error on missing condition keys ([925435d](https://github.com/Hrdtr/guantr/commit/925435d))
- Add batch permission checks ([8a49f31](https://github.com/Hrdtr/guantr/commit/8a49f31))
- ⚠️  Add type-safe condition builder DSL ([23be1e4](https://github.com/Hrdtr/guantr/commit/23be1e4))

### 🩹 Fixes

- Handle BigInt and Date in cache serialization ([3aa0fa5](https://github.com/Hrdtr/guantr/commit/3aa0fa5))
- Clean stableStringify set and improve types ([86c32b7](https://github.com/Hrdtr/guantr/commit/86c32b7))
- **docs:** Rename condition column, add getRules ([76e16f9](https://github.com/Hrdtr/guantr/commit/76e16f9))
- **docs:** Correct column name in SQL query ([792583c](https://github.com/Hrdtr/guantr/commit/792583c))

### 💅 Refactors

- ⚠️  Drop strict mode, always validate conditions ([1435f5f](https://github.com/Hrdtr/guantr/commit/1435f5f))
- **storage:** ⚠️  Make cache.has required ([2e603b6](https://github.com/Hrdtr/guantr/commit/2e603b6))
- ⚠️  Remove clearRules and make setRules atomic ([23581d4](https://github.com/Hrdtr/guantr/commit/23581d4))
- ⚠️  Remove Context generic and rename types ([7565575](https://github.com/Hrdtr/guantr/commit/7565575))
- ⚠️  Rename can/cannot to allow/deny ([4528d0c](https://github.com/Hrdtr/guantr/commit/4528d0c))
- **tests:** Restructure test suite, eliminate `as any`, and reach 100% coverage ([37c22b8](https://github.com/Hrdtr/guantr/commit/37c22b8))

### 📖 Documentation

- Add index on rules table example ([bca4d54](https://github.com/Hrdtr/guantr/commit/bca4d54))
- Add assignRuleToRole method to ScopedStorage example ([d7e5d64](https://github.com/Hrdtr/guantr/commit/d7e5d64))
- Remove dead links ([cc9dd89](https://github.com/Hrdtr/guantr/commit/cc9dd89))

### 🏡 Chore

- Enable ts no explicit any linter rule ([448d6a8](https://github.com/Hrdtr/guantr/commit/448d6a8))
- Deps update ([df34731](https://github.com/Hrdtr/guantr/commit/df34731))
- Deps update ([d8306f8](https://github.com/Hrdtr/guantr/commit/d8306f8))

#### ⚠️ Breaking Changes

- ⚠️  Remove string-mode from can and cannot ([ac2491d](https://github.com/Hrdtr/guantr/commit/ac2491d))
- ⚠️  Remove ctx. alias for contextual operands ([eebd795](https://github.com/Hrdtr/guantr/commit/eebd795))
- ⚠️  Add type-safe condition builder DSL ([23be1e4](https://github.com/Hrdtr/guantr/commit/23be1e4))
- ⚠️  Drop strict mode, always validate conditions ([1435f5f](https://github.com/Hrdtr/guantr/commit/1435f5f))
- **storage:** ⚠️  Make cache.has required ([2e603b6](https://github.com/Hrdtr/guantr/commit/2e603b6))
- ⚠️  Remove clearRules and make setRules atomic ([23581d4](https://github.com/Hrdtr/guantr/commit/23581d4))
- ⚠️  Remove Context generic and rename types ([7565575](https://github.com/Hrdtr/guantr/commit/7565575))
- ⚠️  Rename can/cannot to allow/deny ([4528d0c](https://github.com/Hrdtr/guantr/commit/4528d0c))

### ❤️ Contributors

- Herdi Tr. <iam@icm.hrdtr.dev>

## v1.1.0

[compare changes](https://github.com/Hrdtr/guantr/compare/v1.0.1...v1.1.0)

### 🚀 Enhancements

- Export GuantrOptions and ConditionOperator ([10bfd2c](https://github.com/Hrdtr/guantr/commit/10bfd2c))
- Add can.abstract and cannot.abstract methods ([ef7e9f1](https://github.com/Hrdtr/guantr/commit/ef7e9f1))
- ⚠️ Throw error on circuit breaker trip ([fc89b40](https://github.com/Hrdtr/guantr/commit/fc89b40))
- Add strict validation mode for conditions ([3805f38](https://github.com/Hrdtr/guantr/commit/3805f38))
- Support async callbacks in setRules ([d0e51b9](https://github.com/Hrdtr/guantr/commit/d0e51b9))
- Export utility functions ([2007ef1](https://github.com/Hrdtr/guantr/commit/2007ef1))

### 🔥 Performance

- Add caching to getRules and early deny in can() ([6da6a3c](https://github.com/Hrdtr/guantr/commit/6da6a3c))

### 🩹 Fixes

- Deduplicate getContext() calls in can() path ([05a3a43](https://github.com/Hrdtr/guantr/commit/05a3a43))
- Cache lookup ambiguity for adapters without `has` method ([995d494](https://github.com/Hrdtr/guantr/commit/995d494))
- Ambiguity on `validateValueType` error messaging ([c0827d9](https://github.com/Hrdtr/guantr/commit/c0827d9))
- Misleading test in `some.test.ts` ([0bd2227](https://github.com/Hrdtr/guantr/commit/0bd2227))
- .editorconfig missing target for other file types rule ([920e338](https://github.com/Hrdtr/guantr/commit/920e338))
- `commitlint.config.ts` module format ([371ced6](https://github.com/Hrdtr/guantr/commit/371ced6))
- Lint severity ([cbeb8d1](https://github.com/Hrdtr/guantr/commit/cbeb8d1))
- `tsconfig.json` missing test include ([67d27cd](https://github.com/Hrdtr/guantr/commit/67d27cd))
- Add missing `none` operator test file ([72d7841](https://github.com/Hrdtr/guantr/commit/72d7841))
- Missing await in some test ([81a6125](https://github.com/Hrdtr/guantr/commit/81a6125))
- Apply CodeRabbit auto-fixes ([a4a6701](https://github.com/Hrdtr/guantr/commit/a4a6701))
- Apply CodeRabbit auto-fixes ([216f4de](https://github.com/Hrdtr/guantr/commit/216f4de))
- Add 'cannot' to string-mode deprecation warning ([0eb673e](https://github.com/Hrdtr/guantr/commit/0eb673e))
- Add 'cannot' to string-mode deprecation warning ([aafaa26](https://github.com/Hrdtr/guantr/commit/aafaa26))
- Handle async callbacks and validate maxRuleIterations ([a729a7f](https://github.com/Hrdtr/guantr/commit/a729a7f))

### 💅 Refactors

- Move GuantrCircuitBreakerError to errors module ([04a24e1](https://github.com/Hrdtr/guantr/commit/04a24e1))

### 📖 Documentation

- Fix import path, return types, and context examples ([b627373](https://github.com/Hrdtr/guantr/commit/b627373))
- Cache optionality and get rules method return ([c99c1b5](https://github.com/Hrdtr/guantr/commit/c99c1b5))
- **storage:** Clarify setRules appends rules ([967cda2](https://github.com/Hrdtr/guantr/commit/967cda2))
- Add constructor/utilities docs and update condition guides ([d466b2c](https://github.com/Hrdtr/guantr/commit/d466b2c))

### 🏡 Chore

- Adopt oxc for linting and formatting, deps update ([e19dc13](https://github.com/Hrdtr/guantr/commit/e19dc13))
- Update lint-staged config and automd trigger ([4d619ac](https://github.com/Hrdtr/guantr/commit/4d619ac))
- **ci:** Update actions to latest major versions ([a2d20ec](https://github.com/Hrdtr/guantr/commit/a2d20ec))
- **ci:** Replace pnpm fmt with pnpm fmt:check in ci.yml ([8622435](https://github.com/Hrdtr/guantr/commit/8622435))
- **ci:** Consistent pnpm setup, frozen lockfile install ([2952f19](https://github.com/Hrdtr/guantr/commit/2952f19))
- **release:** V1.0.2 ([835b2c2](https://github.com/Hrdtr/guantr/commit/835b2c2))

### ✅ Tests

- Add and update tests for core features and edge cases ([8512a6e](https://github.com/Hrdtr/guantr/commit/8512a6e))

### 🤖 CI

- Use latest checkout and configure-pages ([97c828e](https://github.com/Hrdtr/guantr/commit/97c828e))
- Fix indentation for checkout step in deploy workflow ([e50300b](https://github.com/Hrdtr/guantr/commit/e50300b))

#### ⚠️ Breaking Changes

- ⚠️ Throw error on circuit breaker trip ([fc89b40](https://github.com/Hrdtr/guantr/commit/fc89b40))

### ❤️ Contributors

- Herdi Tr. ([@Hrdtr](https://github.com/Hrdtr))

## v1.0.2

[compare changes](https://github.com/Hrdtr/guantr/compare/v1.0.1...v1.0.2)

### 📖 Documentation

- Fix import path, return types, and context examples ([b627373](https://github.com/Hrdtr/guantr/commit/b627373))
- Cache optionality and get rules method return ([c99c1b5](https://github.com/Hrdtr/guantr/commit/c99c1b5))

### 🏡 Chore

- Adopt oxc for linting and formatting, deps update ([e19dc13](https://github.com/Hrdtr/guantr/commit/e19dc13))
- Update lint-staged config and automd trigger ([4d619ac](https://github.com/Hrdtr/guantr/commit/4d619ac))
- **ci:** Update actions to latest major versions ([a2d20ec](https://github.com/Hrdtr/guantr/commit/a2d20ec))
- **ci:** Replace pnpm fmt with pnpm fmt:check in ci.yml ([8622435](https://github.com/Hrdtr/guantr/commit/8622435))
- **ci:** Consistent pnpm setup, frozen lockfile install ([2952f19](https://github.com/Hrdtr/guantr/commit/2952f19))

### 🤖 CI

- Use latest checkout and configure-pages ([97c828e](https://github.com/Hrdtr/guantr/commit/97c828e))
- Fix indentation for checkout step in deploy workflow ([e50300b](https://github.com/Hrdtr/guantr/commit/e50300b))

### ❤️ Contributors

- Herdi Tr. ([@Hrdtr](https://github.com/Hrdtr))

## v1.0.1

[compare changes](https://github.com/Hrdtr/guantr/compare/v1.0.0...v1.0.1)

### 💅 Refactors

- Extract and optimize ts types for better performance ([3a1fef9](https://github.com/Hrdtr/guantr/commit/3a1fef9))

### 📖 Documentation

- Fix dead link reference ([35f41eb](https://github.com/Hrdtr/guantr/commit/35f41eb))
- Add references section ([1b1d6ab](https://github.com/Hrdtr/guantr/commit/1b1d6ab))
- Fix dead link reference ([8075709](https://github.com/Hrdtr/guantr/commit/8075709))
- Add missing condition operator in prisma query transformer ([c8d0776](https://github.com/Hrdtr/guantr/commit/c8d0776))

### 🏡 Chore

- Bump version to 1.0.1 ([faba83e](https://github.com/Hrdtr/guantr/commit/faba83e))

### ❤️ Contributors

- Herdi Tr. ([@Hrdtr](https://github.com/Hrdtr))
- Herdi Tr ([@Hrdtr](https://github.com/Hrdtr))

## v1.0.0

[compare changes](https://github.com/Hrdtr/guantr/compare/v1.0.0-rc.8...v1.0.0)

### 💅 Refactors

- ⚠️ Internal api improvements and ship storage adapter feature ([a7f59b4](https://github.com/Hrdtr/guantr/commit/a7f59b4))

#### ⚠️ Breaking Changes

- ⚠️ Internal api improvements and ship storage adapter feature ([a7f59b4](https://github.com/Hrdtr/guantr/commit/a7f59b4))

### ❤️ Contributors

- Herdi Tr ([@Hrdtr](https://github.com/Hrdtr))
