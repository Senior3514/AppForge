import { defineConfig } from "vitest/config";

// Against a shared real database, test files must not run concurrently (they would race on fixed fixture ids).
export default defineConfig({ test: { fileParallelism: !process.env.TEST_DATABASE_URL } });
