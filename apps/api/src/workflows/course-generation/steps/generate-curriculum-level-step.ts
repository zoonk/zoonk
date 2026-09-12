import {
  getCourseGenerationFormat,
  getCourseGenerationPolicy,
} from "@/workflows/_shared/course-generation-context";
import {
  type CurriculumLevel,
  generateCourseCurriculumLevel,
} from "@zoonk/ai/tasks/courses/curriculum";
import { courseDiscoveryBriefSchema } from "@zoonk/ai/tasks/courses/discovery";
import { type Course } from "@zoonk/db";

/** Each level is durable independently, so one failed level does not regenerate the others. */
export async function generateCurriculumLevelStep({
  course,
  level,
}: {
  course: Course;
  level: CurriculumLevel | null;
}) {
  "use step";
  const format = getCourseGenerationFormat(course.format);

  const brief =
    format === "personalized" ? courseDiscoveryBriefSchema.parse(course.discoveryBrief) : null;

  const result = await generateCourseCurriculumLevel({
    brief,
    courseTitle: course.title,
    format,
    language: course.language,
    level,
    targetLanguage: course.targetLanguage,
    ...getCourseGenerationPolicy(course),
  });

  return result.data.chapters;
}
