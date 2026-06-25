import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

export type DailyContentRow = {
  chapters: number;
  courses: number;
  date: Date;
  lessons: number;
  steps: number;
};

export const getDailyContentCreated = cacheAdminData(async (start: Date, end: Date) => {
  const results = await prisma.$queryRaw<{ date: Date; type: string; count: bigint }[]>`
    SELECT DATE(created_at) as date, 'courses' as type, COUNT(*) as count
    FROM courses
    WHERE created_at >= ${start} AND created_at <= ${end}
    GROUP BY DATE(created_at)

    UNION ALL

    SELECT DATE(created_at) as date, 'chapters' as type, COUNT(*) as count
    FROM chapters
    WHERE created_at >= ${start} AND created_at <= ${end} AND generation_status = 'completed'
    GROUP BY DATE(created_at)

    UNION ALL

    SELECT DATE(lessons.created_at) as date, 'lessons' as type, COUNT(*) as count
    FROM lessons
    JOIN chapters ON chapters.id = lessons.chapter_id
    WHERE
      lessons.created_at >= ${start}
      AND lessons.created_at <= ${end}
      AND lessons.generation_status = 'completed'
      AND chapters.generation_status = 'completed'
    GROUP BY DATE(lessons.created_at)

    UNION ALL

    SELECT DATE(created_at) as date, 'steps' as type, COUNT(*) as count
    FROM steps
    WHERE created_at >= ${start} AND created_at <= ${end}
    GROUP BY DATE(created_at)

    ORDER BY date ASC
  `;

  const dateMap = new Map<string, DailyContentRow>();
  const contentTypes: readonly string[] = ["courses", "chapters", "lessons", "steps"];

  for (const row of results) {
    const key = row.date.toISOString().slice(0, 10);

    const existing = dateMap.get(key) ?? {
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
