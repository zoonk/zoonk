import { vi } from "vitest";

/**
 * What every API test replaces at the edge of the code under test, by module, declared once in
 * `setup-tests.ts`: model calls (each AI task a test reaches, which tests replay recorded outputs
 * through), PostHog, Vercel Blob and Next.js' request headers, which only exist inside a request.
 * A module keeps its other exports. Test files share workers, so a worker keeps one set of these
 * functions for every file it runs, and each file starts with them reset (`resetBoundaries`). A
 * new model call a test reaches goes here: a file's own `vi.mock` gives it a worker of its own.
 */
export const boundaries = {
  "@vercel/blob": { del: vi.fn(), list: vi.fn(), put: vi.fn() },
  "@zoonk/ai/tasks/audio/listening": { voiceListeningScript: vi.fn() },
  "@zoonk/ai/tasks/courses/intent": { classifyCourseIntent: vi.fn() },
  "@zoonk/ai/tasks/lessons/question": { streamLessonQuestionAnswer: vi.fn() },
  "@zoonk/ai/tasks/v2/challenge/case": { generateChallengeCase: vi.fn() },
  "@zoonk/ai/tasks/v2/courses/details": { generateCourseDetails: vi.fn() },
  "@zoonk/ai/tasks/v2/courses/icon": { generateCourseIcon: vi.fn() },
  "@zoonk/ai/tasks/v2/curriculum/course-outline": {
    generateCourseOutline: vi.fn(),
    streamCourseOutline: vi.fn(),
  },
  "@zoonk/ai/tasks/v2/curriculum/coverage-check": { checkCoverage: vi.fn() },
  "@zoonk/ai/tasks/v2/curriculum/skill-graph": { generateSkillGraph: vi.fn() },
  "@zoonk/ai/tasks/v2/explain/question-generality": { classifyQuestionGenerality: vi.fn() },
  "@zoonk/ai/tasks/v2/explain/quick-explanation": { generateQuickExplanation: vi.fn() },
  "@zoonk/ai/tasks/v2/goals/understand-goal": { understandGoal: vi.fn() },
  "@zoonk/ai/tasks/v2/identity/decision": { decideLibraryIdentity: vi.fn() },
  "@zoonk/ai/tasks/v2/identity/goal-specificity": { classifyGoalSpecificity: vi.fn() },
  "@zoonk/ai/tasks/v2/identity/search-terms": { generateSearchTerms: vi.fn() },
  "@zoonk/ai/tasks/v2/images/check": { checkLessonImage: vi.fn() },
  "@zoonk/ai/tasks/v2/images/generate": { generateLessonImage: vi.fn() },
  "@zoonk/ai/tasks/v2/images/scene": { generateImageScene: vi.fn() },
  "@zoonk/ai/tasks/v2/items/generate": { generateItems: vi.fn() },
  "@zoonk/ai/tasks/v2/items/past-questions": { extractPastQuestions: vi.fn() },
  "@zoonk/ai/tasks/v2/items/placement-items": { generatePlacementItems: vi.fn() },
  "@zoonk/ai/tasks/v2/items/statute-drills": { generateStatuteDrills: vi.fn() },
  "@zoonk/ai/tasks/v2/items/work-field": { classifyWorkField: vi.fn() },
  "@zoonk/ai/tasks/v2/items/write-set": { writeItemSet: vi.fn() },
  "@zoonk/ai/tasks/v2/language/conversation-scenario": { generateConversationScenario: vi.fn() },
  "@zoonk/ai/tasks/v2/language/level-test-bank": { generateLevelTestBank: vi.fn() },
  "@zoonk/ai/tasks/v2/lesson-spec": { generateLessonSpec: vi.fn() },
  "@zoonk/ai/tasks/v2/lesson-spec/picture-need": { keepTeachingPictures: vi.fn() },
  "@zoonk/ai/tasks/v2/lesson-writer": { writeLessonDraft: vi.fn() },
  "@zoonk/ai/tasks/v2/lesson-writer/fix": { fixLessonDraft: vi.fn() },
  "@zoonk/ai/tasks/v2/listening/write-set": { writeListeningSet: vi.fn() },
  "@zoonk/ai/tasks/v2/mind-maps/check": { checkMindMapImage: vi.fn() },
  "@zoonk/ai/tasks/v2/mind-maps/image": { generateMindMapImage: vi.fn() },
  "@zoonk/ai/tasks/v2/mind-maps/structure": { generateMindMapStructure: vi.fn() },
  "@zoonk/ai/tasks/v2/plans/routine-fit": { fitPlanToRoutineFacts: vi.fn() },
  "@zoonk/ai/tasks/v2/quality/lesson-check": { checkLessonQuality: vi.fn() },
  "@zoonk/ai/tasks/v2/research/changing-facts": { detectChangingFacts: vi.fn() },
  "@zoonk/ai/tasks/v2/research/check-cited-facts": { checkCitedFacts: vi.fn() },
  "@zoonk/ai/tasks/v2/research/check-exam-reading": { checkExamReading: vi.fn() },
  "@zoonk/ai/tasks/v2/research/exam-identity-decision": { decideExamIdentity: vi.fn() },
  "@zoonk/ai/tasks/v2/research/extract-exam-blueprint": { extractExamBlueprint: vi.fn() },
  "@zoonk/ai/tasks/v2/research/extract-question-formats": { extractQuestionFormats: vi.fn() },
  "@zoonk/ai/tasks/v2/research/find-choice-options": { findChoiceOptions: vi.fn() },
  "@zoonk/ai/tasks/v2/research/find-course-weights": { findCourseWeights: vi.fn() },
  "@zoonk/ai/tasks/v2/research/find-official-sources": { findOfficialSources: vi.fn() },
  "@zoonk/ai/tasks/v2/research/find-subject-questions": { findSubjectQuestions: vi.fn() },
  "@zoonk/ai/tasks/v2/research/find-target-cutoff": { findTargetCutoff: vi.fn() },
  "@zoonk/ai/tasks/v2/research/find-topic-frequency": { findTopicFrequency: vi.fn() },
  "@zoonk/ai/tasks/v2/research/plan": { generateExamResearchPlan: vi.fn() },
  "@zoonk/ai/tasks/v2/research/source-change-notice": { generateSourceChangeNotice: vi.fn() },
  "@zoonk/ai/tasks/v2/research/source-plan": { generateSourceResearchPlan: vi.fn() },
  "@zoonk/ai/tasks/v2/research/translate-pass-marks": { translatePassMarks: vi.fn() },
  "@zoonk/ai/tasks/v2/research/upload-visibility": { classifyUploadVisibility: vi.fn() },
  "@zoonk/ai/tasks/v2/tutor/goal-tutor": { streamGoalTutorAnswer: vi.fn() },
  "@zoonk/ai/tasks/v2/variants/step-variant": { generateStepVariant: vi.fn() },
  "@zoonk/core/analytics/server": { trackServerEvent: vi.fn(), trackSystemEvent: vi.fn() },
  "@zoonk/core/images/upload": { uploadImage: vi.fn() },
  "next/headers": { headers: vi.fn(async () => new Headers()) },
};

/** Puts every boundary back as a fresh worker has it, before a test file runs. */
export function resetBoundaries(): void {
  Object.values(boundaries)
    .flatMap((mocks) => Object.values(mocks))
    .forEach((mock) => {
      mock.mockReset();
    });
}
