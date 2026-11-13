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
> & { chapters: MindMapsPageChapter[]; goal: Pick<GoalMindMapsView["goal"], "displayName" | "id"> };

export function toMindMapsPage(mindMaps: GoalMindMapsView): MindMapsPage {
  const { chapters, createOffer, firstTab, goal, lessonGroups, saved } = mindMaps;

  return {
    chapters: chapters.map(({ image, outline: _outline, ...chapter }) => ({
      ...chapter,
      thumbnailUrl: image?.thumbnailUrl ?? null,
    })),
    createOffer,
    firstTab,
    goal: { displayName: goal.displayName, id: goal.id },
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
  // No plan keeps a map for subscribers any more; installed native apps still decode the status.
  const open = chapters.filter((chapter) => chapter.status !== "plusRequired");

  return {
    /**
     * Only the failed maps creating all chapter maps retries. One whose chapter still needs its
     * lessons shows in its own row, with that row's Try again.
     */
    failed: open.filter((chapter) => chapter.status === "failed" && chapter.lessonsToWrite === 0)
      .length,
    onTheWay: open.filter(
      (chapter) => chapter.status === "drawing" || chapter.status === "writingLessons",
    ).length,
    ready: open.filter((chapter) => chapter.status === "ready").length,
    total: open.length,
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

/** Nothing can start now, not even a failed map's free retry: the page says why. */
export function startsNoMap({ startable, stop }: MindMapCreateOffer): boolean {
  return startable === 0 && stop !== null;
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
    const resetsAt = stop.resetsAt ? Date.parse(stop.resetsAt) : now;
    const retryAfterSeconds = Math.max(0, Math.ceil((resetsAt - now) / MS_PER_SECOND));
    return { retryAfterSeconds, status: "slowDown" };
  }

  return {
    period: stop.period ?? "day",
    resource: stop.resource ?? undefined,
    status: "limitReached",
    tier,
  };
}
