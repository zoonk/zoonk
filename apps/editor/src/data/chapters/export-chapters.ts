import "server-only";
import { getAuthorizedActiveCourse } from "@/data/courses/get-authorized-course";
import { getActiveChapterWhere, prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";

type ExportedChapter = {
  description: string;
  position: number;
  slug: string;
  title: string;
};

export async function exportChapters(params: { courseId: string; headers?: Headers }): Promise<
  SafeReturn<{
    chapters: ExportedChapter[];
    exportedAt: string;
    version: number;
  }>
> {
  const { data: course, error: courseError } = await getAuthorizedActiveCourse({
    courseId: params.courseId,
    headers: params.headers,
  });

  if (courseError) {
    return { data: null, error: courseError };
  }

  const { data: chapters, error: chaptersError } = await safeAsync(() =>
    prisma.chapter.findMany({
      orderBy: { position: "asc" },
      where: getActiveChapterWhere({
        chapterWhere: { courseId: course.id },
      }),
    }),
  );

  if (chaptersError) {
    return { data: null, error: chaptersError };
  }

  const exportedChapters: ExportedChapter[] = chapters.map((chapter) => ({
    description: chapter.description,
    position: chapter.position,
    slug: chapter.slug,
    title: chapter.title,
  }));

  return {
    data: {
      chapters: exportedChapters,
      exportedAt: new Date().toISOString(),
      version: 1,
    },
    error: null,
  };
}
