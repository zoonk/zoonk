import {
  type GoalMindMapView,
  type GoalMindMapsView,
  type MindMapAllowanceStop,
  type MindMapCreateOffer,
} from "@zoonk/core/mind-maps/contract";
import { type MindMapLimit } from "../../_components/help-limit-notice";
import { type MindMapTab } from "./mind-map-urls";

const MS_PER_SECOND = 1000;

/** A chapter as the page draws it: its outline and full picture stay on the server. */
export type MindMapsPageChapter = Omit<GoalMindMapView, "image" | "outline"> & {
  /** Null for a map without a picture: one not made yet, or one that reads as text. */
  thumbnailUrl: string | null;
};

export type MindMapsPage = Pick<
  GoalMindMapsView,
  "createOffer" | "firstTab" | "lessonGroups" | "saved"
> & { chapters: MindMapsPageChapter[]; goal: Pick<GoalMindMapsView["goal"], "id"> };

export function toMindMapsPage(mindMaps: GoalMindMapsView): MindMapsPage {
  const { chapters, createOffer, firstTab, goal, lessonGroups, saved } = mindMaps;

  return {
    chapters: chapters.map(({ image, outline: _outline, ...chapter }) => ({
      ...chapter,
      thumbnailUrl: image?.thumbnailUrl ?? null,
    })),
    createOffer,
    firstTab,
    goal: { id: goal.id },
    lessonGroups,
    saved,
  };
}

/** A map the learner can open: what the list of maps shows. */
function isIndexed(chapter: MindMapsPageChapter): boolean {
  return chapter.status === "ready";
}

export function splitChapters(chapters: readonly MindMapsPageChapter[]) {
  return {
    index: chapters.filter((chapter) => isIndexed(chapter)),
    notMade: chapters.filter((chapter) => !isIndexed(chapter)),
  };
}

export function countChapterMaps(chapters: readonly MindMapsPageChapter[]) {
  return {
    onTheWay: chapters.filter(
      (chapter) => chapter.status === "drawing" || chapter.status === "writingLessons",
    ).length,
    ready: chapters.filter((chapter) => chapter.status === "ready").length,
    total: chapters.length,
  };
}

export function countTabs(page: MindMapsPage): Record<MindMapTab, number> {
  return {
    chapters: countChapterMaps(page.chapters).ready,
    lessons: page.lessonGroups.reduce((total, group) => total + group.count, 0),
    saved: page.saved.length,
  };
}

export type IndexGroup<Row> = { key: string; name: string | null; rows: Row[] };

export function groupBySubject<Row extends { subject: GoalMindMapView["subject"] }>(
  rows: readonly Row[],
): IndexGroup<Row>[] {
  const groups = Map.groupBy(rows, (row) => row.subject?.key ?? "");

  return [...groups.entries()].map(([key, grouped]) => ({
    key,
    name: grouped[0]?.subject?.name ?? null,
    rows: grouped,
  }));
}

const OPEN_ROWS = 12;

export const PREVIEW_ROWS = 8;

/**
 * A list stays a page long: every row while there are few, then each subject folded to its name,
 * or a first few rows with the rest on demand when the goal has no subjects.
 */
export function getIndexLayout<Row>(groups: readonly IndexGroup<Row>[]) {
  const rows = groups.reduce((total, group) => total + group.rows.length, 0);

  if (rows <= OPEN_ROWS) {
    return "open" as const;
  }

  return groups.some((group) => group.name !== null) ? ("folded" as const) : ("preview" as const);
}

/** A map on its way, or one that didn't finish: its row comes first, so it's in sight. */
export function needsAttention(chapter: MindMapsPageChapter): boolean {
  return (
    chapter.status === "drawing" ||
    chapter.status === "writingLessons" ||
    chapter.status === "failed"
  );
}

/** A chapter whose lessons are all written: its map is made, or being made, without writing any. */
function canMakeNow(chapter: MindMapsPageChapter): boolean {
  return (
    chapter.lessonsToWrite === 0 &&
    (chapter.status === "available" || chapter.status === "drawing" || chapter.status === "failed")
  );
}

/** The chapters shown before any fold: the ones the learner most likely wants next. */
const NEXT_ROWS = 5;

/** A few more than the first rows aren't worth folding away. */
const FOLD_AFTER = NEXT_ROWS + 2;

function nextRank(chapter: MindMapsPageChapter, studied: ReadonlySet<string>): number {
  if (needsAttention(chapter)) {
    return 0;
  }

  if (canMakeNow(chapter)) {
    return 1;
  }

  return studied.has(chapter.chapterId) ? 2 : 3;
}

/**
 * Maps on their way or failed first, then chapters whose lessons are all written (made in half a
 * minute), then chapters the learner finished a lesson in, then the rest; syllabus order within each.
 */
export function orderNotMade({
  chapters,
  studied,
}: {
  chapters: readonly MindMapsPageChapter[];
  studied: ReadonlySet<string>;
}) {
  const ordered = chapters.toSorted((a, b) => nextRank(a, studied) - nextRank(b, studied));

  if (ordered.length <= FOLD_AFTER) {
    return { next: ordered, rest: [] };
  }

  const next = ordered.slice(0, NEXT_ROWS);
  const rest = chapters.filter((chapter) => !next.includes(chapter));

  return { next, rest };
}

/** Nothing can start now, not even a failed map's free retry: the page says why. */
export function startsNoMap({ startable, stop }: MindMapCreateOffer): boolean {
  return startable === 0 && stop !== null;
}

/** A row's refusal that every other row would get too: the maps or the day's AI spend ran out, or a guest needs an account. */
export function toPageStop(limit: MindMapLimit): MindMapAllowanceStop | null {
  if (limit.status === "signUpRequired") {
    return { availableAt: null, period: null, reason: "signUpRequired", resource: null };
  }

  if (
    limit.status !== "limitReached" ||
    (limit.resource !== "mindMap" && limit.resource !== "aiSpend")
  ) {
    return null;
  }

  return {
    availableAt: limit.period === "rolling30Days" ? limit.availableAt : null,
    period: limit.period ?? "day",
    reason: "limitReached",
    resource: limit.resource,
  };
}

export function toMindMapLimit({
  now,
  stop,
  tier,
}: {
  now: number;
  stop: MindMapAllowanceStop;
  tier: Extract<MindMapLimit, { status: "limitReached" }>["tier"];
}): MindMapLimit {
  if (stop.reason === "signUpRequired") {
    return { status: "signUpRequired" };
  }

  if (stop.reason === "slowDown") {
    const retryAt = stop.availableAt ? Date.parse(stop.availableAt) : now;
    const retryAfterSeconds = Math.max(0, Math.ceil((retryAt - now) / MS_PER_SECOND));
    return { retryAfterSeconds, status: "slowDown" };
  }

  const resource = stop.resource ?? undefined;

  return stop.period === "rolling30Days"
    ? { availableAt: stop.availableAt, period: stop.period, resource, status: "limitReached", tier }
    : { period: stop.period ?? "day", resource, status: "limitReached", tier };
}
