import { isExampleQuote, isUnderlineQuote } from "@zoonk/ai/tasks/lesson-marks/quotes";
import { z } from "zod";
import { readSavedLessonMap } from "../../../../library/lessons/lesson-map";
import {
  type SavedStepMarks,
  canShowIcon,
  readSavedStepMarks,
} from "../../../../library/marks/step-marks";
import { safeParseStepContent } from "../../../../library/steps/contract/step-contract";
import { type Screen, type ScreenList } from "./schema";
import { type ScreenLesson } from "./snapshot";

export function mapIdeas({
  list,
  lesson,
  problems,
}: {
  list: ScreenList;
  lesson: ScreenLesson;
  problems: string[];
}) {
  const map = readSavedLessonMap(lesson.before.summary);

  if (!list.ideas) {
    return { ideas: map?.ideas ?? [], summary: lesson.before.summary };
  }

  const used = new Set<number>();

  const ideas = list.ideas.flatMap((entry, index) => {
    const old = entry.from === undefined ? null : map?.ideas[entry.from];

    if (entry.from !== undefined && (!old || used.has(entry.from))) {
      problems.push(`ideas[${String(index)}].from: use a distinct existing idea index.`);
    }

    if (entry.from !== undefined) {
      used.add(entry.from);
    }

    if ("text" in entry) {
      return [{ ...old, label: entry.label, text: entry.text }];
    }

    return old ? [old] : [];
  });

  const summary = { ...map, ideas };

  if (!readSavedLessonMap(summary)) {
    problems.push("ideas: supply a nonempty list of valid lesson-map ideas.");
  }

  return { ideas, summary: z.json().parse(summary) };
}

function fitEditedMarks(screen: Screen, marks: SavedStepMarks | null) {
  if (!marks) {
    return null;
  }

  const explanation =
    screen.kind === "explanation" && safeParseStepContent("explanation", screen.content);

  const example =
    screen.kind === "workedExample" && safeParseStepContent("workedExample", screen.content);

  const text =
    (explanation && explanation.success ? explanation.data.text : null) ??
    (example && example.success ? example.data.problem : null);

  const iconVisible =
    explanation &&
    explanation.success &&
    canShowIcon({ content: explanation.data, kind: "explanation" });

  return {
    ...marks,
    example:
      marks.example && text && isExampleQuote({ quote: marks.example, text })
        ? marks.example
        : null,
    underline:
      marks.underline && text && isUnderlineQuote({ quote: marks.underline, text })
        ? marks.underline
        : null,
    ...(!iconVisible && { iconId: null, iconNeed: null, iconPending: false }),
  };
}
export function remapMarks({
  base,
  screen,
  contentChanged,
  entry,
  list,
  map,
  problems,
  path,
}: {
  base: Screen;
  screen: Screen;
  contentChanged: boolean;
  entry: ScreenList["screens"][number];
  list: ScreenList;
  map: ReturnType<typeof mapIdeas>;
  problems: string[];
  path: string;
}) {
  const marks = readSavedStepMarks(base.marks);
  const old = marks?.ideaIndex ?? null;

  const mapped =
    list.ideas && old !== null ? list.ideas.findIndex(({ from }) => from === old) : old;

  const keptIndex = mapped === -1 ? null : mapped;
  const index = entry.idea === undefined ? keptIndex : entry.idea;

  if (index !== null && !map.ideas[index]) {
    problems.push(`${path}.idea: choose an index in the final ideas list or null.`);
  }

  if (!marks && index === null) {
    return null;
  }

  const kept = contentChanged ? fitEditedMarks(screen, marks) : marks;

  return {
    example: null,
    iconId: null,
    iconPending: false,
    underline: null,
    ...kept,
    ideaIndex: index,
  };
}
