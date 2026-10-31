import {
  type GradeTypedAnswerParams,
  type gradeTypedAnswer,
} from "@zoonk/ai/tasks/grading/grade-typed-answer";
import { type shuffle } from "@zoonk/utils/shuffle";
import { vi } from "vitest";
import { type getRequestProgressDateContext } from "../progress/get-request-date-context";

export const nextCache = {
  cacheTag: vi.fn(),
  // Outside a request, Next.js' `io()` resolves at once, as it does here.
  io: async () => null,
  revalidateTag: vi.fn(),
};

// Tests run outside a request, where Next.js' `after` throws. Tests that check deferred work run it
// with `runDeferredWork` from `deferred-work.ts`.
export const nextServer = { after: vi.fn() };

export const nextHeaders = { cookies: vi.fn(), headers: vi.fn() };

export const session = { getSession: vi.fn() };

export const dateContext = { getRequestProgressDateContext: vi.fn() };

export const analytics = { trackServerEvent: vi.fn() };

const { shuffle: realShuffle } = await vi.importActual<{ shuffle: typeof shuffle }>(
  "@zoonk/utils/shuffle",
);

async function gradeForReal(params: GradeTypedAnswerParams) {
  const actual = await vi.importActual<{ gradeTypedAnswer: typeof gradeTypedAnswer }>(
    "@zoonk/ai/tasks/grading/grade-typed-answer",
  );

  return actual.gradeTypedAnswer(params);
}

/** A file-local `vi.mock` requires its own worker; shared mocks belong here. */
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
  "@zoonk/ai/tasks/challenge/case": { generateChallengeCase: vi.fn() },
  "@zoonk/ai/tasks/courses/details": { generateCourseDetails: vi.fn() },
  "@zoonk/ai/tasks/courses/icon": { generateCourseIcon: vi.fn() },
  "@zoonk/ai/tasks/courses/intent": { classifyCourseIntent: vi.fn() },
  "@zoonk/ai/tasks/curriculum/coverage-check": { checkCoverage: vi.fn() },
  "@zoonk/ai/tasks/curriculum/setup-lesson-outline": { generateSetupLessonOutline: vi.fn() },
  "@zoonk/ai/tasks/goals/find-exam-date": { findExamDate: vi.fn() },
  "@zoonk/ai/tasks/goals/understand-goal": { understandGoal: vi.fn() },
  "@zoonk/ai/tasks/grading/explain-wrong-answer": { explainWrongAnswer: vi.fn() },
  "@zoonk/ai/tasks/grading/grade-essay": { gradeEssay: vi.fn() },
  "@zoonk/ai/tasks/grading/grade-typed-answer": { gradeTypedAnswer: vi.fn(gradeForReal) },
  "@zoonk/ai/tasks/identity/decision": { decideLibraryIdentity: vi.fn() },
  "@zoonk/ai/tasks/identity/search-terms": { generateSearchTerms: vi.fn() },
  "@zoonk/ai/tasks/images/check": { checkLessonImage: vi.fn() },
  "@zoonk/ai/tasks/images/generate": { generateLessonImage: vi.fn() },
  "@zoonk/ai/tasks/images/scene": { generateImageScene: vi.fn() },
  "@zoonk/ai/tasks/items/work-field": { classifyWorkField: vi.fn() },
  "@zoonk/ai/tasks/language/alphabet-lesson": { generateAlphabetLesson: vi.fn() },
  "@zoonk/ai/tasks/language/assess-pronunciation": { assessPronunciation: vi.fn() },
  "@zoonk/ai/tasks/language/conversation-feedback": { writeConversationFeedback: vi.fn() },
  "@zoonk/ai/tasks/language/conversation-objectives": { checkConversationObjectives: vi.fn() },
  "@zoonk/ai/tasks/language/conversation-scenario": { generateConversationScenario: vi.fn() },
  "@zoonk/ai/tasks/language/exam-speaking-card": { generateExamSpeakingCard: vi.fn() },
  "@zoonk/ai/tasks/language/exam-speaking-photo": { drawExamSpeakingPhoto: vi.fn() },
  "@zoonk/ai/tasks/language/explain-spoken-answer": { explainSpokenAnswer: vi.fn() },
  "@zoonk/ai/tasks/language/language-lesson": { generateLanguageLesson: vi.fn() },
  "@zoonk/ai/tasks/language/level-test-bank": { generateLevelTestBank: vi.fn() },
  "@zoonk/ai/tasks/language/live-call-session": {
    createLiveCallSession: vi.fn(),
    hangUpLiveCallSession: vi.fn(),
    isLiveCallAvailable: vi.fn(),
  },
  "@zoonk/ai/tasks/language/mistake-pattern": { findMistakePattern: vi.fn() },
  "@zoonk/ai/tasks/language/speaking-mock-scenario": { generateSpeakingMockScenario: vi.fn() },
  "@zoonk/ai/tasks/language/speaking-score": { scoreSpeaking: vi.fn() },
  "@zoonk/ai/tasks/language/transcribe-speech": { transcribeSpeech: vi.fn() },
  "@zoonk/ai/tasks/lesson-writer": { writeLessonDraft: vi.fn() },
  "@zoonk/ai/tasks/lesson-writer/fix": { fixLessonDraft: vi.fn() },
  "@zoonk/ai/tasks/listening/write-set": { writeListeningSet: vi.fn() },
  "@zoonk/ai/tasks/material/answer": { answerFromMaterial: vi.fn() },
  "@zoonk/ai/tasks/material/cite": { citeMaterial: vi.fn() },
  "@zoonk/ai/tasks/memory/extraction": { extractMemoryFacts: vi.fn() },
  "@zoonk/ai/tasks/memory/gate": { gateMemoryFact: vi.fn() },
  "@zoonk/ai/tasks/memory/insight": { generateMemoryInsight: vi.fn() },
  "@zoonk/ai/tasks/memory/reconcile": { reconcileMemoryFact: vi.fn() },
  "@zoonk/ai/tasks/memory/relevance": { selectRelevantMemoryFacts: vi.fn() },
  "@zoonk/ai/tasks/memory/search-terms": { generateMemorySearchTerms: vi.fn() },
  "@zoonk/ai/tasks/memory/session-patterns": { findSessionPatterns: vi.fn() },
  "@zoonk/ai/tasks/mind-maps/check": { checkMindMapImage: vi.fn() },
  "@zoonk/ai/tasks/mind-maps/image": { generateMindMapImage: vi.fn() },
  "@zoonk/ai/tasks/mind-maps/structure": { generateMindMapStructure: vi.fn() },
  "@zoonk/ai/tasks/mistakes/cause": { classifyMistakeCause: vi.fn() },
  "@zoonk/ai/tasks/plans/edit-intent": { interpretPlanEdit: vi.fn() },
  "@zoonk/ai/tasks/plans/routine-fit": { fitPlanToRoutineFacts: vi.fn() },
  "@zoonk/ai/tasks/plans/topic-skill-names": { nameTopicSkills: vi.fn() },
  "@zoonk/ai/tasks/quality/lesson-check": { checkLessonQuality: vi.fn() },
  "@zoonk/ai/tasks/research/exam-identity-decision": { decideExamIdentity: vi.fn() },
  "@zoonk/ai/tasks/variants/example-lines": { generateExampleLines: vi.fn() },
  "@zoonk/ai/tasks/variants/step-variant": { generateStepVariant: vi.fn() },
  "@zoonk/mailer": { sendEmail: vi.fn() },
  "@zoonk/utils/logger": { logError: vi.fn(), logInfo: vi.fn() },
  "@zoonk/utils/shuffle": { shuffle: vi.fn(realShuffle) },
  "posthog-node": { PostHog: vi.fn() },
  undici: { fetch: vi.fn() },
};

export async function resetBoundaries(): Promise<void> {
  const actualDateContext = await vi.importActual<{
    getRequestProgressDateContext: typeof getRequestProgressDateContext;
  }>("../progress/get-request-date-context");

  [
    ...Object.values(nextCache),
    ...Object.values(nextServer),
    nextHeaders.cookies,
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

  const liveCall = boundaries["@zoonk/ai/tasks/language/live-call-session"];
  liveCall.isLiveCallAvailable.mockReturnValue(true);

  liveCall.createLiveCallSession.mockImplementation(async () => ({
    sdp: "test-answer",
    sessionId: `session-${crypto.randomUUID()}`,
  }));

  nextHeaders.cookies.mockImplementation(async () => new Map());
  nextHeaders.headers.mockImplementation(async () => new Headers());

  dateContext.getRequestProgressDateContext.mockImplementation(
    actualDateContext.getRequestProgressDateContext,
  );
}
