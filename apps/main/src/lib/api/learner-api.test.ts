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
      status: 200,
    });

    await expect(postAsLearner({ path: "/v1/example" })).resolves.toStrictEqual({
      json: { error: "refused" },
      ok: false,
      status: 403,
    });
  });

  it("asks the API in the learner's language", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({}));
    vi.stubGlobal("fetch", fetcher);

    await postAsLearner({ locale: "pt", path: "/v1/example" });

    expect(fetcher).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: expect.objectContaining({ "Accept-Language": "pt" }) }),
    );
  });
});
