import { expect, test } from "./fixtures";

test.describe("Cross-app cache hook", () => {
  test("requires the secret before parsing the body", async ({ request }) => {
    const responses = await Promise.all([
      request.post("/api/cache/tags", { data: { tags: ["course:test"] } }),
      request.post("/api/cache/tags", { data: "{", headers: { "x-zoonk-cache-secret": "bad" } }),
      request.post("/api/cache/tags", {
        data: { tags: ["course:test"] },
        headers: { "x-zoonk-cache-secret": "e2e-cache-tags-secrex" },
      }),
    ]);

    expect(responses.map((response) => response.status())).toStrictEqual([401, 401, 401]);
    expect(responses[0]?.headers()["set-cookie"]).toBeUndefined();
  });
});
