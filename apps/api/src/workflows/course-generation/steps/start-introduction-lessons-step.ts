import { lessonGenerationWorkflow } from "@/workflows/lesson-generation/lesson-generation-workflow";
import { type Lesson } from "@zoonk/db";
import { logError } from "@zoonk/utils/logger";
import { start } from "workflow/api";

type IntroductionLessonWorkflowRun = Awaited<ReturnType<typeof start>>;

/**
 * Intro lesson warmup is opportunistic: learners can still open a pending lesson
 * later and let the lesson workflow run from that page. Returning only successful
 * run ids keeps course setup from failing after the intro lesson rows are saved.
 */
function getStartedRunId(
  result: PromiseSettledResult<IntroductionLessonWorkflowRun>,
): string | null {
  if (result.status === "fulfilled") {
    return result.value.runId;
  }

  logError("Intro lesson workflow failed to start", result.reason);

  return null;
}

/**
 * Enqueues intro lesson warmups from inside course setup. Position zero is
 * generated directly by the parent workflow, so this step is for later lessons
 * that should not delay the course redirect.
 */
export async function startIntroductionLessonsStep({
  lessons,
}: {
  lessons: Pick<Lesson, "id">[];
}): Promise<string[]> {
  "use step";

  const runs = await Promise.allSettled(
    lessons.map((lesson) => start(lessonGenerationWorkflow, [lesson.id])),
  );

  return runs.map((run) => getStartedRunId(run)).filter((runId): runId is string => Boolean(runId));
}
