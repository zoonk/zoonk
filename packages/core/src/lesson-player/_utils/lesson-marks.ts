import "server-only";
import { prisma } from "@zoonk/db";
import { type LessonIcon } from "../../library/icons/lesson-icon-contract";
import {
  type LessonMap,
  readLessonMap,
  readPlayableLessonMap,
  readSavedLessonMap,
} from "../../library/lessons/lesson-map";
import { fitStepMarks, readSavedStepMarks, toStepMarks } from "../../library/marks/step-marks";
import { type PlayableLibraryStep } from "../playable-lesson";

type MarkedRow = { id: string; marks: unknown };

async function loadLessonIcons(ids: readonly string[]): Promise<Map<string, LessonIcon>> {
  const rows =
    ids.length === 0
      ? []
      : await prisma.lessonIcon.findMany({
          select: { id: true, smallUrl: true, url: true },
          where: { id: { in: [...new Set(ids)] }, status: "completed" },
        });

  return new Map(
    rows.flatMap((icon) =>
      icon.url && icon.smallUrl ? [[icon.id, { smallUrl: icon.smallUrl, url: icon.url }]] : [],
    ),
  );
}

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
}): Promise<{ steps: PlayableLibraryStep[]; summary: LessonMap | null }> {
  if (targetLanguage) {
    return { steps, summary: readLessonMap(summary) };
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

  return { steps: marked, summary: readPlayableLessonMap({ icons, summary }) };
}
