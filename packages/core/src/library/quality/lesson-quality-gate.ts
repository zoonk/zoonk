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

/** The lesson plan and course context every writing task reads. */
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
  | "sources"
  | "spec"
>;

type AiAnalytics = CheckLessonQualityParams["analytics"];

/** Code problems the fix pass should fix but that don't hold a fixed lesson back. */
const LENIENT_AFTER_FIX = new Set<LessonCheckProblem["code"]>([
  "readingLevel",
  "repeatedExample",
  "repeatedQuestion",
  "termOrder",
]);

/** A problem for the fix pass, from code or from the reviewer. */
export type LessonGateProblem = {
  problem: string;
  screen: number | null;
  source: "code" | "review";
};

type LessonGateResult = {
  /** Problems that keep the lesson from being published. */
  blocking: LessonGateProblem[];
  /**
   * The blocking problems the reviewer found wrong (a fact, a number, an answer key), the ones a
   * fix that leaves their screen as it was can't have fixed.
   */
  incorrect: LessonGateProblem[];
  /** Improvements the reviewer suggested that don't block publishing. */
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

  // A fresh review of a fixed lesson always finds something new to polish, so after the fix pass
  // only something wrong still holds the lesson back.
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

/**
 * The quality gate for a written lesson: code checks on everything (including
 * running the code in code activities) and, when `review` is set, the
 * cross-family reasoning check. It returns each screen as stored content with
 * the problems that block publishing and the reviewer's minor suggestions, all
 * written for the fix pass.
 */
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
  /**
   * The gate after the fix pass: only what's wrong still holds the lesson back. A sentence a
   * little long for the level, a term used one screen early, an example another lesson already
   * used, a check that asks an earlier one's question again or a style problem the reviewer still
   * sees becomes a suggestion, because a learner
   * waiting on a lesson is worse off than one reading a lesson that isn't perfect yet.
   */
  afterFix?: boolean;
  allowActivityFallback?: boolean;
  analytics?: AiAnalytics;
  context: LessonWritingContext;
  lesson: WrittenLesson;
  /** How likely the lesson is to be read again, which picks the reviewer (`getLessonCheckModels`). */
  reuse: CallReuse;
  review: boolean;
  /** The reviewer's gateway tier: `flex` when the lesson is written well before a learner reaches it. */
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
