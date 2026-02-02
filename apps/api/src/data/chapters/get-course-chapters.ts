import "server-only";
import { prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";

export async function getCourseChapters(courseId: number): Promise<
  SafeReturn<
    {
      id: number;
      slug: string;
      title: string;
      description: string;
      position: number;
    }[]
  >
> {
  return safeAsync(() =>
    prisma.chapter.findMany({
      orderBy: { position: "asc" },
      select: {
        description: true,
        id: true,
        position: true,
        slug: true,
        title: true,
      },
      where: { courseId },
    }),
  );
}
