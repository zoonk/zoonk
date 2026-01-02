import { createBaseConfig } from "@zoonk/e2e/base.config";

export default createBaseConfig({
  baseURL: "http://localhost:3000",
  port: 3000,
  testDir: "./e2e",
});
