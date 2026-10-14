import "server-only";
import { type StudySessionBlock, type TransactionClient, prisma } from "@zoonk/db";

/** Current lesson durations for display; the persisted blocks retain their planned budget. */
export async function withLessonDisplayMinutes({
  blocks,
  client = prisma,
}: {
  blocks: readonly StudySessionBlock[];
  client?: TransactionClient;
}): Promise<StudySessionBlock[]> {
  const lessonIds = blocks.flatMap((block) =>
    block.kind === "learn" && block.lessonId ? [block.lessonId] : [],
  );

  if (lessonIds.length === 0) {
    return [...blocks];
  }

  const lessons = await client.lesson.findMany({
    select: { estimatedMinutes: true, id: true },
    where: { estimatedMinutes: { gt: 0 }, id: { in: lessonIds } },
  });

  const minutes = new Map(lessons.map((lesson) => [lesson.id, lesson.estimatedMinutes]));

  return blocks.map((block) => {
    const lessonMinutes = block.lessonId ? minutes.get(block.lessonId) : undefined;

    return lessonMinutes && block.kind === "learn"
      ? { ...block, estimatedMinutes: Math.max(1, Math.round(lessonMinutes)) }
      : block;
  });
}
