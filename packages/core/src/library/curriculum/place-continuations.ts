import "server-only";
import { type CourseLevel } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getCourseCurriculumCacheTag } from "../../cache/tags";
import { lockPlanSourceWrite, writePlanInputs } from "../_utils/plan-input-write";

const POSITION_OFFSET = 1_000_000;

type ContinuationMove = { afterChapterId: string; chapterId: string };

function orderWithContinuations({
  current,
  moves,
}: {
  current: readonly string[];
  moves: readonly ContinuationMove[];
}): string[] {
  const moved = new Set(moves.map((move) => move.chapterId));
  const rest = current.filter((chapterId) => !moved.has(chapterId));

  const placed = rest.flatMap((chapterId) => [
    chapterId,
    ...moves.filter((move) => move.afterChapterId === chapterId).map((move) => move.chapterId),
  ]);

  return [
    ...placed,
    ...current.filter((chapterId) => moved.has(chapterId) && !placed.includes(chapterId)),
  ];
}

/** Internal: the calling workflow must hold the course's outline claim. */
export async function placeContinuations({
  courseId,
  level,
  moves,
}: {
  courseId: string;
  level: CourseLevel;
  moves: readonly ContinuationMove[];
}): Promise<void> {
  const valid = moves.filter((move) => move.afterChapterId !== move.chapterId);

  if (valid.length === 0) {
    return;
  }

  await writePlanInputs(async (tx) => {
    const placements = await tx.courseChapter.findMany({
      orderBy: { position: "asc" },
      select: { chapterId: true },
      where: { courseId, level },
    });

    const current = placements.map((placement) => placement.chapterId);
    const order = orderWithContinuations({ current, moves: valid });
    const moved = order.filter((chapterId, index) => current[index] !== chapterId);

    if (moved.length === 0) {
      return;
    }

    await lockPlanSourceWrite(tx, { chapterIds: moved });

    await tx.courseChapter.updateMany({
      data: { position: { increment: POSITION_OFFSET } },
      where: { courseId, level },
    });

    await Promise.all(
      order.map((chapterId, position) =>
        tx.courseChapter.update({
          data: { position },
          where: { courseId_chapterId: { chapterId, courseId } },
        }),
      ),
    );
  });

  revalidateCacheTags([getCourseCurriculumCacheTag(courseId)]);
}
