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

  test("OpenAPI spec serves representative product operations", async () => {
    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.get("/v1/docs/openapi.json");

    expect(response.status()).toBe(200);

    const spec = await response.json();

    expect(spec.paths).toHaveProperty("/catalog/search");
    expect(spec.paths).toHaveProperty("/courses");
    expect(spec.paths).toHaveProperty("/lessons/{lessonId}/content");
    expect(spec.paths).toHaveProperty("/me/progress");
    expect(spec.paths).toHaveProperty("/generations");
    expect(spec.paths).toHaveProperty("/generations/{generationId}");
    expect(spec.paths).toHaveProperty("/generations/{generationId}/events");
    expect(spec.paths).toHaveProperty("/feedback");
    expect(spec.paths).toHaveProperty("/me");
    expect(spec.paths["/courses"].get.operationId).toBe("listCourses");

    await apiContext.dispose();
  });

  test("OpenAPI spec owns its auth contract without exposing Better Auth endpoints", async () => {
    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.get("/v1/docs/openapi.json");

    expect(response.status()).toBe(200);

    const spec = await response.json();

    expect(spec.paths).not.toHaveProperty("/sign-in/email");
    expect(spec.paths).not.toHaveProperty("/sign-up/email");
    expect(spec.paths).not.toHaveProperty("/sign-out");

    expect(spec.components.securitySchemes).toMatchObject({
      bearerAuth: { scheme: "bearer", type: "http" },
      cookieAuth: { in: "cookie", name: "better-auth.session_token", type: "apiKey" },
    });

    await apiContext.dispose();
  });
});
