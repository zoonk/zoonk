import "server-only";
import { type getCatalogCourseNextLesson } from "@zoonk/core/catalog/next-lesson";
import { NextResponse } from "next/server";
import { errors } from "../api-errors";

type NextLessonResult = Awaited<ReturnType<typeof getCatalogCourseNextLesson>>;

/**
 * Serializes the course and chapter next-lesson resources: Core's route-neutral
 * brand becomes the public organization field, and a course or chapter without
 * a target is an explicit empty variant.
 */
export function toNextLessonResponse(result: NextLessonResult) {
  if (result.status === "notFound") {
    return errors.notFound();
  }

  if (!result.target) {
    return NextResponse.json({ completed: false, hasStarted: false, type: "empty" });
  }

  const { brandSlug, ...target } = result.target;
  return NextResponse.json({ ...target, organizationSlug: brandSlug });
}
