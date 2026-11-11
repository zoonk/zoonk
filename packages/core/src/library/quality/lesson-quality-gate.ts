import "server-only";
import { type ServiceTier } from "@zoonk/ai/provider-options";
import { type WriteLessonDraftParams } from "@zoonk/ai/tasks/lesson-writer";
import { type WrittenLesson } from "@zoonk/ai/tasks/lesson-writer/schema";
import {
  type CheckLessonQualityParams,
  checkLessonQuality,
} from "@zoonk/ai/tasks/quality/lesson-check";
import { type ConvertedScreen } from "../steps/written-screens";
import {
  type LessonCheckProblem,
  checkWrittenLesson,
  toReviewedLesson,
} from "./lesson-code-checks";
import { checkLessonPrograms } from "./lesson-program-checks";

export type LessonWritingContext = Pick<
  WriteLessonDraftParams,
  | "activityTemplates"
  | "chapterLessons"
  | "chapterTitle"
  | "courseTitle"
  | "exams"
  | "language"
  | "level"
  | "material"
  | "setup"
  | "sources"
  | "spec"
  | "shortAnswers"
>;

type AiAnalytics = CheckLessonQualityParams["analytics"];

/** Advisory codes never block publication or start a fix. */
const ADVISORY_CODES = new Set<LessonCheckProblem["code"]>([
  "basis",
  "guessAnswer",
  "moneyFormat",
  "newTerms",
  "plannedVisual",
  "readingLevel",
  "repeatedExample",
  "repeatedQuestion",
  "repeatedVisual",
  "termOrder",
]);

export type LessonGateProblem = {
  problem: string;
  screen: number | null;
  source: "code" | "review";
};

type LessonGateResult = {
  blocking: LessonGateProblem[];
  minor: LessonGateProblem[];
  screens: ConvertedScreen[];
};

async function reviewLesson({
  analytics,
  context,
  lesson,
  screens,
  serviceTier,
  writerModel,
}: {
  analytics?: AiAnalytics;
  context: LessonWritingContext;
  lesson: WrittenLesson;
  screens: readonly ConvertedScreen[];
  serviceTier?: ServiceTier;
  writerModel: string;
}): Promise<LessonGateProblem[]> {
  const { data } = await checkLessonQuality({
    ...context,
    analytics,
    lesson: toReviewedLesson({ lesson, screens }),
    serviceTier,
    writerModel,
  });

  return data.issues.map((issue) => ({
    problem: `${issue.problem} Fix: ${issue.fix}`,
    screen: issue.screen,
    source: "review",
  }));
}

export async function runLessonQualityGate({
  allowActivityFallback = false,
  analytics,
  context,
  lesson,
  review,
  serviceTier,
  writerModel,
}: {
  allowActivityFallback?: boolean;
  analytics?: AiAnalytics;
  context: LessonWritingContext;
  lesson: WrittenLesson;
  review: boolean;
  serviceTier?: ServiceTier;
  writerModel: string;
}): Promise<LessonGateResult> {
  const checked = checkWrittenLesson({
    allowActivityFallback,
    chapterLessons: context.chapterLessons,
    language: context.language,
    lesson,
    level: context.level,
    material: context.material,
    shortAnswers: context.shortAnswers,
    sources: context.sources,
    spec: context.spec,
  });

  const [programProblems, reviewProblems] = await Promise.all([
    checkLessonPrograms(checked.screens),
    review
      ? reviewLesson({
          analytics,
          context,
          lesson,
          screens: checked.screens,
          serviceTier,
          writerModel,
        })
      : [],
  ]);

  const codeProblems = [...checked.problems, ...programProblems].map((problem) => ({
    isMinor: ADVISORY_CODES.has(problem.code),
    problem: { problem: problem.problem, screen: problem.screen, source: "code" as const },
  }));

  return {
    blocking: [
      ...codeProblems.filter((entry) => !entry.isMinor).map((entry) => entry.problem),
      ...reviewProblems,
    ],
    minor: codeProblems.filter((entry) => entry.isMinor).map((entry) => entry.problem),
    screens: checked.screens,
  };
}
