import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { toCourseResource } from "@/lib/catalog-responses";
import { coursePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { getCourseTryLesson } from "@zoonk/core/catalog/try-lesson";
import { getCourseDetail } from "@zoonk/core/courses/get-detail";
import { NextResponse } from "next/server";

async function getCourse(_request: Request, context: RouteContext<"/v1/courses/[courseId]">) {
  const parsed = await readPathParams(context, coursePathParamsSchema);

  const [course, tryLesson] = await Promise.all([
    getCourseDetail({ courseId: parsed.courseId }),
    getCourseTryLesson({ courseId: parsed.courseId }),
  ]);

  if (!course) {
    return errors.notFound("Course not found");
  }

  return NextResponse.json({ ...toCourseResource(course), tryLesson });
}

export const GET = withApiErrorBoundary(getCourse);
