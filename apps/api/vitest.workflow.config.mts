import { createRequire } from "node:module";
import { defineConfig } from "vitest/config";
import { getTestRunEnvironment } from "../../packages/db/src/test-environment";

const runtimeRequire = createRequire(import.meta.url);

/** Real Workflow execution has its own config: the normal API suite replaces its runtime. */
export default defineConfig({
  assetsInclude: ["**/*.md"],
  resolve: { dedupe: ["next"], tsconfigPaths: true },
  ssr: { resolve: { conditions: ["react-server", "node"] } },
  test: {
    env: {
      ...getTestRunEnvironment(),
      AI_GATEWAY_API_KEY: "",
      NEXT_PUBLIC_APP_DOMAIN: "localhost:9002",
      OPENAI_LIVE_API_KEY: "",
      WORKFLOW_LOCAL_RECOVER_ACTIVE_RUNS: "false",
      WORKFLOW_TARGET_WORLD: "local",
    },
    environment: "node",
    execArgv: ["--conditions=react-server"],
    globalSetup: ["../../packages/db/src/test-database.ts", "./workflow-runtime/build-runtime.ts"],
    include: ["workflow-runtime/*.runtime-spec.ts"],
    maxWorkers: 1,
    // Next's own setup installs Node AsyncLocalStorage before request-store modules load.
    setupFiles: [runtimeRequire.resolve("next/dist/server/node-environment-baseline.js")],
    testTimeout: 15_000,
  },
});
