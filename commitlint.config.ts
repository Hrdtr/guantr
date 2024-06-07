import type { UserConfig } from '@commitlint/types'

const Configuration: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'docs', 'chore', 'style', 'refactor', 'ci', 'test', 'revert', 'perf', 'build']],
  },
}

module.exports = Configuration
