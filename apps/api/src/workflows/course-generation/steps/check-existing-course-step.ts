import { type CourseSuggestion, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { ensureLocaleSuffix, toSlug } from "@zoonk/utils/string";
import { streamError, streamStatus } from "../stream-status";

const courseInclude = {
  _count: {
    select: {
      alternativeTitles: true,
      categories: true,
      chapters: true,
    },
  },
} as const;

export type ExistingCourse = NonNullable<
  Awaited<ReturnType<typeof prisma.course.findFirst<{ include: typeof courseInclude }>>>
>;

export async function checkExistingCourseStep(
  suggestion: CourseSuggestion,
): Promise<ExistingCourse | null> {
  "use step";

  await streamStatus({ status: "started", step: "checkExistingCourse" });

  const normalizedSlug = toSlug(suggestion.slug);

  const { data, error } = await safeAsync(() =>
    Promise.all([
      prisma.course.findFirst({
        include: courseInclude,
        where: {
          organization: { slug: AI_ORG_SLUG },
          slug: ensureLocaleSuffix(normalizedSlug, suggestion.language),
        },
      }),
      prisma.courseAlternativeTitle.findUnique({
        include: {
          course: { include: courseInclude },
        },
        where: {
          languageSlug: { language: suggestion.language, slug: normalizedSlug },
        },
      }),
    ]),
  );

  if (error) {
    await streamError({ reason: "dbFetchFailed", step: "checkExistingCourse" });
    throw error;
  }

  const [courseMatch, alternativeTitleMatch] = data;

  await streamStatus({ status: "completed", step: "checkExistingCourse" });

  if (courseMatch) {
    return courseMatch;
  }

  if (alternativeTitleMatch) {
    return alternativeTitleMatch.course;
  }

  return null;
}
