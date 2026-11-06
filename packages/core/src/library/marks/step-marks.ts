import { isExampleQuote, isUnderlineQuote } from "@zoonk/ai/tasks/lesson-marks/quotes";
import { isMarkdownTableStart } from "@zoonk/utils/markdown-table";
import { z } from "zod";
import { type LessonIcon } from "../icons/lesson-icon-contract";
import { type StepContentByKind } from "../steps/contract/step-contract";
import { type StepMarks } from "./step-marks-contract";

export const iconNeedSchema = z.object({
  description: z.string(),
  name: z.string(),
  searchWords: z.array(z.string()),
});

/** `Step.marks`: what tagging found, with the icon linked once it's drawn. */
const savedStepMarksSchema = z.object({
  example: z.string().nullable(),
  iconId: z.uuid().nullable(),
  iconNeed: iconNeedSchema.nullable().optional(),
  /** The icon `iconNeed` asks for isn't linked or given up yet. */
  iconPending: z.boolean(),
  ideaIndex: z.int().min(0).nullable(),
  underline: z.string().nullable(),
});

export type SavedStepMarks = z.infer<typeof savedStepMarksSchema>;

export type MarkedScreen =
  | { content: StepContentByKind["check"]; kind: "check" }
  | { content: StepContentByKind["explanation"]; kind: "explanation" }
  | { content: StepContentByKind["hook"]; kind: "hook" }
  | { content: StepContentByKind["typedAnswer"]; kind: "typedAnswer" }
  | { content: StepContentByKind["workedExample"]; kind: "workedExample" }
  | { content: unknown; kind: "activity" | "challenge" | "spokenAnswer" | "summary" };

export function readSavedStepMarks(marks: unknown): SavedStepMarks | null {
  const parsed = savedStepMarksSchema.safeParse(marks);
  return parsed.success ? parsed.data : null;
}

/** Screens tagging reads: the ones that teach, and the ones that ask about an idea. */
export function isTaggedScreen(screen: MarkedScreen): boolean {
  switch (screen.kind) {
    case "check":
    case "explanation":
    case "typedAnswer":
    case "workedExample":
      return true;
    case "hook":
      return screen.content.variant === "guess";
    case "activity":
    case "challenge":
    case "spokenAnswer":
    case "summary":
      return false;
    default:
      return false;
  }
}

export function getMarkedText(screen: MarkedScreen): string | null {
  if (screen.kind === "explanation") {
    return screen.content.text;
  }

  return screen.kind === "workedExample" ? screen.content.problem : null;
}

/** The players draw a table wherever one starts, even right under a line with a pipe in it. */
function showsTable(text: string): boolean {
  return text.split(/\r?\n/u).some((_, index, lines) => isMarkdownTableStart(lines, index));
}

/** Icons add to a screen's visuals and never compete with one, a table in its text included. */
export function canShowIcon(screen: MarkedScreen): boolean {
  return (
    screen.kind === "explanation" &&
    !screen.content.image &&
    !screen.content.visual &&
    !screen.content.explore &&
    !showsTable(screen.content.text)
  );
}

/** The strip shows the idea's icon above the text, so the screen never shows that icon again. */
export function toStepMarks({
  icons,
  ideas,
  saved,
}: {
  icons: ReadonlyMap<string, LessonIcon>;
  ideas: readonly { iconId?: string | null }[];
  saved: SavedStepMarks;
}): StepMarks {
  const { example, iconId, ideaIndex, underline } = saved;
  const idea = ideaIndex === null ? undefined : ideas[ideaIndex];
  const icon = iconId && iconId !== idea?.iconId ? icons.get(iconId) : undefined;

  return { example, icon: icon ?? null, ideaIndex: idea ? ideaIndex : null, underline };
}

/**
 * A question's idea names its answer ("Procarionte" on a guess before its explanation), so only
 * teaching screens carry marks to the players; tagging still stores the idea of every screen.
 */
const NO_MARKS: StepMarks = { example: null, icon: null, ideaIndex: null, underline: null };

/** Keeps only what still fits the screen's content, which a learner's own version may change. */
export function fitStepMarks({
  marks,
  screen,
}: {
  marks: StepMarks;
  screen: MarkedScreen;
}): StepMarks {
  const text = getMarkedText(screen);

  if (text === null) {
    return NO_MARKS;
  }

  return {
    example: marks.example && isExampleQuote({ quote: marks.example, text }) ? marks.example : null,
    icon: canShowIcon(screen) ? marks.icon : null,
    ideaIndex: marks.ideaIndex,
    underline:
      marks.underline && isUnderlineQuote({ quote: marks.underline, text })
        ? marks.underline
        : null,
  };
}
