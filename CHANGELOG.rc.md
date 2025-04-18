# Changelog


## v1.0.0-rc.8

[compare changes](https://github.com/Hrdtr/guantr/compare/v1.0.0-rc.7...v1.0.0-rc.8)

### 💅 Refactors

- Condition expression matcher & contextual values replacement ([c62597e](https://github.com/Hrdtr/guantr/commit/c62597e))

### 🏡 Chore

- Export prisma query filter transformer from parent dir ([466aa33](https://github.com/Hrdtr/guantr/commit/466aa33))

### ❤️ Contributors

- Herdi Tr. ([@Hrdtr](http://github.com/Hrdtr))

## v1.0.0-rc.7

[compare changes](https://github.com/Hrdtr/guantr/compare/v1.0.0-rc.6...v1.0.0-rc.7)

### 🩹 Fixes

- Invalid return from condition expression check utility fn ([a540740](https://github.com/Hrdtr/guantr/commit/a540740))

### 📖 Documentation

- Add base api references ([cb07790](https://github.com/Hrdtr/guantr/commit/cb07790))

### 🏡 Chore

- Deps update ([ef21742](https://github.com/Hrdtr/guantr/commit/ef21742))
- Apply automated updates ([c6179e8](https://github.com/Hrdtr/guantr/commit/c6179e8))

### ❤️ Contributors

- Herdi Tr. ([@Hrdtr](http://github.com/Hrdtr))

## v1.0.0-rc.6

[compare changes](https://github.com/Hrdtr/guantr/compare/v1.0.0-rc.5...v1.0.0-rc.6)

### 🩹 Fixes

- Correcly handle overlapping permission ([48d6cf8](https://github.com/Hrdtr/guantr/commit/48d6cf8))

### 🏡 Chore

- Deps update ([1ee7410](https://github.com/Hrdtr/guantr/commit/1ee7410))
- Move inline test options to file ([4af7b97](https://github.com/Hrdtr/guantr/commit/4af7b97))
- Rename test folder ([5914b4c](https://github.com/Hrdtr/guantr/commit/5914b4c))

### ❤️ Contributors

- Herdi Tr. ([@Hrdtr](http://github.com/Hrdtr))

## v1.0.0-rc.5

[compare changes](https://github.com/Hrdtr/guantr/compare/v1.0.0-rc.4...v1.0.0-rc.5)

### 🚀 Enhancements

- Prisma query filter transformer ([f382d0c](https://github.com/Hrdtr/guantr/commit/f382d0c))

### 📖 Documentation

- Update quickstart to follow meta structure changes ([d30dd9b](https://github.com/Hrdtr/guantr/commit/d30dd9b))
- Update readme.md usage section to follow meta structure changes ([a020173](https://github.com/Hrdtr/guantr/commit/a020173))

### ❤️ Contributors

- Herdi Tr. ([@Hrdtr](http://github.com/Hrdtr))

## v1.0.0-rc.4

[compare changes](https://github.com/Hrdtr/guantr/compare/v1.0.0-rc.3...v1.0.0-rc.4)

### 💅 Refactors

- ⚠️  Per-resource action definition ([cf593ec](https://github.com/Hrdtr/guantr/commit/cf593ec))

#### ⚠️ Breaking Changes

- ⚠️  Per-resource action definition ([cf593ec](https://github.com/Hrdtr/guantr/commit/cf593ec))

### ❤️ Contributors

- Herdi Tr. ([@Hrdtr](http://github.com/Hrdtr))

## v1.0.0-rc.3

[compare changes](https://github.com/Hrdtr/guantr/compare/v1.0.0-rc.2...v1.0.0-rc.3)

### 🩹 Fixes

- Should be able to reach nullable operand ([c53675c](https://github.com/Hrdtr/guantr/commit/c53675c))

### ❤️ Contributors

- Herdi Tr. ([@Hrdtr](http://github.com/Hrdtr))

## v1.0.0-rc.2

[compare changes](https://github.com/Hrdtr/guantr/compare/v1.0.0-rc.1...v1.0.0-rc.2)

### 🩹 Fixes

- ⚠️  Temporary drop ability to generate query filter ([141b541](https://github.com/Hrdtr/guantr/commit/141b541))

### 💅 Refactors

- ⚠️  Remove support for dot-notation condition field ([02ceda1](https://github.com/Hrdtr/guantr/commit/02ceda1))

### 📖 Documentation

- Deploy initial documentation site ([e5795ce](https://github.com/Hrdtr/guantr/commit/e5795ce))

### 🏡 Chore

- Add github pr & issue templates ([93f1a37](https://github.com/Hrdtr/guantr/commit/93f1a37))
- Deps update ([65cb745](https://github.com/Hrdtr/guantr/commit/65cb745))

#### ⚠️ Breaking Changes

- ⚠️  Temporary drop ability to generate query filter ([141b541](https://github.com/Hrdtr/guantr/commit/141b541))
- ⚠️  Remove support for dot-notation condition field ([02ceda1](https://github.com/Hrdtr/guantr/commit/02ceda1))

### ❤️ Contributors

- Herdi Tr. ([@Hrdtr](http://github.com/Hrdtr))

## v1.0.0-rc.1


### 🚀 Enhancements

- Complete initial condition expressions matcher ([9a83960](https://github.com/Hrdtr/guantr/commit/9a83960))
- Prisma query filter transformer ([ff8cf28](https://github.com/Hrdtr/guantr/commit/ff8cf28))

### 🩹 Fixes

- Correct some & every expression matcher payload validation ([0e63159](https://github.com/Hrdtr/guantr/commit/0e63159))
- Handle multiple related permissions with condition correctly ([9d181be](https://github.com/Hrdtr/guantr/commit/9d181be))

### 📖 Documentation

- Add jsdoc comments ([f3d20db](https://github.com/Hrdtr/guantr/commit/f3d20db))

### 🏡 Chore

- Initial commit ([650c4a0](https://github.com/Hrdtr/guantr/commit/650c4a0))
- Clean up utils ([34f4d29](https://github.com/Hrdtr/guantr/commit/34f4d29))
- Update readme & package description ([6fe590e](https://github.com/Hrdtr/guantr/commit/6fe590e))
- Add rc release script ([e12685e](https://github.com/Hrdtr/guantr/commit/e12685e))

### ✅ Tests

- Match condition expression & can method with inverted permission ([75add1a](https://github.com/Hrdtr/guantr/commit/75add1a))
- Fix wrong schema.prisma path ([81af7ed](https://github.com/Hrdtr/guantr/commit/81af7ed))

### ❤️ Contributors

- Herdi Tr. ([@Hrdtr](http://github.com/Hrdtr))

