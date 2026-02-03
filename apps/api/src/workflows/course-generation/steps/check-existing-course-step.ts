import { prisma } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { safeAsync } from "@zoonk/utils/error";
import { toSlug } from "@zoonk/utils/string";
import { streamStatus } from "../stream-status";
import { type CourseSuggestionData } from "../types";

export type ExistingCourse = {
  id: number;
  slug: string;
  generationStatus: string;
  description: string | null;
  imageUrl: string | null;
  _count: {
    alternativeTitles: number;
    categories: number;
    chapters: number;
  };
};

export async function checkExistingCourseStep(
  suggestion: CourseSuggestionData,
): Promise<ExistingCourse | null> {
  "use step";

  await streamStatus({ status: "started", step: "checkExistingCourse" });

  const normalizedSlug = toSlug(suggestion.slug);

  const courseSelect = {
    _count: {
      select: {
        alternativeTitles: true,
        categories: true,
        chapters: true,
      },
    },
    description: true,
    generationStatus: true,
    id: true,
    imageUrl: true,
    slug: true,
  } as const;

  const { data, error } = await safeAsync(() =>
    Promise.all([
      prisma.course.findFirst({
        select: courseSelect,
        where: {
          language: suggestion.language,
          organization: { slug: AI_ORG_SLUG },
          slug: normalizedSlug,
        },
      }),
      prisma.courseAlternativeTitle.findUnique({
        select: {
          course: {
            select: courseSelect,
          },
        },
        where: {
          languageSlug: { language: suggestion.language, slug: normalizedSlug },
        },
      }),
    ]),
  );

  if (error) {
    await streamStatus({ status: "error", step: "checkExistingCourse" });
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
