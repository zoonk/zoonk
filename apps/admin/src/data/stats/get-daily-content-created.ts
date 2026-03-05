import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";

export type DailyContentRow = {
  activities: number;
  chapters: number;
  courses: number;
  date: Date;
  lessons: number;
  steps: number;
};

export const getDailyContentCreated = cache(async (start: Date, end: Date) => {
  const results = await prisma.$queryRaw<{ date: Date; type: string; count: bigint }[]>`
    SELECT DATE(created_at) as date, 'courses' as type, COUNT(*) as count
    FROM courses
    WHERE created_at >= ${start} AND created_at <= ${end}
    GROUP BY DATE(created_at)

    UNION ALL

    SELECT DATE(created_at) as date, 'chapters' as type, COUNT(*) as count
    FROM chapters
    WHERE created_at >= ${start} AND created_at <= ${end}
    GROUP BY DATE(created_at)

    UNION ALL

    SELECT DATE(created_at) as date, 'lessons' as type, COUNT(*) as count
    FROM lessons
    WHERE created_at >= ${start} AND created_at <= ${end}
    GROUP BY DATE(created_at)

    UNION ALL

    SELECT DATE(created_at) as date, 'activities' as type, COUNT(*) as count
    FROM activities
    WHERE created_at >= ${start} AND created_at <= ${end}
    GROUP BY DATE(created_at)

    UNION ALL

    SELECT DATE(created_at) as date, 'steps' as type, COUNT(*) as count
    FROM steps
    WHERE created_at >= ${start} AND created_at <= ${end}
    GROUP BY DATE(created_at)

    ORDER BY date ASC
  `;

  const dateMap = new Map<string, DailyContentRow>();
  const contentTypes: readonly string[] = ["courses", "chapters", "lessons", "activities", "steps"];

  for (const row of results) {
    const key = row.date.toISOString().slice(0, 10);
    const existing = dateMap.get(key) ?? {
      activities: 0,
      chapters: 0,
      courses: 0,
      date: row.date,
      lessons: 0,
      steps: 0,
    };

    if (isContentType(row.type, contentTypes)) {
      existing[row.type] = Number(row.count);
    }

    dateMap.set(key, existing);
  }

  return [...dateMap.values()].toSorted((a, b) => a.date.getTime() - b.date.getTime());
});

function isContentType(
  value: string,
  types: readonly string[],
): value is keyof Omit<DailyContentRow, "date"> {
  return types.includes(value);
}
