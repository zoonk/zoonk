import { type AnalyticsPlatform } from "@zoonk/core/analytics/shared-properties";
import { EXPLANATION_READY_STEP } from "@zoonk/core/library/generation/steps";
import { WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";
import { getWorkflowMetadata } from "workflow";
import { start } from "workflow/api";
import { trackGenerationFailedStep } from "../_shared/generation-failed-step";
import { repeatUntil } from "../_shared/repeat-until";
import { claimRunToken } from "../_shared/run-token";
import { courseOutlineWorkflow } from "../courses/course-outline-workflow";
import { recordGoalRunStep } from "../goals/steps/record-goal-run-step";
import { lessonImagesWorkflow } from "../images/lesson-images-workflow";
import { explainProgressStep } from "./steps/explain-progress-step";
import {
  type QuestionSkill,
  classifyQuestionStep,
  findExplanationGoFurtherStep,
  findGoFurtherCourseStep,
  linkExplanationToGoalStep,
  linkGoFurtherCourseStep,
  loadExplainGoalStep,
  resolveQuestionSkillStep,
  saveExplanationStep,
  writeExplanationStep,
} from "./steps/explain-steps";

export type ExplainQuestionResult = {
  goalId: string;
  lessonId: string | null;
  status: "failed" | "joined" | "missing" | "ready" | "reused";
};

const MAX_WRITES = 2;

type WriteContext = Parameters<typeof writeExplanationStep>[0];

function writeChecked(context: WriteContext) {
  return repeatUntil({
    done: (written) => written.problems.length === 0,
    run: () => writeExplanationStep(context),
    times: MAX_WRITES,
  });
}

async function saveAndDraw({
  goal,
  ownerId,
  skill,
  written,
  ...context
}: WriteContext & { skill: QuestionSkill; written: Awaited<ReturnType<typeof writeChecked>> }) {
  const saved = await saveExplanationStep({
    ...written,
    goal,
    ownerId,
    skill,
    workflowRunId: context.workflowRunId,
  });

  if (saved.status === "saved" && !goal.isGuest) {
    await start(lessonImagesWorkflow, [
      {
        analytics: { ...context.analytics, contentScope: ownerId ? "personal" : "shared" },
        lessonId: saved.lessonId,
      },
    ]);
  }

  return saved;
}

type GoFurtherCourse = Awaited<ReturnType<typeof findGoFurtherCourseStep>>;

async function linkGoFurther({
  course,
  goal,
  lessonId,
}: {
  course: GoFurtherCourse;
  goal: { id: string; language: string };
  lessonId: string;
}): Promise<void> {
  if (course?.created) {
    const scope = {
      generalGoal: null,
      language: goal.language,
      ownerId: null,
      targetLanguage: null,
    };

    await start(courseOutlineWorkflow, [
      { bands: [{ level: "overview", skills: [] }], courseId: course.courseId, scope },
    ]);
  }

  if (course) {
    await linkGoFurtherCourseStep({ courseId: course.courseId, goalId: goal.id, lessonId });
  }
}

/**
 * A guest's question never makes a course to go further, so the next learner's run finds it from
 * the draft it wrote meanwhile, for everyone after.
 */
async function completeGoFurther({
  goal,
  lessonId,
  writing,
}: {
  goal: WriteContext["goal"];
  lessonId: string;
  writing: ReturnType<typeof writeChecked>;
}): Promise<void> {
  const written = await writing.catch(() => null);

  if (!written || written.problems.length > 0) {
    return;
  }

  const course = await findGoFurtherCourseStep({
    language: goal.language,
    provenance: written.provenance,
    title: written.explanation.goFurther.overviewCourse,
  });

  await linkGoFurther({ course, goal, lessonId });
}

async function finish(result: ExplainQuestionResult): Promise<ExplainQuestionResult> {
  const succeeded = result.status === "ready" || result.status === "reused";

  await explainProgressStep(
    succeeded
      ? {
          entityId: result.lessonId ?? undefined,
          status: "completed",
          step: EXPLANATION_READY_STEP,
        }
      : {
          entityId: result.goalId,
          reason: "contentValidationFailed",
          status: "error",
          step: WORKFLOW_ERROR_STEP,
        },
  );

  return result;
}

export async function explainQuestionWorkflow({
  goalId,
  platform,
}: {
  goalId: string;
  platform?: AnalyticsPlatform | null;
}): Promise<ExplainQuestionResult> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();
  const { conflict } = await claimRunToken(`explain:${goalId}`);

  if (conflict) {
    await explainProgressStep({
      entityId: conflict.runId,
      status: "started",
      step: "joinRunningExplanation",
    });

    return { goalId, lessonId: null, status: "joined" };
  }

  await recordGoalRunStep({ generationId: workflowRunId, goalId });

  const goal = await loadExplainGoalStep(goalId);

  if (!goal || goal.answered) {
    return finish({ goalId, lessonId: null, status: goal ? "ready" : "missing" });
  }

  const context = { analytics: { distinctId: goal.userId, goalId, platform }, workflowRunId };
  const ownerId = (await classifyQuestionStep({ goal })) ? null : goal.userId;

  // Written while the identity search runs: discarding a fast model's draft when an earlier
  // explanation is reused costs less than the wait.
  const writing = writeChecked({ ...context, goal, ownerId });
  // A write that fails before it's awaited would otherwise crash the run as an unhandled rejection.
  void writing.catch(() => null);

  const skill = await resolveQuestionSkillStep({ ...context, goal, ownerId });

  if (skill.kind === "existing" && skill.existingLessonId) {
    const goFurther = await findExplanationGoFurtherStep(skill.existingLessonId);

    await linkExplanationToGoalStep({
      ...goFurther,
      goalId,
      skill: { id: skill.skillId, name: goal.question },
      title: goal.title,
    });

    const reused = await finish({ goalId, lessonId: skill.existingLessonId, status: "reused" });

    if (!goFurther.courseId && !goal.isGuest) {
      await completeGoFurther({ goal, lessonId: skill.existingLessonId, writing });
    }

    return reused;
  }

  const written = await writing;

  if (written.problems.length > 0) {
    await trackGenerationFailedStep({
      analytics: context.analytics,
      contentKind: "explanation",
      task: "explain-question",
    });

    return finish({ goalId, lessonId: null, status: "failed" });
  }

  const [saved, course] = await Promise.all([
    saveAndDraw({ ...context, goal, ownerId, skill, written }),
    goal.isGuest
      ? null
      : findGoFurtherCourseStep({
          language: goal.language,
          provenance: written.provenance,
          title: written.explanation.goFurther.overviewCourse,
        }),
  ]);

  await linkGoFurther({ course, goal, lessonId: saved.lessonId });

  return finish({ goalId, lessonId: saved.lessonId, status: "ready" });
}
