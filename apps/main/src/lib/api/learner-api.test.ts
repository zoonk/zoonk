import { afterEach, describe, expect, it, vi } from "vitest";
import { postAsLearner } from "./learner-api";

vi.mock("@zoonk/core/security/api-deployment", () => ({
  getApiDeploymentHeaders: async () => ({}),
}));

describe(postAsLearner, () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the API's JSON outcome and an HTTP refusal distinct", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ status: "ready" }))
      .mockResolvedValueOnce(Response.json({ error: "refused" }, { status: 403 }));

    vi.stubGlobal("fetch", fetcher);

    await expect(postAsLearner({ path: "/v1/example" })).resolves.toStrictEqual({
      json: { status: "ready" },
      ok: true,
    });

    await expect(postAsLearner({ path: "/v1/example" })).resolves.toStrictEqual({
      json: { error: "refused" },
      ok: false,
      status: 403,
    });
  });
});
