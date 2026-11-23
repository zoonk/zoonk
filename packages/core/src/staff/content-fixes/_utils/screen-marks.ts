import "server-only";
import { isExampleQuote, isUnderlineQuote } from "@zoonk/ai/tasks/lesson-marks/quotes";
import { type StepKind, type TransactionClient } from "@zoonk/db";
import { type SavedStepMarks, readSavedStepMarks } from "../../../library/marks/step-marks";
import { parseMarkedScreen, toMarksScreen } from "../../../library/marks/tag-lesson-marks";
import { type ContentFixMediaNeed, type ProducedContentFixMedia } from "../media-schema";
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
function fittingQuotes(marks: unknown, text: string): MarkedText {
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

export function lacksQuotes(marks: unknown, text: string): boolean {
  const { example, underline } = fittingQuotes(marks, text);
  return !example || !underline;
}

/**
 * Fills only the quotes the screen lacks, so a quote that still fits (which a learner's own
 * version of the screen may share) stays, and the screen's idea and icon stay as reviewed.
 * Without new quotes, as when marking failed, the screen keeps what still fits.
 */
export function withMarkedText({
  marked,
  marks,
  text,
}: {
  marked?: MarkedText;
  marks: unknown;
  text: string;
}): SavedStepMarks {
  const fitting = fittingQuotes(marks, text);

  return {
    ...(readSavedStepMarks(marks) ?? UNTAGGED),
    example: fitting.example ?? marked?.example ?? null,
    underline: fitting.underline ?? marked?.underline ?? null,
  };
}

function stepMarksKey(stepId: string): string {
  return `marks:${stepId}`;
}

/** The quotes a rewritten explanation or worked example lacks get marked before review. */
export async function stepMarksNeed(
  db: TransactionClient,
  { after, before, id }: { after: Json; before: Json; id: string },
): Promise<ContentFixMediaNeed[]> {
  const step = await db.step.findUniqueOrThrow({
    select: {
      kind: true,
      lesson: { select: { language: true, targetLanguage: true, title: true } },
      marks: true,
    },
    where: { id },
  });

  const target = toMarksNeedScreen({ content: after, kind: step.kind });
  const rewritten = toMarksNeedScreen({ content: before, kind: step.kind })?.text !== target?.text;

  if (
    !target ||
    !rewritten ||
    step.lesson.targetLanguage ||
    !readSavedStepMarks(step.marks) ||
    !lacksQuotes(step.marks, target.text)
  ) {
    return [];
  }

  return [
    {
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
  screens,
}: {
  marked: Extract<ProducedContentFixMedia, { kind: "marks" }>;
  positions: readonly number[];
  screens: { content: Record<string, unknown>; kind: StepKind; marks: unknown; position: number }[];
}): void {
  for (const [index, position] of positions.entries()) {
    const screen = screens.find((row) => row.position === position);
    const text = screen && toMarksNeedScreen(screen)?.text;

    if (screen && text !== undefined) {
      screen.marks = withMarkedText({ marked: marked.screens[index], marks: screen.marks, text });
    }
  }
}
