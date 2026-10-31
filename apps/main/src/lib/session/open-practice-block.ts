import "server-only";
import { openStudyBlock } from "@zoonk/core/sessions/open-block";
import { type StudyBlockOpening } from "@zoonk/core/sessions/open-block-contract";
import { type AreaPracticeOutcome } from "@zoonk/learn/chapter";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";

export type PracticeBlockResult =
  | { destination: StudyBlockOpening; outcome: "started" }
  | { outcome: Exclude<AreaPracticeOutcome, "started"> };

type AddedPractice =
  | { block: { id: string }; status: "ready" }
  | { status: "goalNotActive" | "notFound" | "nothingToPractice" | "unauthorized" | "unavailable" };

export async function openPracticeBlock({
  add,
  label,
  timeZone,
}: {
  add: () => Promise<AddedPractice>;
  label: string;
  timeZone: string;
}): Promise<PracticeBlockResult> {
  const { data, error } = await safeAsync(async () => {
    const added = await add();

    if (added.status !== "ready") {
      return added;
    }

    const opened = await openStudyBlock({
      target: { blockId: added.block.id, kind: "block" },
      timeZone,
    });

    return { opened, status: "opened" as const };
  });

  if (error) {
    logError(`[${label}] Failed to add practice:`, error);
    return { outcome: "failed" };
  }

  if (data.status === "opened") {
    return data.opened.status === "ready"
      ? { destination: data.opened.opening, outcome: "started" }
      : { outcome: "failed" };
  }

  if (data.status === "nothingToPractice") {
    return { outcome: "nothingToPractice" };
  }

  return { outcome: data.status === "unavailable" ? "dailyCap" : "failed" };
}
