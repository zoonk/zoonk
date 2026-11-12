import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getSavedMindMapsCacheTag } from "../cache/tags";
import { getEntitlementViewer } from "../entitlements/_utils/entitlement-viewer";
import { findOwnedGoal } from "../learner/_utils/owned-goal";
import { loadMindMapChapters } from "./_utils/load-mind-map-chapters";
import { getMindMapStatus } from "./_utils/mind-map-view";
import { loadScopeLessonMaps } from "./_utils/scope-lesson-maps";
import { type SaveMindMapInput } from "./mind-map-contract";

export type SaveMindMapResult =
  | { saved: boolean; status: "ready" }
  | { status: "notFound" | "plusRequired" | "unauthorized" };

type SaveTarget = { status: "ready"; title: string } | { status: "notFound" | "plusRequired" };

async function findChapterTarget({
  chapterId,
  goal,
}: {
  chapterId: string;
  goal: Goal;
}): Promise<SaveTarget> {
  const [facts] = await loadMindMapChapters({
    chapterIds: [chapterId],
    goal,
    readViewer: getEntitlementViewer,
  });

  if (!facts) {
    return { status: "notFound" };
  }

  const status = getMindMapStatus({ ...facts, now: new Date() });

  if (status === "plusRequired") {
    return { status };
  }

  return status === "ready" ? { status, title: facts.title } : { status: "notFound" };
}

async function findLessonTarget({
  goal,
  lessonId,
}: {
  goal: Goal;
  lessonId: string;
}): Promise<SaveTarget> {
  const placements = await prisma.chapterLesson.findMany({
    select: { chapterId: true },
    where: { lessonId },
  });

  const chapters = await loadMindMapChapters({
    chapterIds: placements.map((placement) => placement.chapterId),
    goal,
    readViewer: getEntitlementViewer,
  });

  const lessonMaps = await loadScopeLessonMaps({
    chapters: chapters.filter((chapter) => chapter.canHaveMap),
    userId: goal.userId,
  });

  const maps = [...lessonMaps.values()].flat().filter((map) => map.lessonId === lessonId);
  const open = maps.find((map) => !map.locked);

  if (open) {
    return { status: "ready", title: open.title };
  }

  return { status: maps.length > 0 ? "plusRequired" : "notFound" };
}

/**
 * Saves a map to study again, or removes it: the learner's desired state, so a repeat changes
 * nothing. Saving needs a map the learner can open in this goal's scope now; removing needs only
 * their own save, wherever it came from. A save grants no access.
 */
export async function saveMindMap({
  goalId,
  kind,
  saved,
  targetId,
}: SaveMindMapInput & { goalId: string }): Promise<SaveMindMapResult> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  if (!isUuid(targetId)) {
    return { status: "notFound" };
  }

  const { goal, userId } = owned;

  if (!saved) {
    await prisma.savedMindMap.deleteMany({ where: { kind, targetId, userId } });
    revalidateCacheTags([getSavedMindMapsCacheTag(userId)]);
    return { saved: false, status: "ready" };
  }

  const target =
    kind === "chapter"
      ? await findChapterTarget({ chapterId: targetId, goal })
      : await findLessonTarget({ goal, lessonId: targetId });

  if (target.status !== "ready") {
    return { status: target.status };
  }

  await prisma.savedMindMap.createMany({
    data: [{ goalId: goal.id, kind, targetId, title: target.title, userId }],
    skipDuplicates: true,
  });

  revalidateCacheTags([getSavedMindMapsCacheTag(userId)]);
  return { saved: true, status: "ready" };
}
