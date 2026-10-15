import { afterEach, describe, expect, it, vi } from "vitest";
import { postAsLearner } from "./learner-api";

vi.mock("@zoonk/core/security/api-deployment", () => ({
  getApiDeploymentHeaders: async () => ({}),
}));

describe(postAsLearner, () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("forwards the API's committed watermark alongside its unchanged JSON outcome", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ status: "ready" }, { headers: { "Learner-Revision": "42" } }),
      ),
    );

    await expect(postAsLearner({ path: "/v1/example" })).resolves.toStrictEqual({
      json: { status: "ready" },
      learnerRevision: "42",
      ok: true,
    });
  });

  it("keeps a response without a learner and an HTTP refusal distinct", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ status: "ready" }))
      .mockResolvedValueOnce(Response.json({ error: "refused" }, { status: 403 }));

    vi.stubGlobal("fetch", fetcher);

    await expect(postAsLearner({ path: "/v1/example" })).resolves.toStrictEqual({
      json: { status: "ready" },
      learnerRevision: null,
      ok: true,
    });

    await expect(postAsLearner({ path: "/v1/example" })).resolves.toStrictEqual({
      json: { error: "refused" },
      ok: false,
      status: 403,
    });
  });
});
