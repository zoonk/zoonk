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
const GRADE = { heard: "bonjour", score: 1 };

/**
 * A speaking screen drawn for the first learner, in a browser holding their session, whose API
 * answers with `answer`. The app's own reads (the learner's summary) stay out.
 */
async function openSpeaking(answer: Response) {
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

  const { requestSpokenGrade } = await import("./spoken-answer-request");

  const grade = () =>
    requestSpokenGrade({
      audio: new Blob(["audio"]),
      durationMs: 1200,
      stepId: "step",
      studySessionId: null,
    });

  return { browser, fetched, grade };
}

describe("a spoken answer's grade", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reaches the learner who recorded it", async () => {
    const { grade } = await openSpeaking(Response.json(GRADE));

    await expect(grade()).resolves.toStrictEqual({ grade: GRADE, status: "graded" });
  });

  it("reaches nothing when another learner's session lands while its body is read", async () => {
    const answer = heldJsonAnswer(GRADE);
    const { browser, fetched, grade } = await openSpeaking(answer.response);

    const outcome = grade();

    // The grade is in and its body is being read when another tab signs in: the cookie changes
    // with no event delivered to this page.
    await vi.waitFor(() => {
      expect(fetched).toHaveBeenCalledWith(
        "https://api.test/v1/steps/step/spoken-answers",
        expect.anything(),
      );
    });

    await settle();
    browser.setHint(second);
    answer.finish();

    await expect(outcome).resolves.toStrictEqual({ status: "failed" });
  });
});
