import "server-only";
import { isUuid } from "@zoonk/utils/uuid";
import { io } from "next/cache";
import { findOwnedGoal } from "../learner/_utils/owned-goal";
import { loadMindMapChapters } from "./_utils/load-mind-map-chapters";
import { getMindMapStatus } from "./_utils/mind-map-view";
import { type MindMapStatus } from "./mind-map-contract";

export type ChapterMindMapStatusResult =
  | { mindMap: { status: MindMapStatus }; status: "ready" }
  | { status: "notFound" | "unauthorized" };

/** Returns notFound for a chapter outside the selected goal's plan. */
export async function getChapterMindMapStatus({
  chapterId,
  goalId,
}: {
  chapterId: string;
  goalId: string;
}): Promise<ChapterMindMapStatusResult> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  if (!isUuid(chapterId)) {
    return { status: "notFound" };
  }

  const [facts] = await loadMindMapChapters({ chapterIds: [chapterId], goal: owned.goal });

  if (!facts) {
    return { status: "notFound" };
  }

  await io();

  return { mindMap: { status: getMindMapStatus({ ...facts, now: new Date() }) }, status: "ready" };
}
