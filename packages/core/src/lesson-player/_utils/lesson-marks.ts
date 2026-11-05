import "server-only";
import { prisma } from "@zoonk/db";
import { type LessonIcon } from "../../library/icons/lesson-icon-contract";
import {
  type LessonMap,
  type SavedLessonMapIdea,
  readLessonMap,
  readPlayableLessonMap,
  readSavedLessonMap,
} from "../../library/lessons/lesson-map";
import {
  type SavedStepMarks,
  fitStepMarks,
  isTaggedScreen,
  readSavedStepMarks,
  toStepMarks,
} from "../../library/marks/step-marks";
import { isPicturePending } from "../picture-policy";
import { type PlayableLibraryStep } from "../playable-lesson";

type MarkedRow = { generatedAt: Date; id: string; marks: unknown };

async function loadLessonIcons(
  ids: readonly string[],
): Promise<{ drawing: string[]; icons: Map<string, LessonIcon> }> {
  const rows =
    ids.length === 0
      ? []
      : await prisma.lessonIcon.findMany({
          select: { id: true, smallUrl: true, status: true, url: true },
          where: { id: { in: [...new Set(ids)] } },
        });

  return {
    drawing: rows.flatMap((icon) => (icon.status === "running" ? [icon.id] : [])),
    icons: new Map(
      rows.flatMap((icon) =>
        icon.status === "completed" && icon.url && icon.smallUrl
          ? [[icon.id, { smallUrl: icon.smallUrl, url: icon.url }]]
          : [],
      ),
    ),
  };
}

function isWaiting({
  drawing,
  ideas,
  saved,
  steps,
}: {
  drawing: readonly string[];
  ideas: readonly SavedLessonMapIdea[];
  saved: ReadonlyMap<string, SavedStepMarks | null>;
  steps: readonly PlayableLibraryStep[];
}): boolean {
  const stepWaits = steps.some((step) => {
    if (!("content" in step) || !isTaggedScreen(step)) {
      return false;
    }

    const marks = saved.get(step.id);
    return !marks || marks.iconPending;
  });

  return stepWaits || drawing.length > 0 || ideas.some((idea) => idea.iconPending);
}

/**
 * Marks and icons arrive after the lesson's first read: until then the screens play as plain text,
 * and `marksPending` asks clients to read again within the picture wait. `drawingIconIds` are linked
 * icons still drawing, which land without changing the lesson.
 */
export async function withLessonMarks({
  rows,
  steps,
  summary,
  targetLanguage,
}: {
  rows: readonly MarkedRow[];
  steps: PlayableLibraryStep[];
  summary: unknown;
  targetLanguage: string | null;
}): Promise<{
  drawingIconIds: string[];
  marksPending: boolean;
  steps: PlayableLibraryStep[];
  summary: LessonMap | null;
}> {
  if (targetLanguage) {
    return { drawingIconIds: [], marksPending: false, steps, summary: readLessonMap(summary) };
  }

  const ideas = readSavedLessonMap(summary)?.ideas ?? [];
  const saved = new Map(rows.map((row) => [row.id, readSavedStepMarks(row.marks)]));

  const { drawing, icons } = await loadLessonIcons([
    ...[...saved.values()].flatMap((marks) => (marks?.iconId ? [marks.iconId] : [])),
    ...ideas.flatMap((idea) => (idea.iconId ? [idea.iconId] : [])),
  ]);

  const marked = steps.map((step) => {
    const marks = saved.get(step.id);

    return "content" in step && marks
      ? {
          ...step,
          marks: fitStepMarks({ marks: toStepMarks({ icons, ideas, saved: marks }), screen: step }),
        }
      : step;
  });

  const now = Date.now();

  const marksPending =
    isWaiting({ drawing, ideas, saved, steps }) &&
    rows.some((row) => isPicturePending({ now, startedAt: row.generatedAt.getTime() }));

  return {
    drawingIconIds: drawing,
    marksPending,
    steps: marked,
    summary: readPlayableLessonMap({ icons, summary }),
  };
}
