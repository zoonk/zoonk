import { createStepStream } from "@/workflows/_shared/stream-status";
import { type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
import {
  type CourseGetPayload,
  type CourseSuggestion,
  getAiGenerationCourseWhere,
  prisma,
} from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { ensureLocaleSuffix, toSlug } from "@zoonk/utils/string";

const courseInclude = {
  _count: {
    select: {
      alternativeTitles: true,
      categories: true,
      chapters: true,
    },
  },
} as const;

export type ExistingCourse = CourseGetPayload<{ include: typeof courseInclude }>;

export async function checkExistingCourseStep(
  suggestion: CourseSuggestion,
): Promise<ExistingCourse | null> {
  "use step";

  await using stream = createStepStream<CourseWorkflowStepName>();

  await stream.status({ status: "started", step: "checkExistingCourse" });

  const normalizedSlug = toSlug(suggestion.slug);

  const { data, error } = await safeAsync(() =>
    Promise.all([
      prisma.course.findFirst({
        include: courseInclude,
        where: getAiGenerationCourseWhere({
          slug: ensureLocaleSuffix(normalizedSlug, suggestion.language),
        }),
      }),
      prisma.courseAlternativeTitle.findFirst({
        include: {
          course: { include: courseInclude },
        },
        where: {
          course: getAiGenerationCourseWhere(),
          language: suggestion.language,
          slug: normalizedSlug,
        },
      }),
    ]),
  );

  if (error) {
    throw error;
  }

  const [courseMatch, alternativeTitleMatch] = data;

  await stream.status({ status: "completed", step: "checkExistingCourse" });

  if (courseMatch) {
    return courseMatch;
  }

  if (alternativeTitleMatch) {
    return alternativeTitleMatch.course;
  }

  return null;
}
