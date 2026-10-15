import { heldJsonAnswer } from "@/lib/api/_test-utils/held-answer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { postToApp } from "./post-to-app";

const identity = vi.hoisted(() => ({ holder: "first" }));

vi.mock("@/lib/learner/learner-identity", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  checkIdentity: () => identity.holder === "first",
}));

describe(postToApp, () => {
  beforeEach(() => {
    identity.holder = "first";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("delivers the answer while the page's learner still holds the browser", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ line: "first's line" })),
    );

    await expect(postToApp({ body: {}, path: "/api/example" })).resolves.toStrictEqual({
      line: "first's line",
    });
  });

  it("sends nothing from a page drawn for another learner", async () => {
    const send = vi.fn(async () => Response.json({}));
    vi.stubGlobal("fetch", send);
    identity.holder = "second";

    await expect(postToApp({ body: {}, path: "/api/example" })).resolves.toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it("drops an answer whose body arrives after another learner signed in", async () => {
    const answer = heldJsonAnswer({ line: "first's line" });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => answer.response),
    );

    const result = postToApp({ body: {}, path: "/api/example" });

    // The headers are in; the body is still on its way when the other learner signs in.
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    identity.holder = "second";
    answer.finish();

    await expect(result).resolves.toBeNull();
  });
});
