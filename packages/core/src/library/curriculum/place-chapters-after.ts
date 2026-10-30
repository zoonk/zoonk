import "server-only";
import { type CourseLevel } from "@zoonk/db";
import { revalidateCourseContent } from "../../cache/revalidate-course-content";
import { getCourseCurriculumCacheTag } from "../../cache/tags";
import { lockPlanSourceWrite, writePlanInputs } from "../_utils/plan-input-write";

const POSITION_OFFSET = 1_000_000;

/** A null `afterChapterId` puts the chapter first. */
type ChapterMove = { afterChapterId: string | null; chapterId: string };

function orderWithMoves({
  current,
  moves,
}: {
  current: readonly string[];
  moves: readonly ChapterMove[];
}): string[] {
  const moved = new Set(moves.map((move) => move.chapterId));
  const rest = current.filter((chapterId) => !moved.has(chapterId));

  const following = (afterChapterId: string | null) =>
    moves.filter((move) => move.afterChapterId === afterChapterId).map((move) => move.chapterId);

  const placed = [
    ...following(null),
    ...rest.flatMap((chapterId) => [chapterId, ...following(chapterId)]),
  ];

  return [
    ...placed,
    ...current.filter((chapterId) => moved.has(chapterId) && !placed.includes(chapterId)),
  ];
}

/** Internal: the calling workflow must hold the course's outline claim. */
export async function placeChaptersAfter({
  courseId,
  level,
  moves,
}: {
  courseId: string;
  level: CourseLevel;
  moves: readonly ChapterMove[];
}): Promise<void> {
  const valid = moves.filter((move) => move.afterChapterId !== move.chapterId);

  if (valid.length === 0) {
    return;
  }

  const reordered = await writePlanInputs(async (tx) => {
    const placements = await tx.courseChapter.findMany({
      orderBy: { position: "asc" },
      select: { chapterId: true },
      where: { courseId, level },
    });

    const current = placements.map((placement) => placement.chapterId);
    const order = orderWithMoves({ current, moves: valid });
    const moved = order.filter((chapterId, index) => current[index] !== chapterId);

    if (moved.length === 0) {
      return false;
    }

    await lockPlanSourceWrite(tx, { chapterIds: moved });

    await tx.courseChapter.updateMany({
      data: { position: { increment: POSITION_OFFSET } },
      where: { courseId, level },
    });

    for (const [position, chapterId] of order.entries()) {
      // oxlint-disable-next-line no-await-in-loop -- An interactive transaction uses one Postgres connection.
      await tx.courseChapter.update({
        data: { position },
        where: { courseId_chapterId: { chapterId, courseId } },
      });
    }

    return true;
  });

  if (reordered) {
    await revalidateCourseContent([getCourseCurriculumCacheTag(courseId)]);
  }
}
