import { defineConfig } from "vitest/config";

// No test mocks a module or changes globals or env; a test that fakes the clock restores it after each test.
export default defineConfig({ test: { environment: "node", isolate: false } });
