import { getCourseGenerationFormat } from "@/workflows/_shared/course-generation-context";
import {
  CORE_COURSE_LEVELS,
  LANGUAGE_COURSE_LEVELS,
} from "@zoonk/core/courses/learning-plan-contract";
import { type Course } from "@zoonk/db";
import { curriculumStatusStep } from "../steps/curriculum-status-step";
import { generateCurriculumLevelStep } from "../steps/generate-curriculum-level-step";

function getCurriculumLevels(format: string) {
  if (format === "core") {
    return CORE_COURSE_LEVELS;
  }

  if (format === "language") {
    return LANGUAGE_COURSE_LEVELS;
  }

  return [null];
}

/** All actual levels are required before publication; their independent calls can recover separately. */
export async function generateCurriculumOutline(course: Course) {
  const format = getCourseGenerationFormat(course.format);

  const levels = getCurriculumLevels(format);

  await curriculumStatusStep({ status: "started", step: "generateChapters" });

  const results = await Promise.allSettled(
    levels.map((level) => generateCurriculumLevelStep({ course, level })),
  );

  const failed = results.find((result) => result.status === "rejected");

  if (failed?.status === "rejected") {
    throw failed.reason;
  }

  const chapters = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  await curriculumStatusStep({ status: "completed", step: "generateChapters" });
  return chapters;
}
