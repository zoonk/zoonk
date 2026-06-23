import { createStepStream } from "@/workflows/_shared/stream-status";
import { type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
import { type CourseStartRequest, type GenerationStatus, prisma } from "@zoonk/db";
import { FatalError } from "workflow";

export type GeneratableCourseStartRequest = CourseStartRequest & {
  canonicalTitle: string;
  generationStatus: GenerationStatus;
};

/**
 * Narrows persisted routing decisions to the subset the course workflow can
 * generate today. Redirect-only, waitlist, and unsafe requests are valid admin
 * records but invalid workflow inputs.
 */
export function assertGeneratableCourseStartRequest(
  request: CourseStartRequest,
): asserts request is GeneratableCourseStartRequest {
  if (!(request.canonicalTitle && request.generationStatus)) {
    throw new FatalError("Course start request is not generatable");
  }
}

/**
 * Fetches the course start request from the database.
 * Always returns the request so the workflow can decide what to do
 * based on the generation status (e.g., skip if running, stream completion if completed).
 */
export async function getCourseStartRequestStep(
  courseStartRequestId: string,
): Promise<GeneratableCourseStartRequest> {
  "use step";

  await using stream = createStepStream<CourseWorkflowStepName>();

  await stream.status({ status: "started", step: "getCourseStartRequest" });

  const request = await prisma.courseStartRequest.findUnique({
    where: { id: courseStartRequestId },
  });

  if (!request) {
    await stream.error({ reason: "notFound", step: "getCourseStartRequest" });
    throw new FatalError("Course start request not found");
  }

  assertGeneratableCourseStartRequest(request);

  await stream.status({ status: "completed", step: "getCourseStartRequest" });
  return request;
}
