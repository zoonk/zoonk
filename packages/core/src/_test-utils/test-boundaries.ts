import {
  type GradeTypedAnswerParams,
  type gradeTypedAnswer,
} from "@zoonk/ai/tasks/v2/grading/grade-typed-answer";
import { type shuffle } from "@zoonk/utils/shuffle";
import { vi } from "vitest";
import { type getRequestProgressDateContext } from "../progress/get-request-date-context";

/**
 * What every core test replaces at the edge of the code under test (see `setup-tests.ts`): Next.js'
 * request APIs, which have no request here, the signed-in learner (`mockSession`), the request's
 * date (the real one unless a test sets it) and analytics, which never leaves a test. Test files
 * share workers, so a worker keeps one set of these functions for every file it runs, and each file
 * starts with them as a fresh worker would (`resetBoundaries`).
 */
export const nextCache = {
  cacheTag: vi.fn(),
  // Outside a request, Next.js' `io()` resolves at once, as it does here.
  io: async () => null,
  revalidateTag: vi.fn(),
};

// Tests run outside a request, where Next.js' `after` throws. Tests that check deferred work run it
// with `runDeferredWork` from `deferred-work.ts`.
export const nextServer = { after: vi.fn() };

export const nextHeaders = { headers: vi.fn() };

export const session = { getSession: vi.fn() };

export const dateContext = { getRequestProgressDateContext: vi.fn() };

export const analytics = { trackServerEvent: vi.fn() };

const { shuffle: realShuffle } = await vi.importActual<{ shuffle: typeof shuffle }>(
  "@zoonk/utils/shuffle",
);

/** The real grader, loaded on its first answer, so files that never grade don't load it. */
async function gradeForReal(params: GradeTypedAnswerParams) {
  const actual = await vi.importActual<{ gradeTypedAnswer: typeof gradeTypedAnswer }>(
    "@zoonk/ai/tasks/v2/grading/grade-typed-answer",
  );

  return actual.gradeTypedAnswer(params);
}

/**
 * The other edges, by module, each keeping its other exports: model calls (each AI task a test
 * reaches, which says what the model answers), Vercel Blob, PostHog, email, error reports,
 * Vercel's credentials and the web pages research fetches (undici's fetch). Two run for real
 * unless a test says otherwise, and a reset puts the real one back: randomness, and the
 * typed-answer grader, whose code settles accepted answers before any model. The logger stays
 * silent, as it is in tests, and a test can read what was logged. A new edge a test reaches goes
 * here: a file's own `vi.mock` gives it a worker of its own.
 */
export const boundaries = {
  "@sentry/nextjs": { captureMessage: vi.fn() },
  "@vercel/blob": {
    del: vi.fn(),
    get: vi.fn(),
    issueSignedToken: vi.fn(),
    list: vi.fn(),
    put: vi.fn(),
  },
  "@vercel/oidc": { getVercelOidcToken: vi.fn() },
  "@zoonk/ai/tasks/audio": { generateLanguageAudio: vi.fn() },
  "@zoonk/ai/tasks/audio/listening": { voiceListeningScript: vi.fn() },
  "@zoonk/ai/tasks/courses/intent": { classifyCourseIntent: vi.fn() },
  "@zoonk/ai/tasks/v2/challenge/case": { generateChallengeCase: vi.fn() },
  "@zoonk/ai/tasks/v2/courses/details": { generateCourseDetails: vi.fn() },
  "@zoonk/ai/tasks/v2/courses/icon": { generateCourseIcon: vi.fn() },
  "@zoonk/ai/tasks/v2/curriculum/coverage-check": { checkCoverage: vi.fn() },
  "@zoonk/ai/tasks/v2/curriculum/setup-lesson-outline": { generateSetupLessonOutline: vi.fn() },
  "@zoonk/ai/tasks/v2/goals/find-exam-date": { findExamDate: vi.fn() },
  "@zoonk/ai/tasks/v2/goals/understand-goal": { understandGoal: vi.fn() },
  "@zoonk/ai/tasks/v2/grading/explain-wrong-answer": { explainWrongAnswer: vi.fn() },
  "@zoonk/ai/tasks/v2/grading/grade-essay": { gradeEssay: vi.fn() },
  "@zoonk/ai/tasks/v2/grading/grade-typed-answer": { gradeTypedAnswer: vi.fn(gradeForReal) },
  "@zoonk/ai/tasks/v2/identity/decision": { decideLibraryIdentity: vi.fn() },
  "@zoonk/ai/tasks/v2/identity/search-terms": { generateSearchTerms: vi.fn() },
  "@zoonk/ai/tasks/v2/images/check": { checkLessonImage: vi.fn() },
  "@zoonk/ai/tasks/v2/images/generate": { generateLessonImage: vi.fn() },
  "@zoonk/ai/tasks/v2/images/scene": { generateImageScene: vi.fn() },
  "@zoonk/ai/tasks/v2/items/work-field": { classifyWorkField: vi.fn() },
  "@zoonk/ai/tasks/v2/language/alphabet-lesson": { generateAlphabetLesson: vi.fn() },
  "@zoonk/ai/tasks/v2/language/assess-pronunciation": { assessPronunciation: vi.fn() },
  "@zoonk/ai/tasks/v2/language/conversation-feedback": { writeConversationFeedback: vi.fn() },
  "@zoonk/ai/tasks/v2/language/conversation-objectives": { checkConversationObjectives: vi.fn() },
  "@zoonk/ai/tasks/v2/language/conversation-scenario": { generateConversationScenario: vi.fn() },
  "@zoonk/ai/tasks/v2/language/exam-speaking-card": { generateExamSpeakingCard: vi.fn() },
  "@zoonk/ai/tasks/v2/language/exam-speaking-photo": { drawExamSpeakingPhoto: vi.fn() },
  "@zoonk/ai/tasks/v2/language/explain-spoken-answer": { explainSpokenAnswer: vi.fn() },
  "@zoonk/ai/tasks/v2/language/language-lesson": { generateLanguageLesson: vi.fn() },
  "@zoonk/ai/tasks/v2/language/level-test-bank": { generateLevelTestBank: vi.fn() },
  "@zoonk/ai/tasks/v2/language/live-call-session": {
    createLiveCallSession: vi.fn(),
    hangUpLiveCallSession: vi.fn(),
    isLiveCallAvailable: vi.fn(),
  },
  "@zoonk/ai/tasks/v2/language/mistake-pattern": { findMistakePattern: vi.fn() },
  "@zoonk/ai/tasks/v2/language/speaking-mock-scenario": { generateSpeakingMockScenario: vi.fn() },
  "@zoonk/ai/tasks/v2/language/speaking-score": { scoreSpeaking: vi.fn() },
  "@zoonk/ai/tasks/v2/language/transcribe-speech": { transcribeSpeech: vi.fn() },
  "@zoonk/ai/tasks/v2/lesson-writer": { writeLessonDraft: vi.fn() },
  "@zoonk/ai/tasks/v2/lesson-writer/fix": { fixLessonDraft: vi.fn() },
  "@zoonk/ai/tasks/v2/listening/write-set": { writeListeningSet: vi.fn() },
  "@zoonk/ai/tasks/v2/material/answer": { answerFromMaterial: vi.fn() },
  "@zoonk/ai/tasks/v2/material/cite": { citeMaterial: vi.fn() },
  "@zoonk/ai/tasks/v2/memory/extraction": { extractMemoryFacts: vi.fn() },
  "@zoonk/ai/tasks/v2/memory/gate": { gateMemoryFact: vi.fn() },
  "@zoonk/ai/tasks/v2/memory/insight": { generateMemoryInsight: vi.fn() },
  "@zoonk/ai/tasks/v2/memory/reconcile": { reconcileMemoryFact: vi.fn() },
  "@zoonk/ai/tasks/v2/memory/relevance": { selectRelevantMemoryFacts: vi.fn() },
  "@zoonk/ai/tasks/v2/memory/search-terms": { generateMemorySearchTerms: vi.fn() },
  "@zoonk/ai/tasks/v2/memory/session-patterns": { findSessionPatterns: vi.fn() },
  "@zoonk/ai/tasks/v2/mind-maps/check": { checkMindMapImage: vi.fn() },
  "@zoonk/ai/tasks/v2/mind-maps/image": { generateMindMapImage: vi.fn() },
  "@zoonk/ai/tasks/v2/mind-maps/structure": { generateMindMapStructure: vi.fn() },
  "@zoonk/ai/tasks/v2/mistakes/cause": { classifyMistakeCause: vi.fn() },
  "@zoonk/ai/tasks/v2/plans/edit-intent": { interpretPlanEdit: vi.fn() },
  "@zoonk/ai/tasks/v2/plans/routine-fit": { fitPlanToRoutineFacts: vi.fn() },
  "@zoonk/ai/tasks/v2/plans/topic-skill-names": { nameTopicSkills: vi.fn() },
  "@zoonk/ai/tasks/v2/quality/lesson-check": { checkLessonQuality: vi.fn() },
  "@zoonk/ai/tasks/v2/research/exam-identity-decision": { decideExamIdentity: vi.fn() },
  "@zoonk/ai/tasks/v2/variants/example-lines": { generateExampleLines: vi.fn() },
  "@zoonk/ai/tasks/v2/variants/step-variant": { generateStepVariant: vi.fn() },
  "@zoonk/mailer": { sendEmail: vi.fn() },
  "@zoonk/utils/logger": { logError: vi.fn(), logInfo: vi.fn() },
  "@zoonk/utils/shuffle": { shuffle: vi.fn(realShuffle) },
  "posthog-node": { PostHog: vi.fn() },
  undici: { fetch: vi.fn() },
};

/** Puts every boundary back as a fresh worker has it, before a test file runs. */
export async function resetBoundaries(): Promise<void> {
  const actualDateContext = await vi.importActual<{
    getRequestProgressDateContext: typeof getRequestProgressDateContext;
  }>("../progress/get-request-date-context");

  [
    ...Object.values(nextCache),
    ...Object.values(nextServer),
    nextHeaders.headers,
    session.getSession,
    dateContext.getRequestProgressDateContext,
    analytics.trackServerEvent,
    ...Object.values(boundaries).flatMap((mocks) => Object.values(mocks)),
  ].forEach((fn) => {
    if (vi.isMockFunction(fn)) {
      fn.mockReset();
    }
  });

  const liveCall = boundaries["@zoonk/ai/tasks/v2/language/live-call-session"];
  liveCall.isLiveCallAvailable.mockReturnValue(true);

  liveCall.createLiveCallSession.mockImplementation(async () => ({
    sdp: "test-answer",
    sessionId: `session-${crypto.randomUUID()}`,
  }));

  nextHeaders.headers.mockImplementation(async () => new Headers());

  dateContext.getRequestProgressDateContext.mockImplementation(
    actualDateContext.getRequestProgressDateContext,
  );
}
