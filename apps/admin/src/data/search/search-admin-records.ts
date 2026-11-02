import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { getUserSearchWhere } from "@/data/users/_utils/user-search";
import { prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";
import { type Route } from "next";

const RESULTS_PER_KIND = 5;

type SearchItem = { detail: string; href: Route; label: string };

function resultGroup({ href, items, label }: { href: Route; items: SearchItem[]; label: string }) {
  if (items.length < RESULTS_PER_KIND) {
    return { items, label };
  }

  return {
    items: [...items, { detail: "", href, label: `All matching ${label.toLowerCase()}` }],
    label,
  };
}

export const searchAdminRecords = cacheAdminData(async (query: string) => {
  const normalizedTitle = { contains: normalizeString(query) };
  const params = new URLSearchParams({ search: query });

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
      include: { homeChapter: { select: { homeCourse: { select: { title: true } } } } },
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
    resultGroup({
      href: `/users?${params}`,
      items: users.map((user) => ({
        detail: user.name || user.username ? user.email : "",
        href: `/users/${user.id}` as const,
        label: user.name || user.username || user.email,
      })),
      label: "Users",
    }),
    resultGroup({
      href: `/courses?${params}`,
      items: courses.map((course) => ({
        detail: course.language,
        href: `/courses/${course.id}` as const,
        label: course.title,
      })),
      label: "Courses",
    }),
    resultGroup({
      href: `/lessons?${params}`,
      items: lessons.map((lesson) => ({
        detail: [lesson.homeChapter?.homeCourse?.title, lesson.language]
          .filter(Boolean)
          .join(" · "),
        href: `/lessons/${lesson.id}` as const,
        label: lesson.title,
      })),
      label: "Lessons",
    }),
    resultGroup({
      href: `/skills?${params}`,
      items: skills.map((skill) => ({
        detail: skill.language,
        href: `/skills/${skill.id}` as const,
        label: skill.name,
      })),
      label: "Skills",
    }),
  ];
});
