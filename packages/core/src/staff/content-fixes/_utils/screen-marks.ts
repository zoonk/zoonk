import "server-only";
import { isExampleQuote, isUnderlineQuote } from "@zoonk/ai/tasks/lesson-marks/quotes";
import { type StepKind, type TransactionClient } from "@zoonk/db";
import { CURRENT_STEPS } from "../../../library/lessons/lesson-versions";
import {
  type SavedStepMarks,
  parseMarkedScreen,
  readSavedStepMarks,
  toMarksScreen,
} from "../../../library/marks/step-marks";
import {
  type ContentFixMediaNeed,
  type ProducedContentFixMedia,
  applyMarkedQuotes,
  stepMarksKey,
} from "../media-schema";
import { type Json } from "./resolved-change";

type ScreenText = { content: unknown; kind: StepKind };

export type MarksNeed = Extract<ContentFixMediaNeed, { kind: "marks" }>;
type MarkedText = Extract<ProducedContentFixMedia, { kind: "marks" }>["screens"][number];

const UNTAGGED: SavedStepMarks = {
  example: null,
  iconId: null,
  iconPending: false,
  ideaIndex: null,
  underline: null,
};

/** An explanation's or worked example's marked text, as the marks task reads it. */
export function toMarksNeedScreen(screen: ScreenText): MarksNeed["screens"][number] | null {
  const parsed = parseMarkedScreen(screen);

  if (parsed?.kind !== "explanation" && parsed?.kind !== "workedExample") {
    return null;
  }

  return { ...toMarksScreen(parsed), kind: parsed.kind };
}

/** A lesson the writing pipeline never tagged stays untagged, so its screens all look alike. */
export function isTaggedLesson(screens: readonly { marks: unknown }[]): boolean {
  return screens.some((screen) => readSavedStepMarks(screen.marks));
}

/** The saved quotes that still fit the text; one that no longer does is gone. */
export function fittingQuotes(marks: unknown, text: string): MarkedText {
  const saved = readSavedStepMarks(marks);

  return {
    example:
      saved?.example && isExampleQuote({ quote: saved.example, text }) ? saved.example : null,
    underline:
      saved?.underline && isUnderlineQuote({ quote: saved.underline, text })
        ? saved.underline
        : null,
  };
}

/** Only an explanation frames an example, so a worked example lacks no more than its underline. */
export function lacksQuotes({
  kept,
  kind,
}: {
  kept: MarkedText;
  kind: MarksNeed["screens"][number]["kind"];
}): boolean {
  return !kept.underline || (kind === "explanation" && !kept.example);
}

/**
 * The quotes a screen keeps and the ones it gets marked. A screen asked to mark again gets a new
 * example box in place of its own, and like a rewritten one, only the underline it lacks.
 */
export function toMarksTarget({
  asked,
  marks,
  position,
  target,
}: {
  asked: boolean;
  marks: unknown;
  position: number;
  target: MarksNeed["screens"][number];
}) {
  const kept = fittingQuotes(marks, target.text);
  const remarked = asked && target.kind === "explanation";

  return remarked || lacksQuotes({ kept, kind: target.kind })
    ? [{ kept, position, remarked, screen: target }]
    : [];
}

/**
 * A quote that still fits (which a learner's own version of the screen may share) stays unless the
 * screen was asked to mark again, and the screen's idea and icon stay as reviewed.
 */
function withMarkedText({
  marked,
  marks,
  remarked = false,
  text,
}: {
  marked?: MarkedText;
  marks: unknown;
  remarked?: boolean;
  text: string;
}): SavedStepMarks {
  return {
    ...(readSavedStepMarks(marks) ?? UNTAGGED),
    ...applyMarkedQuotes({ kept: fittingQuotes(marks, text), marked, remarked }),
  };
}

/** The quotes a rewritten explanation or worked example lacks get marked before review. */
export async function stepMarksNeed(
  db: TransactionClient,
  { after, before, id }: { after: Json; before: Json; id: string },
): Promise<ContentFixMediaNeed[]> {
  const step = await db.step.findUniqueOrThrow({
    select: {
      kind: true,
      lesson: {
        select: {
          language: true,
          steps: { select: { marks: true }, where: CURRENT_STEPS },
          targetLanguage: true,
          title: true,
        },
      },
      marks: true,
    },
    where: { id },
  });

  const target = toMarksNeedScreen({ content: after, kind: step.kind });
  const rewritten = toMarksNeedScreen({ content: before, kind: step.kind })?.text !== target?.text;
  const kept = target && fittingQuotes(step.marks, target.text);

  if (
    !target ||
    !kept ||
    !rewritten ||
    step.lesson.targetLanguage ||
    !isTaggedLesson(step.lesson.steps) ||
    !lacksQuotes({ kept, kind: target.kind })
  ) {
    return [];
  }

  return [
    {
      kept: [kept],
      key: stepMarksKey(id),
      kind: "marks",
      language: step.lesson.language,
      lessonTitle: step.lesson.title,
      screens: [target],
    },
  ];
}

/** The screen's marks with the reviewed quotes filled in, or null when the fix marked none. */
export async function remarkedStep(
  tx: TransactionClient,
  {
    content,
    id,
    media,
  }: { content: Json; id: string; media: ReadonlyMap<string, ProducedContentFixMedia> },
): Promise<SavedStepMarks | null> {
  const marked = media.get(stepMarksKey(id));

  if (marked?.kind !== "marks") {
    return null;
  }

  const step = await tx.step.findUniqueOrThrow({
    select: { kind: true, marks: true },
    where: { id },
  });

  const text = toMarksNeedScreen({ content, kind: step.kind })?.text;

  return text === undefined
    ? null
    : withMarkedText({ marked: marked.screens[0], marks: step.marks, text });
}

/** Fills the reviewed quotes into the listed screens of a lesson's new screen list. */
export function linkScreenMarks({
  marked,
  positions,
  remarked,
  screens,
}: {
  marked: Extract<ProducedContentFixMedia, { kind: "marks" }>;
  positions: readonly number[];
  remarked: readonly number[];
  screens: { content: Record<string, unknown>; kind: StepKind; marks: unknown; position: number }[];
}): void {
  for (const [index, position] of positions.entries()) {
    const screen = screens.find((row) => row.position === position);
    const text = screen && toMarksNeedScreen(screen)?.text;

    if (screen && text !== undefined) {
      screen.marks = withMarkedText({
        marked: marked.screens[index],
        marks: screen.marks,
        remarked: remarked.includes(position),
        text,
      });
    }
  }
}
