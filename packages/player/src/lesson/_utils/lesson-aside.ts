import { findMarkdownTableLines } from "@zoonk/utils/markdown-table";
import { type LessonPlayerState } from "../lesson-player-state";
import { type PlayableLibraryStep } from "../lesson-player-types";
import { isLanguageStep, isQuestionStep, isReadStep } from "./lesson-steps";

/**
 * A question written with a table of data ("The office logged its letters:", a table, then "Which
 * month had the fewest?") reads as that data, then the question itself: its last paragraph that
 * isn't a table. Data written after the question ("Which sensor…?", then the table) shows above it
 * too, so the heading never holds a table.
 */
export function splitQuestionData(text: string): { data: string | null; question: string } {
  const lines = text.split(/\r?\n/u);
  const tableLines = findMarkdownTableLines(lines);

  if (tableLines.size === 0) {
    return { data: null, question: text };
  }

  const isProse = (index: number) => !tableLines.has(index) && Boolean(lines[index]?.trim());
  const end = lines.findLastIndex((_, index) => isProse(index));

  if (end === -1) {
    return { data: text, question: "" };
  }

  const start = lines.findLastIndex((_, index) => index < end && !isProse(index)) + 1;

  return {
    data: [...lines.slice(0, start), ...lines.slice(end + 1)].join("\n").trim(),
    question: lines.slice(start, end + 1).join("\n"),
  };
}

type HookStep = Extract<PlayableLibraryStep, { kind: "hook" }>;

/** A hook that opens with a fact or a situation to read, not a guess. */
type HookTextStep = HookStep & { content: Extract<HookStep["content"], { variant: "text" }> };

/** The reading screens a question's "From the lesson" can show: their words and their chart. */
export type RecapStep =
  | Extract<PlayableLibraryStep, { kind: "explanation" | "workedExample" }>
  | HookTextStep;

function isRecapStep(step: PlayableLibraryStep | undefined): step is RecapStep {
  if (!step || isLanguageStep(step)) {
    return false;
  }

  return (
    step.kind === "explanation" ||
    step.kind === "workedExample" ||
    (step.kind === "hook" && step.content.variant === "text")
  );
}

/** Questions that teach an idea, which "From the lesson" helps answer. */
const RECAP_QUESTION_KINDS = new Set<PlayableLibraryStep["kind"]>([
  "activity",
  "check",
  "hook",
  "typedAnswer",
]);

/**
 * "From the lesson" beside a question from `lg`: the last reading screen before it, by its place
 * in the lesson ("screen 3"). A language exercise has none (its card would give the word away), nor
 * does a reading screen, which is the lesson itself.
 */
export function getLessonRecap(
  state: Pick<LessonPlayerState, "position" | "queue" | "steps">,
): { position: number; step: RecapStep } | null {
  const current = state.steps[state.queue[state.position] ?? ""];

  if (!current || isLanguageStep(current) || isReadStep(current)) {
    return null;
  }

  if (!RECAP_QUESTION_KINDS.has(current.kind)) {
    return null;
  }

  const position = state.queue.findLastIndex(
    (id, index) => index < state.position && isRecapStep(state.steps[id]),
  );

  const step = state.steps[state.queue[position] ?? ""];

  return isRecapStep(step) ? { position, step } : null;
}

/**
 * The sentence "From the lesson" marks after a wrong answer: the one the question rests on (its
 * `basis`, which code found on that screen when the lesson was written), when the recap shows that
 * screen. Lessons written before bases, and questions whose basis is another screen, mark nothing.
 */
export function getRecapMark({
  recap,
  step,
}: {
  recap: { step: RecapStep } | null;
  step: PlayableLibraryStep;
}): string | null {
  if (!recap || isLanguageStep(step) || (step.kind !== "check" && step.kind !== "typedAnswer")) {
    return null;
  }

  const { basis } = step.content;

  return basis?.position === recap.step.position ? basis.quote : null;
}

/** Where a reading screen of the outline is: read, in view, or still ahead. */
type OutlineRowState = "ahead" | "current" | "read";

export type OutlineRow = { id: string; number: number; state: OutlineRowState; title: string };

/** A screen's place against the one in view. */
function getRowState({ index, position }: { index: number; position: number }): OutlineRowState {
  if (index < position) {
    return "read";
  }

  return index === position ? "current" : "ahead";
}

/** The title a reading screen goes by in the outline, if it has one. */
function getReadingTitle(step: PlayableLibraryStep | undefined): string | null {
  if (!isRecapStep(step) || step.kind === "hook") {
    return null;
  }

  return step.content.title ?? null;
}

/**
 * The outline beside a short story read screen by screen (a quick explanation): its titled reading
 * screens in order, numbered, the one in view current and the ones before it read; and how many
 * questions come after them, each counted once even when a missed one comes back.
 */
export function getLessonOutline(state: Pick<LessonPlayerState, "position" | "queue" | "steps">): {
  questions: number;
  rows: OutlineRow[];
} {
  const rows = state.queue.flatMap((id, index) => {
    const title = getReadingTitle(state.steps[id]);

    if (!title) {
      return [];
    }

    return [{ id, rowState: getRowState({ index, position: state.position }), title }];
  });

  const questions = new Set(
    state.queue.filter((id) => {
      const step = state.steps[id];
      return step !== undefined && !isLanguageStep(step) && isQuestionStep(step);
    }),
  ).size;

  return {
    questions,
    rows: rows.map((row, index) => ({
      id: row.id,
      number: index + 1,
      state: row.rowState,
      title: row.title,
    })),
  };
}

/** About as much of a question as a quote's one line holds. */
const QUOTE_LENGTH = 80;

/** A long question cut at a word, with an ellipsis, so the quote still closes. */
function shorten(text: string): string {
  const line = text.replaceAll(/\s+/gu, " ").trim();

  if (line.length <= QUOTE_LENGTH) {
    return line;
  }

  const cut = line.slice(0, QUOTE_LENGTH);
  const lastSpace = cut.lastIndexOf(" ");

  return `${(lastSpace > QUOTE_LENGTH / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * The words the buddy's drawer quotes for the screen asked about: the question the learner
 * answers, or a reading screen's title. Screens without such a line aren't quoted.
 */
export function getTutorQuoteText(step: PlayableLibraryStep): string | null {
  if (isLanguageStep(step)) {
    return null;
  }

  switch (step.kind) {
    case "check":
    case "typedAnswer":
      return shorten(splitQuestionData(step.content.question).question) || null;
    case "hook":
      return step.content.variant === "guess" ? shorten(step.content.question) : null;
    case "activity":
    case "spokenAnswer":
      return shorten(step.content.prompt) || null;
    case "explanation":
    case "workedExample":
      return step.content.title ? shorten(step.content.title) : null;
    case "challenge":
    case "summary":
      return null;
    default:
      return step satisfies never;
  }
}
