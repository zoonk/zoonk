import "server-only";
import { type CourseLevel, prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getCourseCurriculumCacheTag } from "../../cache/tags";

/** Moves a band's placements out of the way first, so the new order never collides with the old. */
const POSITION_OFFSET = 1_000_000;

/** A continuation and the chapter it goes right after. */
type ContinuationMove = { afterChapterId: string; chapterId: string };

/** The band's chapters in order with each continuation right after the chapter it continues. */
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

  // A continuation whose chapter left the band keeps its place at the end.
  return [
    ...placed,
    ...current.filter((chapterId) => moved.has(chapterId) && !placed.includes(chapterId)),
  ];
}

/**
 * Puts each continuation right after the chapter it continues, inside its band, so the course
 * reads in teaching order: a skill's chapters together, and what builds on them after. Positions
 * are unique in a band, so one transaction moves the band out of the way and writes the new order.
 *
 * This is a workflow bridge: the calling run holds the course's outline claim.
 */
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

  await prisma.$transaction(async (tx) => {
    const placements = await tx.courseChapter.findMany({
      orderBy: { position: "asc" },
      select: { chapterId: true },
      where: { courseId, level },
    });

    const order = orderWithContinuations({
      current: placements.map((placement) => placement.chapterId),
      moves: valid,
    });

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
