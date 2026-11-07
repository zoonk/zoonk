import "server-only";
import { readEntitlementViewer } from "../entitlements/_utils/entitlement-viewer";
import { getRequestInstant } from "../learner/facts/request-instant";
import { resolveViewGoal } from "../view-models/_utils/resolve-view-goal";
import { loadChapterNumbering } from "../view-models/syllabus/_utils/chapter-numbers";
import { loadMindMapChapters } from "./_utils/load-mind-map-chapters";
import { toChapterMindMapView } from "./_utils/mind-map-view";
import { type GoalMindMapView, type GoalMindMapsView } from "./mind-map-contract";

export type GoalMindMapsResult =
  | { mindMaps: GoalMindMapsView; status: "ready" }
  | { status: "noGoal" | "notFound" | "unauthorized" };

function isListed(
  view: ReturnType<typeof toChapterMindMapView>,
): view is Omit<GoalMindMapView, "subject"> {
  return view.status !== "unavailable";
}

/** Read-only saved-plan list, defaulting to the active goal: every chapter that can have a map. */
export async function listGoalMindMaps(
  input: { goalId?: string } = {},
): Promise<GoalMindMapsResult> {
  "use cache: private";

  const resolved = await resolveViewGoal(input.goalId);

  if (resolved.status !== "ready") {
    return resolved;
  }

  const { goal } = resolved;

  const [facts, numbering, now] = await Promise.all([
    loadMindMapChapters({ goal, readViewer: readEntitlementViewer }),
    loadChapterNumbering(goal),
    getRequestInstant(),
  ]);

  const chapters = facts.flatMap((chapter) => {
    const number = numbering({ chapterId: chapter.chapterId, planPosition: chapter.position });
    const view = toChapterMindMapView({ facts: chapter, now, position: number.position });

    return isListed(view) ? [{ ...view, subject: number.subject }] : [];
  });

  return { mindMaps: { chapters, goal: { id: goal.id, title: goal.title } }, status: "ready" };
}
