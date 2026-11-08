import "server-only";
import { readEntitlementViewer } from "../entitlements/_utils/entitlement-viewer";
import { getRequestInstant } from "../learner/facts/request-instant";
import { resolveViewGoal } from "../view-models/_utils/resolve-view-goal";
import {
  type ChapterNumbering,
  loadChapterNumbering,
} from "../view-models/syllabus/_utils/chapter-numbers";
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

type ListedRow = { number: ReturnType<ChapterNumbering>; planPosition: number };

/** As the syllabus numbers chapters, each subject's or the course's by number; the rest last. */
function toSyllabusPlace({ number, planPosition }: ListedRow): [number, number] {
  return number.syllabusOrder === null
    ? [Number.MAX_SAFE_INTEGER, planPosition]
    : [number.syllabusOrder, number.position];
}

function compareBySyllabus(first: ListedRow, second: ListedRow): number {
  const [firstSubject, firstChapter] = toSyllabusPlace(first);
  const [secondSubject, secondChapter] = toSyllabusPlace(second);

  return firstSubject - secondSubject || firstChapter - secondChapter;
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

  const listed = facts.flatMap((chapter) => {
    const number = numbering({ chapterId: chapter.chapterId, planPosition: chapter.position });
    const view = toChapterMindMapView({ facts: chapter, now, position: number.position });

    return isListed(view)
      ? [
          {
            number,
            planPosition: chapter.position,
            view: {
              ...view,
              subject: number.subject && { key: number.subject.key, name: number.subject.name },
            },
          },
        ]
      : [];
  });

  const chapters = listed.toSorted(compareBySyllabus).map((row) => row.view);

  return { mindMaps: { chapters, goal: { id: goal.id, title: goal.title } }, status: "ready" };
}
