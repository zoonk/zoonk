import "server-only";
import { loadGoalMap } from "../view-models/_utils/goal-map";
import { resolveViewGoal } from "../view-models/_utils/resolve-view-goal";
import { loadChapterNumbering } from "../view-models/syllabus/_utils/chapter-numbers";
import { loadMindMapChapters } from "./_utils/load-mind-map-chapters";
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

/**
 * A goal's mind maps (the active goal by default): every chapter the learner finished, in plan
 * order, with its subject and its map (its picture and outline), being made, or ready to be made
 * with `POST .../mind-map/generations`. A finished chapter whose lessons were never written (one
 * skipped with its test) has nothing to draw a map from and isn't listed.
 */
export async function listGoalMindMaps(
  input: { goalId?: string } = {},
): Promise<GoalMindMapsResult> {
  "use cache: private";

  const resolved = await resolveViewGoal(input.goalId);

  if (resolved.status !== "ready") {
    return resolved;
  }

  const { goal } = resolved;
  const map = await loadGoalMap({ goal });

  const [facts, numbering] = await Promise.all([
    loadMindMapChapters({ goal, map }),
    loadChapterNumbering(goal),
  ]);

  const now = new Date();

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

  return { mindMaps: { chapters, goal: { id: goal.id, title: goal.title } }, status: "ready" };
}
