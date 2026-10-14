import { type StudySessionBlock } from "@zoonk/db";
import { readBlockPayload } from "../block-payload";
import { type MissionPick } from "./catalog";

function readPayload(block: Pick<StudySessionBlock, "payload"> & { id?: string }) {
  return readBlockPayload({ id: block.id ?? "planned", payload: block.payload });
}

/** Anchors survive block replacement: the plan item or lessons, otherwise the day's single kind. */
export function getMissionBlocks<
  Block extends Pick<StudySessionBlock, "kind" | "lessonId" | "payload"> & {
    id?: string;
    status?: string;
  },
>({ blocks, pick }: { blocks: readonly Block[]; pick: MissionPick }): Block[] {
  const { anchor } = pick;

  return blocks.filter((block) => {
    const payload = readPayload(block);

    if (payload.extra || payload.reinforcement || block.status === "skipped") {
      return false;
    }

    if (
      anchor.areaId &&
      payload.areaId !== anchor.areaId &&
      !payload.skillIds.some((id) => anchor.skillIds?.includes(id))
    ) {
      return false;
    }

    if (anchor.planItemId || anchor.planItemIds || anchor.lessonIds) {
      return (
        (anchor.planItemId !== undefined && payload.planItemId === anchor.planItemId) ||
        (payload.planItemId !== null &&
          (anchor.planItemIds?.includes(payload.planItemId) ?? false)) ||
        (block.lessonId !== null && (anchor.lessonIds?.includes(block.lessonId) ?? false))
      );
    }

    if (anchor.blockKind) {
      return block.kind === anchor.blockKind;
    }

    return false;
  });
}
