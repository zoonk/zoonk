import "server-only";
import { readEntitlementViewer } from "../entitlements/_utils/entitlement-viewer";
import { readUsageLedger } from "../entitlements/bundle-claims";
import { getRequestInstant } from "../learner/facts/request-instant";
import { readSavedMindMaps } from "../learner/facts/saved-mind-maps";
import { resolveViewGoal } from "../view-models/_utils/resolve-view-goal";
import { loadChapterNumbering } from "../view-models/syllabus/_utils/chapter-numbers";
import { chapterMapClaims, offerChapterMaps, sortBulkChapters } from "./_utils/bulk-chapters";
import { loadMindMapChapters } from "./_utils/load-mind-map-chapters";
import { toChapterMindMapView } from "./_utils/mind-map-view";
import { toSavedKey, toSavedKeys, toSavedMindMaps } from "./_utils/saved-mind-map-views";
import { type ScopeLessonMap, loadScopeLessonMaps } from "./_utils/scope-lesson-maps";
import { sortBySyllabus } from "./_utils/syllabus-order";
import {
  type GoalMindMapView,
  type GoalMindMapsView,
  type LessonMapGroup,
} from "./mind-map-contract";

export type GoalMindMapsResult =
  | { mindMaps: GoalMindMapsView; status: "ready" }
  | { status: "noGoal" | "notFound" | "unauthorized" };

function isListed(
  view: ReturnType<typeof toChapterMindMapView>,
): view is Omit<GoalMindMapView, "subject"> {
  return view.status !== "unavailable";
}

/**
 * A lesson two chapters share stays under the first, in course order, so the Lessons tab, its deck
 * and Saved list it once. `lessonMaps` keeps the chapters' order.
 */
function listEachLessonOnce(
  lessonMaps: ReadonlyMap<string, ScopeLessonMap[]>,
): Map<string, ScopeLessonMap[]> {
  const placements = Map.groupBy([...lessonMaps.values()].flat(), (map) => map.lessonId);

  return new Map(
    [...lessonMaps].map(([chapterId, maps]) => [
      chapterId,
      maps.filter((map) => placements.get(map.lessonId)?.[0]?.chapterId === chapterId),
    ]),
  );
}

function toLessonGroups({
  chapters,
  lessonMaps,
}: {
  chapters: readonly GoalMindMapView[];
  lessonMaps: ReadonlyMap<string, ScopeLessonMap[]>;
}): LessonMapGroup[] {
  return chapters.flatMap(({ chapterId }) => {
    const maps = lessonMaps.get(chapterId) ?? [];

    const open = maps.filter((map) => !map.locked).map((map) => map.lessonId);

    return maps.length > 0
      ? [{ chapterId, count: maps.length, lessonIds: open, locked: maps.length - open.length }]
      : [];
  });
}

function chooseFirstTab({
  chapters,
  lessonGroups,
}: {
  chapters: readonly GoalMindMapView[];
  lessonGroups: readonly LessonMapGroup[];
}): GoalMindMapsView["firstTab"] {
  if (chapters.some((chapter) => chapter.status === "ready")) {
    return "chapters";
  }

  return lessonGroups.some((group) => group.count > group.locked) ? "lessons" : "chapters";
}

/**
 * Read-only list for the goal's Mind maps page, defaulting to the active goal: every chapter of its
 * scope that can have a map, its lesson maps by chapter, its saved maps, and what making all the
 * chapter maps at once would start.
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

  const [facts, numbering, now, savedRows, viewer] = await Promise.all([
    loadMindMapChapters({ goal, readViewer: readEntitlementViewer }),
    loadChapterNumbering(goal),
    getRequestInstant(),
    readSavedMindMaps(goal.userId),
    readEntitlementViewer(),
  ]);

  const savedKeys = toSavedKeys(savedRows);

  const listed = sortBySyllabus({ chapters: facts, numbering }).flatMap(({ chapter, number }) => {
    const view = toChapterMindMapView({
      facts: chapter,
      now,
      position: number.position,
      saved: savedKeys.has(toSavedKey({ kind: "chapter", targetId: chapter.chapterId })),
    });

    return isListed(view)
      ? [
          {
            facts: chapter,
            view: {
              ...view,
              subject: number.subject && { key: number.subject.key, name: number.subject.name },
            },
          },
        ]
      : [];
  });

  const chapters = listed.map((row) => row.view);
  const bulk = sortBulkChapters(chapters);

  const [scopeLessonMaps, ledger] = await Promise.all([
    loadScopeLessonMaps({ chapters: listed.map((row) => row.facts), userId: goal.userId }),
    viewer &&
      readUsageLedger({
        claims: bulk.eligible.flatMap((chapterId) =>
          chapterMapClaims({ chapterId, lessonIds: [] }),
        ),
        now,
        viewer,
      }),
  ]);

  const lessonMaps = listEachLessonOnce(scopeLessonMaps);
  const lessonGroups = toLessonGroups({ chapters, lessonMaps });

  return {
    mindMaps: {
      chapters,
      createOffer: offerChapterMaps({ chapters, ledger }),
      firstTab: chooseFirstTab({ chapters, lessonGroups }),
      goal: { displayName: goal.displayName, id: goal.id, title: goal.title },
      lessonGroups,
      saved: toSavedMindMaps({ chapters, facts, goalId: goal.id, lessonMaps, savedRows }),
    },
    status: "ready",
  };
}
