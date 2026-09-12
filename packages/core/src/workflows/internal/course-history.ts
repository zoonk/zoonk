import { type TransactionClient } from "@zoonk/db";

/** Historical activity stays meaningful after presentation rows disappear; no source content is copied. */
export async function snapshotCourseHistory({
  courseId,
  transaction,
}: {
  courseId: string;
  transaction: TransactionClient;
}) {
  await transaction.$executeRaw`
    UPDATE lesson_progress p SET content_snapshot = COALESCE(p.content_snapshot,
      jsonb_build_object('courseId', c.id, 'courseTitle', c.title, 'courseSlug', c.slug,
        'chapterId', ch.id, 'chapterTitle', ch.title, 'lessonId', l.id, 'lessonTitle', l.title, 'lessonKind', l.kind))
    FROM lessons l JOIN chapters ch ON ch.id = l.chapter_id JOIN courses c ON c.id = ch.course_id
    WHERE p.lesson_id = l.id AND c.id = ${courseId}::uuid
  `;

  await transaction.$executeRaw`
    UPDATE step_attempts a SET content_snapshot = COALESCE(a.content_snapshot,
      jsonb_build_object('courseId', c.id, 'courseTitle', c.title, 'chapterTitle', ch.title,
        'lessonId', l.id, 'lessonTitle', l.title, 'stepId', s.id, 'stepKind', s.kind))
    FROM steps s JOIN lessons l ON l.id = s.lesson_id JOIN chapters ch ON ch.id = l.chapter_id JOIN courses c ON c.id = ch.course_id
    WHERE a.step_id = s.id AND c.id = ${courseId}::uuid
  `;

  await transaction.$executeRaw`
    UPDATE chapter_completions p SET content_snapshot = COALESCE(p.content_snapshot,
      jsonb_build_object('courseId', c.id, 'courseTitle', c.title, 'chapterId', ch.id, 'chapterTitle', ch.title))
    FROM chapters ch JOIN courses c ON c.id = ch.course_id
    WHERE p.chapter_id = ch.id AND c.id = ${courseId}::uuid
  `;

  await transaction.$executeRaw`
    UPDATE course_completions p SET content_snapshot = COALESCE(p.content_snapshot,
      jsonb_build_object('courseId', c.id, 'courseTitle', c.title, 'contentRevision', c.content_revision))
    FROM courses c WHERE p.course_id = c.id AND c.id = ${courseId}::uuid
  `;
}
