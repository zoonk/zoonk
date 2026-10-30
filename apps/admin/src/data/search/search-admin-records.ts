import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { getUserSearchWhere } from "@/data/users/_utils/user-search";
import { prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";

const RESULTS_PER_KIND = 5;

export const searchAdminRecords = cacheAdminData(async (query: string) => {
  const normalizedTitle = { contains: normalizeString(query) };

  const [users, courses, lessons, skills] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: RESULTS_PER_KIND,
      where: getUserSearchWhere({ search: query }),
    }),
    prisma.course.findMany({
      omit: { landingPage: true },
      orderBy: [{ title: "asc" }, { id: "asc" }],
      take: RESULTS_PER_KIND,
      where: { normalizedTitle },
    }),
    prisma.lesson.findMany({
      omit: { spec: true, summary: true },
      orderBy: [{ title: "asc" }, { id: "asc" }],
      take: RESULTS_PER_KIND,
      where: { normalizedTitle },
    }),
    prisma.skill.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: RESULTS_PER_KIND,
      where: { mergedIntoId: null, normalizedName: { contains: normalizeString(query) } },
    }),
  ]);

  return [
    {
      items: users.map((user) => ({
        detail: user.email,
        href: `/users/${user.id}` as const,
        label: user.name || user.username || user.email,
      })),
      label: "Users",
    },
    {
      items: courses.map((course) => ({
        detail: course.language,
        href: `/courses/${course.id}` as const,
        label: course.title,
      })),
      label: "Courses",
    },
    {
      items: lessons.map((lesson) => ({
        detail: lesson.language,
        href: `/lessons/${lesson.id}` as const,
        label: lesson.title,
      })),
      label: "Lessons",
    },
    {
      items: skills.map((skill) => ({
        detail: skill.language,
        href: `/skills/${skill.id}` as const,
        label: skill.name,
      })),
      label: "Skills",
    },
  ];
});
