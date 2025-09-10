import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  resolve: { alias: { '@': resolve(import.meta.dirname, 'src') } },
  // Both suites migrate the same database from scratch, so they must not race.
  test: { environment: 'node', hookTimeout: 60000, fileParallelism: false },
})
