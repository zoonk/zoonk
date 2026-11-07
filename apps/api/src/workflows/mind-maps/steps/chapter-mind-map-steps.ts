import {
  type LessonGenerationState,
  getLessonGenerationStates,
} from "@zoonk/core/library/generation/state";
import {
  type MindMapAnalytics,
  type MindMapImageCheck,
  checkChapterMindMapImage,
  drawChapterMindMap,
  failChapterMindMap,
  holdChapterMindMap,
  removeChapterMindMapImage,
  showChapterMindMap,
  writeChapterMindMapStructure,
} from "@zoonk/core/mind-maps/generation";
import { safeAsync } from "@zoonk/utils/error";
import { FatalError } from "workflow";
import { isRunActive } from "../../_shared/run-activity";

export type MindMapLessons = { unsettled: number; writing: number };

type MapLesson = { lessonId: string; runId: string };

type LessonProgress = "settled" | "unsettled" | "writing";

async function readProgress({
  lesson,
  state,
}: {
  lesson: MapLesson;
  state: LessonGenerationState | undefined;
}): Promise<LessonProgress> {
  if (!state || state.status === "ready" || (state.status === "failed" && state.setAside)) {
    return "settled";
  }

  const owners = state.status === "generating" ? [lesson.runId, state.runId] : [lesson.runId];
  const active = await Promise.all(owners.map((runId) => isRunActive(runId)));

  return active.some(Boolean) ? "writing" : "unsettled";
}

/**
 * Keeps the map on its way while its lessons are written. A lesson is settled once it's written or
 * set aside; one still unsettled with no run writing it ended without being written.
 */
export async function holdMindMapStep({
  chapterId,
  lessons,
  runId,
}: {
  chapterId: string;
  lessons: MapLesson[];
  runId: string;
}): Promise<MindMapLessons> {
  "use step";

  await holdChapterMindMap({ chapterId, runId });

  const states = await getLessonGenerationStates(lessons.map((lesson) => lesson.lessonId));

  const progress = await Promise.all(
    lessons.map((lesson) => readProgress({ lesson, state: states.get(lesson.lessonId) })),
  );

  return {
    unsettled: progress.filter((value) => value === "unsettled").length,
    writing: progress.filter((value) => value === "writing").length,
  };
}

export async function writeMindMapStructureStep(input: {
  analytics: MindMapAnalytics;
  chapterId: string;
}): Promise<void> {
  "use step";

  await writeChapterMindMapStructure(input);
}

/** A drawn picture is paid for, so a failed store fails the run instead of retrying to draw another. */
export async function drawMindMapStep(input: {
  analytics: MindMapAnalytics;
  chapterId: string;
  corrections?: string[];
}): Promise<void> {
  "use step";

  const drawn = await drawChapterMindMap(input);

  const { error } = await safeAsync(() =>
    showChapterMindMap({ chapterId: input.chapterId, drawn }),
  );

  if (error) {
    throw new FatalError(
      `Chapter ${input.chapterId}'s mind map couldn't be stored: ${error.message}`,
    );
  }
}

export async function checkMindMapStep(input: {
  analytics: MindMapAnalytics;
  chapterId: string;
}): Promise<MindMapImageCheck> {
  "use step";

  return checkChapterMindMapImage(input);
}

export async function removeMindMapImageStep(input: {
  chapterId: string;
  imageUrl: string;
}): Promise<void> {
  "use step";

  await removeChapterMindMapImage(input);
}

export async function failMindMapStep(input: { chapterId: string; runId: string }): Promise<void> {
  "use step";

  await failChapterMindMap(input);
}
