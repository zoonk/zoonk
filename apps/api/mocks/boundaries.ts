import { vi } from "vitest";

/**
 * Test files share workers, so these are mocked once per worker and reset for each file. A new
 * model call a test reaches goes here: a file's own `vi.mock` gives it a worker of its own.
 */
export const boundaries = {
  "@vercel/blob": { del: vi.fn(), list: vi.fn(), put: vi.fn() },
  "@zoonk/ai/tasks/audio": { generateLanguageAudio: vi.fn() },
  "@zoonk/ai/tasks/audio/listening": { voiceListeningScript: vi.fn() },
  "@zoonk/ai/tasks/challenge/case": { generateChallengeCase: vi.fn() },
  "@zoonk/ai/tasks/courses/details": { generateCourseDetails: vi.fn() },
  "@zoonk/ai/tasks/courses/icon": { generateCourseIcon: vi.fn() },
  "@zoonk/ai/tasks/courses/intent": { classifyCourseIntent: vi.fn() },
  "@zoonk/ai/tasks/curriculum/course-outline": {
    generateCourseOutline: vi.fn(),
    streamCourseOutline: vi.fn(),
  },
  "@zoonk/ai/tasks/curriculum/coverage-check": { checkCoverage: vi.fn() },
  "@zoonk/ai/tasks/curriculum/skill-graph": { generateSkillGraph: vi.fn() },
  "@zoonk/ai/tasks/curriculum/teaching-chapters": { findTeachingChapters: vi.fn() },
  "@zoonk/ai/tasks/explain/question-generality": { classifyQuestionGenerality: vi.fn() },
  "@zoonk/ai/tasks/explain/quick-explanation": { generateQuickExplanation: vi.fn() },
  "@zoonk/ai/tasks/goals/find-exam-date": { findExamDate: vi.fn() },
  "@zoonk/ai/tasks/goals/understand-goal": { understandGoal: vi.fn() },
  "@zoonk/ai/tasks/identity/decision": { decideLibraryIdentity: vi.fn() },
  "@zoonk/ai/tasks/identity/goal-specificity": { classifyGoalSpecificity: vi.fn() },
  "@zoonk/ai/tasks/identity/search-terms": { generateSearchTerms: vi.fn() },
  "@zoonk/ai/tasks/images/check": { checkLessonImage: vi.fn() },
  "@zoonk/ai/tasks/images/generate": { generateLessonImage: vi.fn() },
  "@zoonk/ai/tasks/images/scene": { generateImageScene: vi.fn() },
  "@zoonk/ai/tasks/items/generate": { generateItems: vi.fn() },
  "@zoonk/ai/tasks/items/past-questions": { extractPastQuestions: vi.fn() },
  "@zoonk/ai/tasks/items/placement-items": { generatePlacementItems: vi.fn() },
  "@zoonk/ai/tasks/items/statute-drills": { generateStatuteDrills: vi.fn() },
  "@zoonk/ai/tasks/items/work-field": { classifyWorkField: vi.fn() },
  "@zoonk/ai/tasks/items/write-set": { writeItemSet: vi.fn() },
  "@zoonk/ai/tasks/language/conversation-scenario": { generateConversationScenario: vi.fn() },
  "@zoonk/ai/tasks/language/level-test-bank": { generateLevelTestBank: vi.fn() },
  "@zoonk/ai/tasks/lesson-spec": { generateLessonSpec: vi.fn() },
  "@zoonk/ai/tasks/lesson-spec/picture-need": { keepTeachingPictures: vi.fn() },
  "@zoonk/ai/tasks/lesson-writer": { writeLessonDraft: vi.fn() },
  "@zoonk/ai/tasks/lesson-writer/fix": { fixLessonDraft: vi.fn() },
  "@zoonk/ai/tasks/lessons/question": { streamLessonQuestionAnswer: vi.fn() },
  "@zoonk/ai/tasks/listening/write-set": { writeListeningSet: vi.fn() },
  "@zoonk/ai/tasks/mind-maps/check": { checkMindMapImage: vi.fn() },
  "@zoonk/ai/tasks/mind-maps/image": { generateMindMapImage: vi.fn() },
  "@zoonk/ai/tasks/mind-maps/structure": { generateMindMapStructure: vi.fn() },
  "@zoonk/ai/tasks/plans/routine-fit": { fitPlanToRoutineFacts: vi.fn() },
  "@zoonk/ai/tasks/quality/lesson-check": { checkLessonQuality: vi.fn() },
  "@zoonk/ai/tasks/research/changing-facts": { detectChangingFacts: vi.fn() },
  "@zoonk/ai/tasks/research/check-cited-facts": { checkCitedFacts: vi.fn() },
  "@zoonk/ai/tasks/research/check-exam-reading": { checkExamReading: vi.fn() },
  "@zoonk/ai/tasks/research/exam-identity-decision": { decideExamIdentity: vi.fn() },
  "@zoonk/ai/tasks/research/extract-exam-blueprint": { extractExamBlueprint: vi.fn() },
  "@zoonk/ai/tasks/research/extract-question-formats": { extractQuestionFormats: vi.fn() },
  "@zoonk/ai/tasks/research/find-choice-options": { findChoiceOptions: vi.fn() },
  "@zoonk/ai/tasks/research/find-course-weights": { findCourseWeights: vi.fn() },
  "@zoonk/ai/tasks/research/find-official-sources": { findOfficialSources: vi.fn() },
  "@zoonk/ai/tasks/research/find-subject-questions": { findSubjectQuestions: vi.fn() },
  "@zoonk/ai/tasks/research/find-target-cutoff": { findTargetCutoff: vi.fn() },
  "@zoonk/ai/tasks/research/find-topic-frequency": { findTopicFrequency: vi.fn() },
  "@zoonk/ai/tasks/research/plan": { generateExamResearchPlan: vi.fn() },
  "@zoonk/ai/tasks/research/source-change-notice": { generateSourceChangeNotice: vi.fn() },
  "@zoonk/ai/tasks/research/source-plan": { generateSourceResearchPlan: vi.fn() },
  "@zoonk/ai/tasks/research/translate-pass-marks": { translatePassMarks: vi.fn() },
  "@zoonk/ai/tasks/research/upload-visibility": { classifyUploadVisibility: vi.fn() },
  "@zoonk/ai/tasks/tutor/goal-tutor": { streamGoalTutorAnswer: vi.fn() },
  "@zoonk/ai/tasks/variants/step-variant": { generateStepVariant: vi.fn() },
  "@zoonk/core/analytics/server": { trackServerEvent: vi.fn(), trackSystemEvent: vi.fn() },
  "@zoonk/core/images/upload": { uploadImage: vi.fn() },
  "next/headers": { headers: vi.fn(async () => new Headers()) },
  undici: { fetch: vi.fn() },
};

export function resetBoundaries(): void {
  Object.values(boundaries)
    .flatMap((mocks) => Object.values(mocks))
    .forEach((mock) => {
      mock.mockReset();
    });
}
