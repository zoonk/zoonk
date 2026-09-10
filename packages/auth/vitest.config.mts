import { getTestEnvironment } from "@zoonk/db/test-environment";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    env: { ...getTestEnvironment("test"), NEXT_PUBLIC_APP_DOMAIN: "localhost:3000" },
    environment: "node",
  },
});
