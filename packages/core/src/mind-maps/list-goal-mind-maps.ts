import "server-only";
import { resolveViewGoal } from "../view-models/_utils/resolve-view-goal";
import { loadChapterNumbering } from "../view-models/syllabus/_utils/chapter-numbers";
import { loadMindMapChapters, loadUpNextChapter } from "./_utils/load-mind-map-chapters";
import { getMindMapStatus, toMindMapImage, toMindMapOutline } from "./_utils/mind-map-view";
import { type GoalMindMapView, type GoalMindMapsView } from "./mind-map-contract";

export type GoalMindMapsResult =
  | { mindMaps: GoalMindMapsView; status: "ready" }
  | { status: "noGoal" | "notFound" | "unauthorized" };

function isListed(
  status: ReturnType<typeof getMindMapStatus>,
): status is GoalMindMapView["status"] {
  return status !== "unavailable";
}

/** Read-only saved-plan list, defaulting to the active goal; excludes finished chapters with no written lessons. */
export async function listGoalMindMaps(
  input: { goalId?: string } = {},
): Promise<GoalMindMapsResult> {
  "use cache: private";

  const resolved = await resolveViewGoal(input.goalId);

  if (resolved.status !== "ready") {
    return resolved;
  }

  const { goal } = resolved;
  const now = new Date();

  const [facts, numbering, upNext] = await Promise.all([
    loadMindMapChapters({ goal }),
    loadChapterNumbering(goal),
    loadUpNextChapter(goal),
  ]);

  const nextTitle = facts.find((chapter) => chapter.chapterId === upNext?.chapterId)?.title;

  const chapters = facts.flatMap((chapter) => {
    const status = getMindMapStatus({ ...chapter, now });

    if (!isListed(status)) {
      return [];
    }

    const number = numbering({ chapterId: chapter.chapterId, planPosition: chapter.position });

    return [
      {
        chapterId: chapter.chapterId,
        image: status === "ready" ? toMindMapImage(chapter.row) : null,
        outline: status === "ready" ? toMindMapOutline(chapter.row?.structure) : null,
        position: number.position,
        status,
        subject: number.subject,
        title: chapter.title,
      },
    ];
  });

  const nextChapter =
    upNext && nextTitle !== undefined && upNext.lessonsLeft > 0
      ? { ...upNext, title: nextTitle }
      : null;

  return {
    mindMaps: { chapters, goal: { id: goal.id, title: goal.title }, nextChapter },
    status: "ready",
  };
}
