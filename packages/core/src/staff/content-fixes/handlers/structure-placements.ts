import { sql } from "@zoonk/db";
import { CourseLevel } from "@zoonk/db/enums";
import { z } from "zod";
import { attachChapterToCourseInTransaction } from "../../../library/chapters/attach-course-chapter";
import { placeChapterLessonsInTransaction } from "../../../library/lessons/place-chapter-lessons";
import { collectionHandler, collectionIds, sharedProblem } from "./collection-handler";
import { idSchema } from "./fix-handler";

const rules =
  "Every child exists, is public with no owner and shares the language and target language; positions come from the order. No identity, address or learner history changes. Plans refresh at the next planning write.";

const chaptersSchema = z
  .array(
    z.strictObject({
      area: z.string().nullable(),
      chapterId: idSchema,
      level: z.enum(CourseLevel),
    }),
  )
  .min(1);

export const courseChapters = collectionHandler({
  load: async (db, id, value) => {
    const after = chaptersSchema.parse(value);

    const [row, chapters] = await Promise.all([
      db.course.findUnique({
        include: { courseChapters: { orderBy: [{ level: "asc" }, { position: "asc" }] } },
        where: { id },
      }),
      db.chapter.findMany({ where: { id: { in: after.map((chapter) => chapter.chapterId) } } }),
    ]);

    if (!row) {
      return null;
    }

    return {
      before: row.courseChapters.map(({ area, chapterId, level }) => ({ area, chapterId, level })),
      problem: sharedProblem(
        { ...row, ownerId: row.userId },
        chapters,
        after.map((chapter) => chapter.chapterId),
      ),
      roots: {
        chapterIds: [
          ...new Set([
            ...row.courseChapters.map((chapter) => chapter.chapterId),
            ...after.map((chapter) => chapter.chapterId),
          ]),
        ],
        courseIds: [id],
      },
      unit: { id, kind: "course" },
    };
  },
  model: "Course",
  op: "setChapters",
  rules: `setChapters: [{ chapterId, level, area }], the course's final chapters in order. ${rules}`,
  schema: chaptersSchema,
  table: sql`courses`,
  write: async (tx, id, value) => {
    const chapters = chaptersSchema.parse(value);

    await tx.courseChapter.deleteMany({
      where: { chapterId: { notIn: chapters.map((chapter) => chapter.chapterId) }, courseId: id },
    });

    await tx.$executeRaw`
      WITH temporary AS (
        SELECT chapter_id,
          (LEAST(MIN(position) OVER (), 0) - ROW_NUMBER() OVER (ORDER BY chapter_id))::int AS position
        FROM course_chapters WHERE course_id = ${id}::uuid
      )
      UPDATE course_chapters AS placement SET position = temporary.position
      FROM temporary WHERE placement.course_id = ${id}::uuid AND placement.chapter_id = temporary.chapter_id
    `;

    const positions = new Map<string, number>();

    for (const chapter of chapters) {
      const position = positions.get(chapter.level) ?? 0;
      // oxlint-disable-next-line no-await-in-loop -- ordered placements share the approval transaction
      await attachChapterToCourseInTransaction(tx, { ...chapter, courseId: id, position });
      positions.set(chapter.level, position + 1);
    }
  },
});

export const chapterLessons = collectionHandler({
  load: async (db, id, value) => {
    const after = collectionIds.parse(value);

    const [row, lessons] = await Promise.all([
      db.chapter.findUnique({
        include: { lessons: { orderBy: { position: "asc" } } },
        where: { id },
      }),
      db.lesson.findMany({ where: { id: { in: after } } }),
    ]);

    const orphan =
      row &&
      (await db.lesson.findFirst({
        where: {
          chapters: { none: { chapterId: { not: id } } },
          id: { in: row.lessons.map((lesson) => lesson.lessonId), notIn: after },
          skills: { some: {} },
        },
      }));

    return (
      row && {
        before: row.lessons.map((lesson) => lesson.lessonId),
        effects: row.lessons
          .filter((lesson) => !after.includes(lesson.lessonId))
          .map((lesson) => ({ id: lesson.lessonId, kind: "structureAddressKept" as const })),
        problem: orphan
          ? `Lesson ${orphan.id} still teaches skills and has no other chapter. Use Lesson.setSkills before removing it.`
          : sharedProblem(row, lessons, after),
        roots: {
          chapterIds: [id],
          lessonIds: [...new Set([...after, ...row.lessons.map((lesson) => lesson.lessonId)])],
        },
        unit: { id, kind: "chapter" },
      }
    );
  },
  model: "Chapter",
  op: "setLessons",
  rules: `setLessons: [lessonId, …], the chapter's final lessons in order. ${rules} A chapter keeps at least one lesson. A move adds the lesson to its new chapter before proposing its removal. A lesson leaving its home chapter keeps its address.`,
  schema: collectionIds.min(1),
  table: sql`library_chapters`,
  write: (tx, id, value) =>
    placeChapterLessonsInTransaction(tx, { chapterId: id, lessonIds: collectionIds.parse(value) }),
});
