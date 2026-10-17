import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { cacheTag, io } from "next/cache";
import {
  getCourseCacheTag,
  getCourseCurriculumCacheTag,
  getExamBlueprintCacheTag,
} from "../cache/tags";
import { getExamCalendarDay, getPlanExamDays } from "../exams/_utils/plan-exam-days";
import { loadCourseExam } from "../goals/_utils/course-exam";
import { type CourseExamDays } from "./course-exam-days-contract";

async function getCachedCourseExamDays({
  courseId,
  blueprintId,
  edition,
  today,
  timeZone,
}: {
  courseId: string;
  blueprintId: string;
  edition: unknown;
  today: string;
  timeZone: string;
}): Promise<CourseExamDays | null> {
  "use cache";

  cacheTag(
    getCourseCacheTag(courseId),
    getCourseCurriculumCacheTag(courseId),
    getExamBlueprintCacheTag(blueprintId),
  );

  const found = getPlanExamDays({ details: {}, edition, goalDate: null, today });

  return found.days.length > 0
    ? { days: found.days.map((day) => day.date), estimated: found.estimated, timeZone }
    : null;
}

/**
 * A published public exam course's next sitting, using the course start's exact date source.
 * Fresh publication checks and edition input protect cross-app caches; notice writes invalidate
 * the blueprint tag. No session, learner data, research or writes.
 */
export async function getCourseExamDays(courseId: string): Promise<CourseExamDays | null> {
  if (!isUuid(courseId)) {
    return null;
  }

  const id = courseId.toLowerCase();

  const course = await prisma.course.findFirst({
    where: { format: "exam", id, isPublished: true, visibility: "public" },
  });

  if (!course) {
    return null;
  }

  const exam = await loadCourseExam(id);

  if (!exam) {
    return null;
  }

  await io();
  const calendar = getExamCalendarDay({ edition: exam.blueprint.edition, now: new Date() });

  return getCachedCourseExamDays({
    blueprintId: exam.blueprint.id,
    courseId: id,
    edition: exam.blueprint.edition,
    ...calendar,
  });
}
