import { type StudySessionBlock } from "@zoonk/db";
import { getBlockItemIds, readBlockPayload } from "../block-payload";
import { type PlannedBlock } from "../session-builder";

export const ONE_PER_DAY: ReadonlySet<StudySessionBlock["kind"]> = new Set<
  StudySessionBlock["kind"]
>(["produce", "review"]);

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
    block.payload.writing?.taskKey,
    block.payload.writing?.unit,
    ...(anyOrder ? itemIds.toSorted() : itemIds),
  ].join(":");
}

/** With anyOrder, reordered identical questions are unchanged; untouched days still compare order to preserve requested focus. */
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

export function hasSameBlocks({
  locked,
  read,
}: {
  locked: readonly StudySessionBlock[];
  read: readonly StudySessionBlock[];
}): boolean {
  return (
    read.length === locked.length &&
    read.every((block, index) => {
      const current = locked[index];

      return (
        current?.id === block.id &&
        current.status === block.status &&
        readBlockPayload(current).writing?.admissionId ===
          readBlockPayload(block).writing?.admissionId
      );
    })
  );
}
