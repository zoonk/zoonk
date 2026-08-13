import { getSession } from "../users/get-session";
import { getCoursePromptGenerationError } from "./course-prompt-generation";
import { getCoursePromptById } from "./get-course-prompt";

/** Charges only workflow states that can perform new AI work; active and completed runs are resumptions. */
function shouldClaimCourseGenerationQuota(generationStatus: string | null): boolean {
  return generationStatus === "pending" || generationStatus === "failed";
}

/**
 * Validates one persisted generation request and derives the optional learner
 * identity from the authenticated session before a delivery app starts the
 * workflow.
 *
 * This database-backed boundary intentionally lives outside the pure prompt
 * validator module because durable workflow code imports that validator and
 * cannot include Prisma in its workflow bundle.
 */
export async function getCourseGenerationAccess(coursePromptId: string) {
  const [coursePrompt, session] = await Promise.all([
    getCoursePromptById({ id: coursePromptId }),
    getSession(),
  ]);

  if (!coursePrompt) {
    return { status: "notFound" as const };
  }

  const error = getCoursePromptGenerationError(coursePrompt);

  if (error) {
    return { error, status: "invalid" as const };
  }

  return {
    coursePromptId: coursePrompt.id,
    shouldClaimQuota: shouldClaimCourseGenerationQuota(coursePrompt.generationStatus),
    status: "ready" as const,
    userId: session?.user.id ?? null,
  };
}
