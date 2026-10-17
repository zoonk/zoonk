import "server-only";
import { type AreaPracticeOutcome } from "@zoonk/learn/chapter";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { openStudyBlock } from "./open-study-block";
import { type StudyDestination } from "./study-destination";

export type PracticeBlockResult =
  | { destination: StudyDestination; outcome: "started" }
  | { outcome: Exclude<AreaPracticeOutcome, "started"> };

type AddedPractice =
  | { block: Parameters<typeof openStudyBlock>[0]["block"]; sessionId: string; status: "ready" }
  | { status: "goalNotActive" | "notFound" | "nothingToPractice" | "unauthorized" | "unavailable" };

/**
 * A bonus practice block (a chapter's "Practice now", Content's "Review") that core added to
 * today's session, started where it's played, with why it didn't start in the learner's terms
 * otherwise.
 */
export async function openPracticeBlock({
  add,
  label,
  timeZone,
}: {
  add: () => Promise<AddedPractice>;
  /** Names the caller in the error log. */
  label: string;
  timeZone: string;
}): Promise<PracticeBlockResult> {
  const { data, error } = await safeAsync(async () => {
    const added = await add();

    if (added.status !== "ready") {
      return added;
    }

    const destination = await openStudyBlock({
      block: added.block,
      sessionId: added.sessionId,
      timeZone,
    });

    return { destination, status: "opened" as const };
  });

  if (error) {
    logError(`[${label}] Failed to add practice:`, error);
    return { outcome: "failed" };
  }

  if (data.status === "opened") {
    return data.destination
      ? { destination: data.destination, outcome: "started" }
      : { outcome: "failed" };
  }

  if (data.status === "nothingToPractice") {
    return { outcome: "nothingToPractice" };
  }

  return { outcome: data.status === "unavailable" ? "dailyCap" : "failed" };
}
