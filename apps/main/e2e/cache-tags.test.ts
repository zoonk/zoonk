import { getCourseRouteCacheTag } from "@zoonk/core/cache-tags";
import { toSlug } from "@zoonk/utils/string";
import { expect, test } from "./fixtures";

/** Matches Main's Playwright-only server fixture; production has no default secret. */
const SECRET_HEADERS = { "x-zoonk-cache-secret": "e2e-cache-tags-secret" };

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

  test("expires valid tags once with a cookie-free success response", async ({ request }) => {
    const tag = `course:cache-hook-${crypto.randomUUID()}`;

    const markedRoutes = ["हिन्दी", "สวัสดี"].map((title) =>
      getCourseRouteCacheTag({ brandSlug: "cache-hook", courseSlug: toSlug(title) }),
    );

    markedRoutes.forEach((route) => expect(route).toMatch(/\p{M}/u));

    const response = await request.post("/api/cache/tags", {
      data: {
        tags: [tag, tag, `library-lesson:cache-hook-${crypto.randomUUID()}`, ...markedRoutes],
      },
      headers: SECRET_HEADERS,
    });

    expect(response.status()).toBe(200);
    expect(await response.json()).toStrictEqual({ revalidated: 4 });
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect(response.headers()["set-cookie"]).toBeUndefined();
  });

  test("rejects malformed JSON, invalid shapes and out-of-bounds tags", async ({ request }) => {
    const bodies = [
      "{",
      { tags: [] },
      { tags: ["course:has spaces"] },
      { tags: ["a".repeat(257)] },
      { tags: Array.from({ length: 129 }, () => "course:test") },
      { extra: true, tags: ["course:test"] },
    ];

    const responses = await Promise.all(
      bodies.map((data) =>
        request.post("/api/cache/tags", {
          data,
          headers: { ...SECRET_HEADERS, "content-type": "application/json" },
        }),
      ),
    );

    expect(responses.map((response) => response.status())).toStrictEqual([
      400, 400, 400, 400, 400, 400,
    ]);
  });
});
