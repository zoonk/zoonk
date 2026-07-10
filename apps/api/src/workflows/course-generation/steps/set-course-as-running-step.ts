import { createStepStream } from "@/workflows/_shared/stream-status";
import { type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
import { type Course, type TransactionClient, prisma } from "@zoonk/db";

export type CourseSetupStatus = "completed" | "ready" | "running";

type CourseClaim = { generationRunId: Course["generationRunId"]; status: CourseSetupStatus };

/**
 * Locks the course before generation ownership is inspected. Completion and
 * failure persist their course state before their prompt state in transactions
 * that acquire the same row lock, so the prompt cannot be reconciled from a
 * stale running snapshot while the course becomes terminal.
 */
async function getLockedCourse({
  courseId,
  transaction,
}: {
  courseId: string;
  transaction: TransactionClient;
}): Promise<Course> {
  await transaction.$queryRaw`SELECT "id" FROM "courses" WHERE "id" = ${courseId}::uuid FOR UPDATE`;

  return transaction.course.findUniqueOrThrow({ where: { id: courseId } });
}

/**
 * Recovers the owner of a legacy running course whose run id was cleared while
 * its linked prompt retained the active run. Prefer the current workflow when
 * it already owns a linked prompt; otherwise preserve the most recently linked
 * owner instead of incorrectly stealing an in-progress course.
 */
async function getLinkedRunningOwner({
  courseId,
  transaction,
  workflowRunId,
}: {
  courseId: string;
  transaction: TransactionClient;
  workflowRunId: string;
}): Promise<string | null> {
  const prompts = await transaction.coursePrompt.findMany({
    orderBy: { updatedAt: "desc" },
    where: { courseId, generationRunId: { not: null }, generationStatus: "running" },
  });

  return (
    prompts.find((prompt) => prompt.generationRunId === workflowRunId)?.generationRunId ??
    prompts[0]?.generationRunId ??
    null
  );
}

/**
 * Assigns generation ownership while the caller holds the course row lock.
 * This is shared by ordinary retries and legacy running rows with no course
 * owner so both paths persist the same complete ownership state.
 */
async function assignCourseOwner({
  courseId,
  transaction,
  workflowRunId,
}: {
  courseId: string;
  transaction: TransactionClient;
  workflowRunId: string;
}): Promise<void> {
  await transaction.course.update({
    data: { generationRunId: workflowRunId, generationStatus: "running" },
    where: { id: courseId },
  });
}

/**
 * Claims a retryable course while its row is locked, or reports the terminal
 * or winning state that another workflow committed first. Serializing this
 * decision keeps duplicate starts from generating the same course together.
 */
async function getCourseClaim({
  courseId,
  transaction,
  workflowRunId,
}: {
  courseId: string;
  transaction: TransactionClient;
  workflowRunId: string;
}): Promise<CourseClaim> {
  const course = await getLockedCourse({ courseId, transaction });

  if (course.generationStatus === "failed" || course.generationStatus === "pending") {
    await assignCourseOwner({ courseId, transaction, workflowRunId });

    return { generationRunId: workflowRunId, status: "ready" };
  }

  if (course.generationStatus === "running" && course.generationRunId === null) {
    const linkedOwner = await getLinkedRunningOwner({ courseId, transaction, workflowRunId });
    const recoveredOwner = linkedOwner ?? workflowRunId;

    await assignCourseOwner({ courseId, transaction, workflowRunId: recoveredOwner });

    return {
      generationRunId: recoveredOwner,
      status: recoveredOwner === workflowRunId ? "ready" : "running",
    };
  }

  if (course.generationStatus === "running" && course.generationRunId === workflowRunId) {
    return { generationRunId: workflowRunId, status: "ready" };
  }

  if (course.generationStatus === "completed") {
    return { generationRunId: course.generationRunId, status: "completed" };
  }

  if (course.generationStatus === "running") {
    return { generationRunId: course.generationRunId, status: "running" };
  }

  throw new Error("Course generation claim did not reach a stable state");
}

/**
 * Reconciles the requesting prompt with the course state observed by the claim
 * transaction. Losing workflows point at the winning run instead of starting
 * duplicate generation from the stale course snapshot they originally read.
 */
async function updatePromptForCourseClaim({
  claim,
  courseId,
  coursePromptId,
  transaction,
}: {
  claim: CourseClaim;
  courseId: string;
  coursePromptId: string;
  transaction: TransactionClient;
}): Promise<void> {
  await transaction.coursePrompt.update({
    data: {
      courseId,
      generationRunId: claim.generationRunId,
      generationStatus: claim.status === "ready" ? "running" : claim.status,
    },
    where: { id: coursePromptId },
  });
}

/**
 * Atomically claims course generation ownership and reconciles the requesting
 * prompt to the state observed under the course row lock.
 */
export async function setCourseAsRunningStep(input: {
  courseId: string;
  coursePromptId: string;
  workflowRunId: string;
}): Promise<CourseSetupStatus> {
  "use step";

  await using stream = createStepStream<CourseWorkflowStepName>();

  await stream.status({ status: "started", step: "setCourseAsRunning" });

  const status = await prisma.$transaction(async (transaction) => {
    const claim = await getCourseClaim({
      courseId: input.courseId,
      transaction,
      workflowRunId: input.workflowRunId,
    });

    await updatePromptForCourseClaim({
      claim,
      courseId: input.courseId,
      coursePromptId: input.coursePromptId,
      transaction,
    });

    return claim.status;
  });

  await stream.status({ status: "completed", step: "setCourseAsRunning" });

  return status;
}
