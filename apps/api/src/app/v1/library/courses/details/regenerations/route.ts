import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { courseDetailsRegenerationRequestSchema } from "@/lib/openapi/schemas/course-details-regenerations";
import { listInFlightCourseDetails } from "@/workflows/v2/courses/course-details-runs";
import { startCourseDetailsRun } from "@/workflows/v2/courses/start-course-details-run";
import {
  getCourseDetailsRegenerationPreview,
  regenerateCourseDetails,
} from "@zoonk/core/library/courses/regenerate-details";
import { type NextRequest, NextResponse } from "next/server";

async function createCourseDetailsRegeneration(request: NextRequest) {
  const parsed = await parseBody(request, courseDetailsRegenerationRequestSchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const result = await regenerateCourseDetails({
    getInFlightCourseIds: listInFlightCourseDetails,
    promptVersion: parsed.data.promptVersion,
    startCourseDetails: (courseId) => startCourseDetailsRun({ copyOnly: true, courseId }),
  });

  if (result.status !== "started") {
    return result.status === "unauthorized" ? errors.unauthorized() : errors.forbidden();
  }

  return NextResponse.json({ courseIds: result.courseIds, failed: result.failed }, { status: 202 });
}

export const POST = withApiErrorBoundary(createCourseDetailsRegeneration);

/** A count and estimate only: rendering admin never clears copy or starts a workflow. */
async function previewCourseDetailsRegeneration() {
  const result = await getCourseDetailsRegenerationPreview({
    getInFlightCourseIds: listInFlightCourseDetails,
  });

  if (result.status !== "ready") {
    return result.status === "unauthorized" ? errors.unauthorized() : errors.forbidden();
  }

  return NextResponse.json({
    batchSize: result.batchSize,
    estimatedCost: result.estimatedCost,
    matching: result.matching,
  });
}

export const GET = withApiErrorBoundary(previewCourseDetailsRegeneration);
