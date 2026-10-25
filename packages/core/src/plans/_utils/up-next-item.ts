import { type PlanItem } from "@zoonk/db";
import { isWritingItem } from "./plan-phase-views";

/** Lessons and chapters are what a plan teaches; challenges, mocks and reviews come around them. */
const LEARN_KINDS = new Set<PlanItem["kind"]>(["chapter", "lesson"]);

export type UpNextCandidate = Pick<PlanItem, "chapterId" | "kind" | "lessonId" | "status"> & {
  id: string | null;
};

/** A learn block of today's session not done yet, as Today opens it (`loadTodayLearnBlocks`). */
export type TodayLearnBlock = { lessonId: string | null; planItemId: string | null };

/**
 * The next thing to do, from the first item to do and the first one that isn't a stand-in. A
 * stand-in waiting for lessons the Library hasn't outlined yet doesn't hold the plan back while
 * written lessons come after it: the learner is already doing those. An event after stand-ins (a
 * mock, a checkpoint) does wait for them: it comes after their lessons, so the plan is still at
 * the stand-ins, such as day 1 of a test days away whose lessons are being written.
 */
function chooseNextItem<Item extends Pick<PlanItem, "kind">>({
  first,
  written,
  writtenIsLater,
}: {
  first: Item | undefined;
  written: Item | undefined;
  /** Stand-ins come before the written item. */
  writtenIsLater: boolean;
}): Item | undefined {
  return written && (!writtenIsLater || written.kind === "lesson") ? written : first;
}

/** The next thing to do in plan order (see `chooseNextItem`). */
function findNextItem<Item extends Omit<UpNextCandidate, "id">>(
  items: readonly Item[],
): Item | undefined {
  const todo = items.filter((item) => item.status === "todo");
  const [first] = todo;
  const written = todo.find((item) => !isWritingItem(item));

  return chooseNextItem({ first, written, writtenIsLater: written !== first });
}

/** The unfinished plan lessons today's saved session holds, in its block order. */
export function listTodayItems<Item extends UpNextCandidate>({
  items,
  todayBlocks,
}: {
  items: readonly Item[];
  todayBlocks: readonly TodayLearnBlock[];
}): Item[] {
  const todo = items.filter((item) => LEARN_KINDS.has(item.kind) && item.status === "todo");

  return todayBlocks.flatMap((block) => {
    const item =
      todo.find((candidate) => block.planItemId !== null && candidate.id === block.planItemId) ??
      todo.find((candidate) => block.lessonId !== null && candidate.lessonId === block.lessonId);

    return item ? [item] : [];
  });
}

/**
 * The lesson the learner does next, the one every screen marks "Up next": Today's, the Plan's,
 * the map's and a chapter's page. It's the plan item of the lesson today's session opens next (the
 * one started, then the first not started); before the day's session is built, or once its lessons
 * are done, it's the plan's next lesson (`findNextItem`). Read from the plan's order alone, Pedro's
 * Plan marked a chapter of his first phase while Today opened a lesson of the second.
 */
export function findUpNextItem<Item extends UpNextCandidate>({
  items,
  todayBlocks,
}: {
  items: readonly Item[];
  todayBlocks: readonly TodayLearnBlock[];
}): Item | undefined {
  const learn = items.filter((item) => LEARN_KINDS.has(item.kind));
  const [today] = listTodayItems({ items: learn, todayBlocks });

  return today ?? findNextItem(learn);
}
