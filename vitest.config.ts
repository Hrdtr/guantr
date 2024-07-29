import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      enabled: true,
      exclude: ['*.config.{json,js,cjs,mjs,ts,cts,mts}', 'dist/**', 'docs/**']
    },
    typecheck: {
      enabled: true
    }
  },
})
