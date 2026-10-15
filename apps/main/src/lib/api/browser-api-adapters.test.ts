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

vi.mock("@/lib/guest/ensure-guest-session", () => ({ ensureGuestSession: async () => true }));

vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

// The goal-wide actions are hooks only to memoize them; outside React they're plain functions.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useMemo: <T>(make: () => T) => make(),
}));

// The advice's schema isn't what's under test: whatever arrives passes through.
vi.mock("@zoonk/core/plans/time-advice-contract", () => ({
  planTimeAdviceSchema: { safeParse: (data: unknown) => ({ data }) },
}));

const first = tagOf("first");
const second = tagOf("second");

/**
 * Each adapter that reads an API answer's body for the page, with what the API answers, what the
 * learner who asked gets, and what the page gets once someone else's session lands mid-read.
 */
const ADAPTERS = [
  {
    answer: { answer: "Your notes say…", citations: [] },
    ask: async () => {
      const { askMaterialQuestion } = await import("@/lib/goals/goal-material-questions");

      return askMaterialQuestion({
        language: "en",
        question: "What do my notes say?",
        sourceIds: ["source"],
      });
    },
    dropped: { status: "failed" },
    name: "a material question's answer",
    received: { answer: { answer: "Your notes say…", citations: [] }, status: "answered" },
  },
  {
    answer: { source: { id: "source", title: "My notes" } },
    ask: async () => {
      const { attachGoalText } = await import("@/lib/goals/goal-uploads");
      return attachGoalText({ goalId: "goal", language: "en", text: "My notes" });
    },
    dropped: { status: "failed" },
    name: "an attached material",
    received: { source: { id: "source", title: "My notes" }, status: "attached" },
  },
  {
    answer: { recommendedMinutes: 45 },
    ask: async () => {
      const { getGoalTimeAdvice } = await import("@/lib/goals/goal-time-advice");
      return getGoalTimeAdvice({ dailyMinutes: 30, goalId: "goal", studyDays: [1, 2, 3] });
    },
    dropped: null,
    name: "a goal's time advice",
    received: { recommendedMinutes: 45 },
  },
  {
    answer: { generationId: "run", status: "generating" },
    ask: async () => {
      const { askToWriteLesson } = await import("@/lib/lessons/lesson-writing-request");
      return askToWriteLesson("lesson");
    },
    dropped: { status: "failed" },
    name: "a lesson's writing request",
    received: { generationId: "run", status: "writing" },
  },
  {
    answer: { generationId: "run", status: "generating" },
    ask: async () => {
      const mindMaps = await import("@/lib/mind-maps/use-mind-map-actions");
      return mindMaps.useMindMapActions("goal").request("chapter");
    },
    dropped: { status: "failed" },
    name: "a mind map's request",
    received: { status: "generating" },
  },
  {
    answer: { status: "ready" },
    ask: async () => {
      const mindMaps = await import("@/lib/mind-maps/use-mind-map-actions");
      return mindMaps.useMindMapActions("goal").readStatus("chapter");
    },
    dropped: null,
    name: "a mind map's status",
    received: "ready",
  },
  {
    answer: { generationId: "run", status: "writing" },
    ask: async () => {
      const outlines = await import("@/lib/topic-outlines/use-topic-outline-actions");
      return outlines.useTopicOutlineActions("goal").request("skill");
    },
    dropped: { status: "failed" },
    name: "a topic outline's request",
    received: { status: "writing" },
  },
  {
    answer: {
      error: { code: "LIMIT_REACHED", details: { limit: { period: "month", tier: "free" } } },
    },
    ask: async () => {
      const { requestQuestionWriting } = await import("@/lib/questions/question-writing");
      return requestQuestionWriting("/goals/goal/plan/focus-test/generations");
    },
    dropped: { status: "failed" },
    name: "a test's refused question writing",
    received: {
      limit: { period: "month", status: "limitReached", tier: "free" },
      status: "refused",
    },
    status: 402,
  },
  {
    answer: { generationId: "run", status: "generating" },
    ask: async () => {
      const { requestQuestionWriting } = await import("@/lib/questions/question-writing");
      return requestQuestionWriting("/goals/goal/plan/focus-test/generations");
    },
    dropped: { status: "failed" },
    name: "a test's question writing",
    received: { generationId: "run", status: "writing" },
  },
  {
    answer: { url: "https://clips.test/hello.mp3" },
    ask: async () => {
      const { requestSpeechClip } = await import("@/lib/speech/speech-clip-request");
      return requestSpeechClip({ language: "en", text: "Hello" });
    },
    dropped: { limit: null, status: "failed" },
    name: "a speech clip",
    received: { status: "ready", url: "https://clips.test/hello.mp3" },
  },
];

/**
 * A page drawn for the first learner, in a browser holding their session, whose API answers with
 * `answer`. The app's own reads (the learner's summary) stay out.
 */
async function openPage(answer: Response) {
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

  return { browser, fetched };
}

describe("an API answer read for the page", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(ADAPTERS)(
    "$name reaches the learner who asked",
    async ({ answer, ask, received, status }) => {
      await openPage(Response.json(answer, { status }));
      await expect(ask()).resolves.toStrictEqual(received);
    },
  );

  it.each(ADAPTERS)(
    "$name reaches nothing when another learner's session lands while its body is read",
    async ({ answer, ask, dropped, status }) => {
      const held = heldJsonAnswer(answer, status);
      const { browser, fetched } = await openPage(held.response);

      const outcome = ask();

      // The answer is in and its body is being read when another tab signs in: the cookie changes
      // with no event delivered to this page.
      await vi.waitFor(() => {
        expect(fetched).toHaveBeenCalledWith(
          expect.stringMatching(/^https:\/\/api\.test\//u),
          expect.anything(),
        );
      });

      await settle();
      browser.setHint(second);
      held.finish();

      await expect(outcome).resolves.toStrictEqual(dropped);
    },
  );
});
