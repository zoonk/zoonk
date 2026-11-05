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

async function loadLessonIcons(ids: readonly string[]): Promise<Map<string, LessonIcon>> {
  if (ids.length === 0) {
    return new Map();
  }

  const icons = await prisma.lessonIcon.findMany({
    select: { id: true, smallUrl: true, url: true },
    where: { id: { in: [...new Set(ids)] }, status: "completed" },
  });

  return new Map(
    icons.flatMap((icon) =>
      icon.url && icon.smallUrl ? [[icon.id, { smallUrl: icon.smallUrl, url: icon.url }]] : [],
    ),
  );
}

function isWaiting({
  ideas,
  saved,
  steps,
}: {
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

  return stepWaits || ideas.some((idea) => idea.iconPending);
}

/**
 * Marks and icons arrive after the lesson's first read: until then the screens play as plain text,
 * and `marksPending` asks clients to read again within the picture wait.
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
}): Promise<{ marksPending: boolean; steps: PlayableLibraryStep[]; summary: LessonMap | null }> {
  if (targetLanguage) {
    return { marksPending: false, steps, summary: readLessonMap(summary) };
  }

  const ideas = readSavedLessonMap(summary)?.ideas ?? [];
  const saved = new Map(rows.map((row) => [row.id, readSavedStepMarks(row.marks)]));

  const icons = await loadLessonIcons([
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
    isWaiting({ ideas, saved, steps }) &&
    rows.some((row) => isPicturePending({ now, startedAt: row.generatedAt.getTime() }));

  return { marksPending, steps: marked, summary: readPlayableLessonMap({ icons, summary }) };
}
