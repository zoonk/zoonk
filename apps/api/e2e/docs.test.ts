import { request } from "@playwright/test";
import { expect, test } from "@zoonk/e2e/fixtures";

/** The document's contents (operations, security, Better Auth kept out) are `document.test.ts`'s. */
test("serves the API reference page and its OpenAPI document", async () => {
  const apiContext = await request.newContext({ baseURL: process.env.E2E_BASE_URL ?? "" });

  const [page, document] = await Promise.all([
    apiContext.get("/v1/docs"),
    apiContext.get("/v1/docs/openapi.json"),
  ]);

  expect(page.status()).toBe(200);
  expect(page.headers()["content-type"]).toContain("text/html");
  await expect(page.text()).resolves.toContain("<!doctype html>");

  expect(document.status()).toBe(200);
  expect(document.headers()["content-type"]).toContain("application/json");

  await expect(document.json()).resolves.toMatchObject({
    info: { title: "Zoonk API", version: "1.0.0" },
    openapi: "3.1.0",
  });

  await apiContext.dispose();
});
