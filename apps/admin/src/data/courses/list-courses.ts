import "server-only";
import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";

export async function listCourses(params: { limit: number; offset: number; search?: string }) {
  const session = await getSession();

  if (session?.user.role !== "admin") {
    return { courses: [], total: 0 };
  }

  const { limit, offset, search } = params;

  const where = search
    ? { normalizedTitle: { contains: search, mode: "insensitive" as const } }
    : undefined;

  const [courses, total] = await Promise.all([
    prisma.course.findMany({
      include: { organization: true },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
      where,
    }),
    prisma.course.count({ where }),
  ]);

  return { courses, total };
}
