import { revalidateTag } from "next/cache";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as postCacheTags } from "./route";

describe("course cache notifications", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each([undefined, "wrong"])("rejects secret %s before reading the body", async (secret) => {
    vi.stubEnv("APP_CACHE_SECRET", "expected");

    const request = new Request("http://main/api/cache/tags", {
      headers: secret ? { "x-app-cache-secret": secret } : {},
      method: "POST",
    });

    const json = vi.spyOn(request, "json");
    const response = await postCacheTags(request);
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(json).not.toHaveBeenCalled();
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("expires only authenticated course-content tags immediately", async () => {
    vi.stubEnv("APP_CACHE_SECRET", "expected");

    const response = await postCacheTags(
      new Request("http://main/api/cache/tags", {
        body: JSON.stringify({ tags: ["course:abc", "course-curriculum:abc", "catalog-courses"] }),
        headers: { "x-app-cache-secret": "expected" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledWith("course-curriculum:abc", { expire: 0 });
  });

  it.each(["user-progress:abc", "library-lesson:abc", "course-route:abc"])(
    "rejects %s",
    async (tag) => {
      vi.stubEnv("APP_CACHE_SECRET", "expected");

      const response = await postCacheTags(
        new Request("http://main/api/cache/tags", {
          body: JSON.stringify({ tags: [tag] }),
          headers: { "x-app-cache-secret": "expected" },
          method: "POST",
        }),
      );

      expect(response.status).toBe(400);
      expect(revalidateTag).not.toHaveBeenCalled();
    },
  );
});
