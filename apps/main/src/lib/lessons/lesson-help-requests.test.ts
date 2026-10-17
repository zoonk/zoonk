import { heldJsonAnswer } from "@/lib/api/_test-utils/held-answer";
import {
  fakeCover,
  loadPage,
  settle,
  stubPage,
  tagOf,
} from "@/lib/learner/_test-utils/learner-page";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/browser-api-url", () => ({ getBrowserApiUrl: () => "https://api.test" }));

vi.mock("@/lib/workflow/auth-headers", () => ({
  getWorkflowAuthHeaders: async () => ({ Authorization: "Bearer token" }),
}));

const first = tagOf("first");
const second = tagOf("second");

/**
 * A lesson drawn for the first learner, in a browser holding their session, whose API answers
 * with `answer`. The app's own reads (the learner's summary) stay out.
 */
async function openLesson(answer: Response) {
  const browser = stubPage({ hint: first, seeded: false });

  const fetched = vi.fn(async (url: string) =>
    url.startsWith("https://api.test") ? answer : new Promise<never>(() => {}),
  );

  vi.stubGlobal("fetch", fetched);
  const page = await loadPage();

  page.identity.registerIdentityCover({
    cover: fakeCover(),
    handoff: { seen: first, witnesses: [first] },
  });

  const { getExampleLine } = await import("./lesson-help-requests");
  return { browser, fetched, getExampleLine };
}

describe("a personal example's answer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reaches the learner who asked", async () => {
    const { getExampleLine } = await openLesson(Response.json({ canRequest: false, line: "Mine" }));

    await expect(getExampleLine({ stepId: "step" })).resolves.toStrictEqual({
      canRequest: false,
      line: "Mine",
    });
  });

  it("reaches nothing when another learner's session lands while its body is read", async () => {
    const answer = heldJsonAnswer({ canRequest: false, line: "The first learner's example" });
    const { browser, fetched, getExampleLine } = await openLesson(answer.response);

    const line = getExampleLine({ stepId: "step" });

    // The answer is in and its body is being read when another tab signs in: the cookie changes
    // with no event delivered to this page.
    await vi.waitFor(() => {
      expect(fetched).toHaveBeenCalledWith(
        "https://api.test/v1/me/example-lines/step",
        expect.anything(),
      );
    });

    await settle();
    browser.setHint(second);
    answer.finish();

    await expect(line).resolves.toBeNull();
  });
});
