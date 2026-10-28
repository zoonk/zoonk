import { type PlanItem } from "@zoonk/db";
import { isWritingItem } from "./plan-phase-views";

const LEARN_KINDS = new Set<PlanItem["kind"]>(["chapter", "lesson"]);

export type UpNextCandidate = Pick<PlanItem, "chapterId" | "kind" | "lessonId" | "status"> & {
  id: string | null;
};

export type TodayLearnBlock = { lessonId: string | null; planItemId: string | null };

function chooseNextItem<Item extends Pick<PlanItem, "kind">>({
  first,
  written,
  writtenIsLater,
}: {
  first: Item | undefined;
  written: Item | undefined;
  writtenIsLater: boolean;
}): Item | undefined {
  return written && (!writtenIsLater || written.kind === "lesson") ? written : first;
}

function findNextItem<Item extends Omit<UpNextCandidate, "id">>(
  items: readonly Item[],
): Item | undefined {
  const todo = items.filter((item) => item.status === "todo");
  const [first] = todo;
  const written = todo.find((item) => !isWritingItem(item));

  return chooseNextItem({ first, written, writtenIsLater: written !== first });
}

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
