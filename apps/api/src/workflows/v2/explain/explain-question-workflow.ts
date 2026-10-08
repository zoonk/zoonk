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

/** One more try when the first explanation fails its checks; a fast model makes it cheap. */
const MAX_WRITES = 2;

type WriteContext = Parameters<typeof writeExplanationStep>[0];

function writeChecked(context: WriteContext) {
  return repeatUntil({
    done: (written) => written.problems.length === 0,
    run: () => writeExplanationStep(context),
    times: MAX_WRITES,
  });
}

/**
 * Saves a new explanation for the learner to read, then starts drawing its pictures in the
 * background, like a lesson's. A guest's explanation gets none.
 */
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

/**
 * Answers an explain question as a quick explanation: about five short screens and one check,
 * then "Now you know" and "Want to go further?" into the subject's Overview course with related
 * questions. A general question is a shared skill, so a question someone already asked in other
 * words is answered at once with the same explanation; a personal one is written only for the
 * asker. A new explanation's pictures are drawn in the background, like a lesson's, and the
 * Overview course is outlined in the background when it doesn't exist yet; a guest's question
 * gets neither, so it costs no more than its share of the guests' daily budget.
 *
 * The wait is only what reading needs: the explanation is written while the identity search runs,
 * and `writeExplanation` completes once it's saved and can be read. The course to go further is
 * found meanwhile and linked after it, and `explanationReady` ends the run.
 */
export async function explainQuestionWorkflow({
  goalId,
  platform,
}: {
  goalId: string;
  /** The client whose request started the run, for analytics. */
  platform?: AnalyticsPlatform | null;
}): Promise<ExplainQuestionResult> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();
  const { conflict } = await claimRunToken(`explain:${goalId}`);

  // Whoever follows this run's id (an API client that just asked for it) moves to the run
  // answering the question, like a goal's run that joins another.
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

  // Written while the identity search looks for the same question asked before: the explanation
  // doesn't depend on it, and a reused one only discards a fast model's run (about $0.0007).
  const writing = writeChecked({ ...context, goal, ownerId });
  // Handled at once, so a write that fails before it's awaited can't crash the run as an
  // unhandled rejection; awaiting it below still throws.
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

    return finish({ goalId, lessonId: skill.existingLessonId, status: "reused" });
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

  // The learner reads as soon as it's saved; the course to go further is found meanwhile.
  const [saved, course] = await Promise.all([
    saveAndDraw({ ...context, goal, ownerId, skill, written }),
    // A guest's question is answered without extra work: no pictures, no new course to go further.
    goal.isGuest
      ? null
      : findGoFurtherCourseStep({
          language: goal.language,
          provenance: written.provenance,
          title: written.explanation.goFurther.overviewCourse,
        }),
  ]);

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
    await linkGoFurtherCourseStep({ courseId: course.courseId, goalId });
  }

  return finish({ goalId, lessonId: saved.lessonId, status: "ready" });
}
