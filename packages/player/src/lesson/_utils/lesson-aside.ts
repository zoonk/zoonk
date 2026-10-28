import { findMarkdownTableLines } from "@zoonk/utils/markdown-table";
import { type LessonPlayerState } from "../lesson-player-state";
import { type PlayableLibraryStep } from "../lesson-player-types";
import { isLanguageStep, isQuestionStep, isReadStep } from "./lesson-steps";

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

type HookTextStep = HookStep & { content: Extract<HookStep["content"], { variant: "text" }> };

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

const RECAP_QUESTION_KINDS = new Set<PlayableLibraryStep["kind"]>([
  "activity",
  "check",
  "hook",
  "typedAnswer",
]);

function getFirstPlace(
  state: Pick<LessonPlayerState, "queue" | "retried" | "steps">,
  step: PlayableLibraryStep,
): number {
  const first = state.queue.indexOf(step.id);
  const gaveUpPlace = state.retried.includes(step.id) && state.queue.lastIndexOf(step.id) === first;

  if (!gaveUpPlace) {
    return first;
  }

  const later = state.queue.findIndex((id) => (state.steps[id]?.position ?? 0) > step.position);
  return later === -1 ? first : Math.min(first, later);
}

export function getLessonRecap(
  state: Pick<LessonPlayerState, "position" | "queue" | "retried" | "steps">,
): { position: number; step: RecapStep } | null {
  const current = state.steps[state.queue[state.position] ?? ""];

  if (!current || isLanguageStep(current) || isReadStep(current)) {
    return null;
  }

  if (!RECAP_QUESTION_KINDS.has(current.kind)) {
    return null;
  }

  const firstPlace = getFirstPlace(state, current);

  const position = state.queue.findLastIndex(
    (id, index) => index < firstPlace && isRecapStep(state.steps[id]),
  );

  const step = state.steps[state.queue[position] ?? ""];

  return isRecapStep(step) ? { position, step } : null;
}

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

type OutlineRowState = "ahead" | "current" | "read";

export type OutlineRow = { id: string; number: number; state: OutlineRowState; title: string };

function getRowState({ index, position }: { index: number; position: number }): OutlineRowState {
  if (index < position) {
    return "read";
  }

  return index === position ? "current" : "ahead";
}

function getReadingTitle(step: PlayableLibraryStep | undefined): string | null {
  if (!isRecapStep(step) || step.kind === "hook") {
    return null;
  }

  return step.content.title ?? null;
}

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

const QUOTE_LENGTH = 80;

function shorten(text: string): string {
  const line = text.replaceAll(/\s+/gu, " ").trim();

  if (line.length <= QUOTE_LENGTH) {
    return line;
  }

  const cut = line.slice(0, QUOTE_LENGTH);
  const lastSpace = cut.lastIndexOf(" ");

  return `${(lastSpace > QUOTE_LENGTH / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

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
