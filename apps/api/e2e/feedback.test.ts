import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { expect, test } from "@zoonk/e2e/fixtures";

test.describe("Content votes API", () => {
  test("requires authentication", async ({ baseURL }) => {
    const apiContext = await request.newContext({ baseURL });

    const path = `/v1/me/content-votes/lesson/${randomUUID()}`;

    const [response, read] = await Promise.all([
      apiContext.put(path, { data: { vote: "up" } }),
      apiContext.get(path),
    ]);

    expect(response.status()).toBe(401);
    expect(read.status()).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "UNAUTHORIZED" } });

    await apiContext.dispose();
  });
});
