import "server-only";
import { type CallReuse, type ServiceTier } from "@zoonk/ai/provider-options";
import { type WriteLessonDraftParams } from "@zoonk/ai/tasks/v2/lesson-writer";
import { type WrittenLesson } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import {
  type CheckLessonQualityParams,
  checkLessonQuality,
} from "@zoonk/ai/tasks/v2/quality/lesson-check";
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

const LENIENT_AFTER_FIX = new Set<LessonCheckProblem["code"]>([
  "readingLevel",
  "repeatedExample",
  "repeatedQuestion",
  "termOrder",
]);

export type LessonGateProblem = {
  problem: string;
  screen: number | null;
  source: "code" | "review";
};

type LessonGateResult = {
  blocking: LessonGateProblem[];
  incorrect: LessonGateProblem[];
  minor: LessonGateProblem[];
  screens: ConvertedScreen[];
};

async function reviewLesson({
  afterFix,
  analytics,
  context,
  lesson,
  reuse,
  screens,
  serviceTier,
  writerModel,
}: {
  afterFix: boolean;
  analytics?: AiAnalytics;
  context: LessonWritingContext;
  lesson: WrittenLesson;
  reuse: CallReuse;
  screens: readonly ConvertedScreen[];
  serviceTier?: ServiceTier;
  writerModel: string;
}): Promise<Pick<LessonGateResult, "blocking" | "incorrect" | "minor">> {
  const { data } = await checkLessonQuality({
    ...context,
    analytics,
    lesson: toReviewedLesson({ lesson, screens }),
    reuse,
    serviceTier,
    writerModel,
  });

  type Issue = (typeof data.issues)[number];

  const toProblem = (issue: Issue): LessonGateProblem => ({
    problem: `${issue.problem} Fix: ${issue.fix}`,
    screen: issue.screen,
    source: "review",
  });

  const isBlocking = (issue: Issue) =>
    issue.severity === "blocking" && (!afterFix || issue.kind === "incorrect");

  const blocking = data.issues.filter((issue) => isBlocking(issue));

  return {
    blocking: blocking.map((issue) => toProblem(issue)),
    incorrect: blocking
      .filter((issue) => issue.kind === "incorrect")
      .map((issue) => toProblem(issue)),
    minor: data.issues.filter((issue) => !isBlocking(issue)).map((issue) => toProblem(issue)),
  };
}

export async function runLessonQualityGate({
  afterFix = false,
  allowActivityFallback = false,
  analytics,
  context,
  lesson,
  reuse,
  review,
  serviceTier,
  writerModel,
}: {
  afterFix?: boolean;
  allowActivityFallback?: boolean;
  analytics?: AiAnalytics;
  context: LessonWritingContext;
  lesson: WrittenLesson;
  reuse: CallReuse;
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

  const [programProblems, reviewed] = await Promise.all([
    checkLessonPrograms(checked.screens),
    review
      ? reviewLesson({
          afterFix,
          analytics,
          context,
          lesson,
          reuse,
          screens: checked.screens,
          serviceTier,
          writerModel,
        })
      : { blocking: [], incorrect: [], minor: [] },
  ]);

  const codeProblems = [...checked.problems, ...programProblems].map((problem) => ({
    isMinor: afterFix && LENIENT_AFTER_FIX.has(problem.code),
    problem: { problem: problem.problem, screen: problem.screen, source: "code" as const },
  }));

  return {
    blocking: [
      ...codeProblems.filter((entry) => !entry.isMinor).map((entry) => entry.problem),
      ...reviewed.blocking,
    ],
    incorrect: reviewed.incorrect,
    minor: [
      ...codeProblems.filter((entry) => entry.isMinor).map((entry) => entry.problem),
      ...reviewed.minor,
    ],
    screens: checked.screens,
  };
}
