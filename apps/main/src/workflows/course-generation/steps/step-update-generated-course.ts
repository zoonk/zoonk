import { prisma } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { normalizeString, toSlug } from "@zoonk/utils/string";

type ChapterInput = {
  title: string;
  description: string;
};

type UpdateGeneratedCourseParams = {
  courseId: number;
  locale: string;
  description: string;
  categories: string[];
  alternativeTitles: string[];
  chapters: ChapterInput[];
  thumbnailUrl: string | null;
};

export async function stepUpdateGeneratedCourse(
  params: UpdateGeneratedCourseParams,
) {
  "use step";

  const org = await prisma.organization.findUniqueOrThrow({
    where: { slug: AI_ORG_SLUG },
  });

  // Update the course with generated content and set status to completed
  const course = await prisma.course.update({
    data: {
      alternativeTitles: {
        createMany: {
          data: params.alternativeTitles.map((title) => ({
            locale: params.locale,
            slug: toSlug(title),
          })),
          skipDuplicates: true,
        },
      },
      categories: {
        createMany: {
          data: params.categories.map((category) => ({ category })),
        },
      },
      chapters: {
        createMany: {
          data: params.chapters.map((chapter, index) => ({
            description: chapter.description,
            isPublished: true,
            language: params.locale,
            lessonGenerationStatus: index === 0 ? "generating" : "pending",
            normalizedTitle: normalizeString(chapter.title),
            organizationId: org.id,
            position: index,
            slug: toSlug(chapter.title),
            title: chapter.title,
          })),
        },
      },
      description: params.description,
      generationStatus: "completed",
      imageUrl: params.thumbnailUrl,
      isPublished: true,
    },
    include: {
      chapters: { orderBy: { position: "asc" } },
    },
    where: { id: params.courseId },
  });

  return course;
}
