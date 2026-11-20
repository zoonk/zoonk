import { type TransactionClient } from "@zoonk/db";
import { getContentLocale } from "@zoonk/utils/locale";

export type CourseGoalLookup = {
  language?: string;
  primaryCourseId?: string;
  sourceCourseId: string;
};

export function findCourseGoal(
  db: TransactionClient,
  { language, primaryCourseId, sourceCourseId, userId }: CourseGoalLookup & { userId: string },
) {
  const locale = language && getContentLocale(language);

  return db.goal.findFirst({
    orderBy: { createdAt: "desc" },
    select: { id: true },
    where: {
      AND: locale
        ? [
            {
              OR: [
                { language: { equals: locale, mode: "insensitive" } },
                { language: { mode: "insensitive", startsWith: `${locale}-` } },
              ],
            },
          ]
        : [{ language }],
      OR: [
        ...(primaryCourseId ? [{ primaryCourseId }] : []),
        ...(language
          ? [{ details: { equals: sourceCourseId, path: ["courseStartSourceId"] } }]
          : []),
      ],
      kind: { not: "explain" },
      status: "active",
      userId,
    },
  });
}
