import { request } from "@playwright/test";
import { expect, test } from "@zoonk/e2e/fixtures";

test.describe("API Documentation", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test("/v1/docs returns HTML with Scalar UI", async () => {
    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.get("/v1/docs");

    expect(response.status()).toBe(200);

    const contentType = response.headers()["content-type"];

    expect(contentType).toContain("text/html");

    const body = await response.text();

    expect(body).toContain("<!doctype html>");

    await apiContext.dispose();
  });

  test("/v1/docs/openapi.json returns valid OpenAPI spec", async () => {
    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.get("/v1/docs/openapi.json");

    expect(response.status()).toBe(200);

    const contentType = response.headers()["content-type"];

    expect(contentType).toContain("application/json");

    const spec = await response.json();

    expect(spec.openapi).toBe("3.1.0");
    expect(spec.info.title).toBe("Zoonk API");
    expect(spec.info.version).toBe("1.0.0");

    await apiContext.dispose();
  });

  test("OpenAPI spec includes custom API paths", async () => {
    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.get("/v1/docs/openapi.json");

    expect(response.status()).toBe(200);

    const spec = await response.json();

    expect(spec.paths).toHaveProperty("/auth/health");
    expect(spec.paths).toHaveProperty("/courses/search");
    expect(spec.paths).toHaveProperty("/workflows/course-generation/trigger");
    expect(spec.paths).toHaveProperty("/workflows/course-generation/status");
    expect(spec.paths).toHaveProperty("/workflows/chapter-generation/trigger");
    expect(spec.paths).toHaveProperty("/workflows/chapter-generation/status");
    expect(spec.paths).toHaveProperty("/workflows/lesson-generation/trigger");
    expect(spec.paths).toHaveProperty("/workflows/lesson-generation/status");

    await apiContext.dispose();
  });

  test("OpenAPI spec includes Better Auth endpoints", async () => {
    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.get("/v1/docs/openapi.json");

    expect(response.status()).toBe(200);

    const spec = await response.json();

    expect(spec.paths).toHaveProperty("/sign-in/email");
    expect(spec.paths).toHaveProperty("/sign-up/email");
    expect(spec.paths).toHaveProperty("/sign-out");
    expect(spec.components).toBeDefined();

    await apiContext.dispose();
  });
});
