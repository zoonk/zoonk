import { type StudySessionBlock } from "@zoonk/db";
import { getBlockItemIds, readBlockPayload } from "../block-payload";
import { type PlannedBlock } from "../session-builder";

/**
 * A day holds one review, one practice and one essay; lessons can be many, and so can challenges
 * (each one due today, see `loadSessionBosses`).
 */
export const ONE_PER_DAY: ReadonlySet<StudySessionBlock["kind"]> = new Set<
  StudySessionBlock["kind"]
>(["practice", "produce", "review"]);

/** What a block holds, to tell a rebuild that changes nothing from one that does. */
function getContent({
  anyOrder,
  block,
}: {
  anyOrder: boolean;
  block: Pick<PlannedBlock, "estimatedMinutes" | "kind" | "lessonId" | "payload">;
}) {
  const itemIds = getBlockItemIds(block.payload);

  return [
    block.kind,
    block.lessonId,
    block.estimatedMinutes,
    ...(anyOrder ? itemIds.toSorted() : itemIds),
  ].join(":");
}

/**
 * Whether the rest of the day comes out as it was. In a day underway, the same questions in
 * another order are the same day: practice ranks them again from the answers the learner gave
 * since it opened. A day nobody started is built again whole, and a change of focus puts the
 * topics it asks for first (Pedro's class test eve).
 */
export function hasSameContent({
  anyOrder,
  planned,
  replaced,
}: {
  anyOrder: boolean;
  planned: readonly PlannedBlock[];
  replaced: readonly StudySessionBlock[];
}): boolean {
  return (
    planned.length === replaced.length &&
    planned.every((block, index) => {
      const current = replaced[index];

      return (
        current !== undefined &&
        getContent({ anyOrder, block }) ===
          getContent({
            anyOrder,
            block: {
              ...current,
              estimatedMinutes: current.estimatedMinutes ?? 0,
              payload: readBlockPayload(current),
            },
          })
      );
    })
  );
}
