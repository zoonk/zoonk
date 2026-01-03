import { createBaseConfig } from "@zoonk/e2e/base.config";

const E2E_DATABASE_URL =
  "postgres://postgres:postgres@localhost:5432/zoonk_e2e";

export default createBaseConfig({
  baseURL: "http://localhost:3000",
  globalSetup: "./e2e/global-setup.ts",
  port: 3000,
  testDir: "./e2e",
  webServerEnv: {
    // biome-ignore lint/style/useNamingConvention: environment variable naming
    DATABASE_URL: E2E_DATABASE_URL,
    // biome-ignore lint/style/useNamingConvention: environment variable naming
    DATABASE_URL_UNPOOLED: E2E_DATABASE_URL,
  },
});
