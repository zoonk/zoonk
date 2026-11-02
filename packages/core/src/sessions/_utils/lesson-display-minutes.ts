import "server-only";
import { type StudySessionBlock, type TransactionClient, prisma } from "@zoonk/db";

/** Display durations may change; persisted blocks must retain their original planned budget. */
export async function withLessonDisplayMinutes<
  Block extends Pick<StudySessionBlock, "kind" | "lessonId" | "estimatedMinutes">,
>({
  blocks,
  client = prisma,
}: {
  blocks: readonly Block[];
  client?: TransactionClient;
}): Promise<Block[]> {
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
