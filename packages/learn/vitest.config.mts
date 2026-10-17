import { defineConfig } from "vitest/config";

// No test mocks a module or changes the clock, globals or env.
export default defineConfig({ test: { environment: "node", isolate: false } });
