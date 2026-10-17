import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { heldJsonAnswer } from "./_test-utils/held-answer";
import { getFromBrowser, postFromBrowser, readJsonForThisLearner } from "./browser-api";

/** Whose session the browser's cookie jar holds: the page was drawn for "first". */
const jar = vi.hoisted(() => ({ holder: "first" }));

const auth = vi.hoisted(() => ({ pending: null as Promise<{ Authorization: string }> | null }));

vi.mock("@/lib/learner/learner-identity", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  checkIdentity: () => jar.holder === "first",
}));

vi.mock("@/lib/browser-api-url", () => ({ getBrowserApiUrl: () => "https://api.test" }));

vi.mock("@/lib/workflow/auth-headers", () => ({
  getWorkflowAuthHeaders: async () => auth.pending ?? { Authorization: "Bearer token" },
}));

const REQUESTS = [
  ["postFromBrowser", () => postFromBrowser({ path: "/v1/me/example-lines/step" })],
  ["getFromBrowser", () => getFromBrowser("/v1/me/example-lines/step")],
] as const;

describe("browser API answers", () => {
  beforeEach(() => {
    jar.holder = "first";
    auth.pending = null;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(REQUESTS)(
    "%s returns nothing when another learner signed in while it was out",
    async (_name, request) => {
      const answered = Promise.withResolvers<Response>();

      vi.stubGlobal(
        "fetch",
        vi.fn(async () => answered.promise),
      );

      const result = request();
      jar.holder = "second";
      answered.resolve(Response.json({ line: "first's line" }));

      await expect(result).resolves.toBeNull();
    },
  );

  it.each(REQUESTS)("%s delivers the answer to the learner who asked", async (_name, request) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: { code: "limit" } }, { status: 429 })),
    );

    const response = await request();

    expect(response?.status).toBe(429);
    await expect(response?.json()).resolves.toStrictEqual({ error: { code: "limit" } });
  });

  it("postFromBrowser sends nothing from a page drawn for another learner", async () => {
    const send = vi.fn(async () => Response.json({}));
    vi.stubGlobal("fetch", send);
    jar.holder = "second";

    await expect(postFromBrowser({ path: "/v1/feedback" })).resolves.toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it("getFromBrowser sends nothing when the original generation changes while auth is pending", async () => {
    const headers = Promise.withResolvers<{ Authorization: string }>();
    auth.pending = headers.promise;
    const send = vi.fn(async () => Response.json({ status: "ready" }));
    vi.stubGlobal("fetch", send);
    let generation = 1;
    const result = getFromBrowser("/v1/me/example-lines/step", () => generation === 1);
    generation = 2;
    headers.resolve({ Authorization: "Bearer token" });

    await expect(result).resolves.toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it("getFromBrowser sends nothing when the page's learner changes while auth is pending", async () => {
    const headers = Promise.withResolvers<{ Authorization: string }>();
    auth.pending = headers.promise;
    const send = vi.fn(async () => Response.json({ status: "ready" }));
    vi.stubGlobal("fetch", send);
    const result = getFromBrowser("/v1/me/example-lines/step", () => true);
    jar.holder = "second";
    headers.resolve({ Authorization: "Bearer token" });

    await expect(result).resolves.toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it("getFromBrowser sends once when auth settles for the original generation and learner", async () => {
    const headers = Promise.withResolvers<{ Authorization: string }>();
    auth.pending = headers.promise;
    const send = vi.fn(async () => Response.json({ status: "ready" }));
    vi.stubGlobal("fetch", send);
    const result = getFromBrowser("/v1/me/example-lines/step", () => true);

    expect(send).not.toHaveBeenCalled();
    headers.resolve({ Authorization: "Bearer token" });

    const response = await result;
    expect(response?.ok).toBe(true);

    expect(send).toHaveBeenCalledExactlyOnceWith("https://api.test/v1/me/example-lines/step", {
      headers: { Authorization: "Bearer token" },
    });
  });
});

describe(readJsonForThisLearner, () => {
  beforeEach(() => {
    jar.holder = "first";
  });

  it("reads the body for the learner who asked", async () => {
    await expect(
      readJsonForThisLearner(Response.json({ line: "first's line" })),
    ).resolves.toStrictEqual({ line: "first's line" });
  });

  it("reads nothing once another learner signed in while the body was on its way", async () => {
    const answer = heldJsonAnswer({ line: "first's line" });
    const body = readJsonForThisLearner(answer.response);

    jar.holder = "second";
    answer.finish();

    await expect(body).resolves.toBeNull();
  });

  it("reads null from a body that isn't JSON", async () => {
    await expect(readJsonForThisLearner(new Response("not json"))).resolves.toBeNull();
  });
});
