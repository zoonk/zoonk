import { type StepKind } from "@zoonk/db";
import { isAnswerableStep } from "../../lesson-player/lesson-run";
import { isExerciseKind } from "../../player/contracts/exercise-content";

type FieldClass = "answerKey" | "prose" | "question" | "structure";

type Path = readonly (number | string)[];

/**
 * A learner may be answering the screen while a fix lands, and answers are graded by option id
 * against the stored screen, so ids, references, counts, order and pictures never change. An
 * activity's `fields` decide its computed answer and drawing, so they stay too.
 */
const STRUCTURE_KEYS = new Set([
  "ai",
  "audioText",
  "audioUrl",
  "fields",
  "from",
  "goodWhen",
  "id",
  "image",
  "isExample",
  "kind",
  "language",
  "meter",
  "next",
  "picture",
  "position",
  "shape",
  "skill",
  "startNodeId",
  "template",
  "url",
  "variant",
]);

const ANSWER_KEY_KEYS = new Set([
  "acceptedAnswers",
  "answer",
  "answerIndex",
  "answers",
  "change",
  "effects",
  "isCorrect",
  "keyPoints",
  "quality",
  "sampleAnswer",
  "start",
  "targetText",
  "tolerance",
]);

const PROSE_KEYS = new Set([
  "example",
  "explanation",
  "feedback",
  "notes",
  "outcome",
  "practice",
  "quote",
  "reason",
  "replies",
  "result",
  "reveal",
  "source",
]);

/**
 * Language exercises reuse field names with their own meaning: a blank's `template` is the
 * sentence learners read, and a match's pairs are both what they read and how they're graded.
 */
const EXERCISE_FIELDS: Partial<Record<StepKind, Readonly<Record<string, FieldClass>>>> = {
  fillBlank: {
    answers: "answerKey",
    distractors: "question",
    romanizations: "prose",
    template: "question",
  },
  matchColumns: { pairs: "answerKey" },
};

export type ScreenContentVerdict =
  | { ok: true; changesAnswerKey: boolean; changesQuestion: boolean }
  | { ok: false; problem: string };

type Diff = { changed: Path[] } | { problem: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describePath(path: Path): string {
  return path.length === 0 ? "the content" : path.join(".");
}

function shapeOf(value: unknown): string {
  if (Array.isArray(value)) {
    return "array";
  }

  return value === null ? "null" : typeof value;
}

function diffArrays({ after, before, path }: { after: unknown[]; before: unknown[]; path: Path }) {
  if (
    path.at(-1) === "distractors" &&
    [...before, ...after].every((value) => typeof value === "string")
  ) {
    return { changed: JSON.stringify(before) === JSON.stringify(after) ? [] : [path] };
  }

  if (before.length !== after.length) {
    return {
      problem: `${describePath(path)} must keep its ${String(before.length)} entries in order`,
    };
  }

  return mergeDiffs(before.map((item, index) => diffValues(item, after[index], [...path, index])));
}

function diffRecords({
  after,
  before,
  path,
}: {
  after: Record<string, unknown>;
  before: Record<string, unknown>;
  path: Path;
}): Diff {
  const keys = Object.keys(before).toSorted();
  const afterKeys = Object.keys(after).toSorted();

  if (keys.join("\n") !== afterKeys.join("\n")) {
    return { problem: `${describePath(path)} must keep the same fields (${keys.join(", ")})` };
  }

  return mergeDiffs(keys.map((key) => diffValues(before[key], after[key], [...path, key])));
}

function mergeDiffs(diffs: readonly Diff[]): Diff {
  const failed = diffs.find((diff) => "problem" in diff);

  if (failed) {
    return failed;
  }

  return { changed: diffs.flatMap((diff) => ("changed" in diff ? diff.changed : [])) };
}

function diffValues(before: unknown, after: unknown, path: Path): Diff {
  if (shapeOf(before) !== shapeOf(after)) {
    return { problem: `${describePath(path)} must stay ${shapeOf(before)}` };
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    return diffArrays({ after, before, path });
  }

  if (isRecord(before) && isRecord(after)) {
    return diffRecords({ after, before, path });
  }

  return { changed: before === after ? [] : [path] };
}

function classOf({ key, kind }: { key: string; kind?: StepKind }): FieldClass | null {
  const exercise = kind ? EXERCISE_FIELDS[kind]?.[key] : undefined;

  if (exercise) {
    return exercise;
  }

  if (STRUCTURE_KEYS.has(key)) {
    return "structure";
  }

  if (ANSWER_KEY_KEYS.has(key)) {
    return "answerKey";
  }

  return PROSE_KEYS.has(key) ? "prose" : null;
}

function classify({
  answered,
  kind,
  path,
}: {
  answered: boolean;
  kind?: StepKind;
  path: Path;
}): FieldClass {
  const classes = path
    .filter((segment): segment is string => typeof segment === "string")
    .map((key) => classOf({ key, kind }));

  if (classes.includes("structure")) {
    return "structure";
  }

  return classes.findLast((entry) => entry !== null) ?? (answered ? "question" : "prose");
}

function isAnswered({ content, kind }: { content: unknown; kind: StepKind }): boolean {
  return (
    isAnswerableStep({ kind }) ||
    (kind === "hook" && isRecord(content) && content.variant === "guess")
  );
}

/**
 * Whether a screen's content may change from `before` to `after` in one fix: the same shape with
 * only text, flags and numbers changed, never a structural part, and never both what learners
 * read before answering and which answer is right, so a reviewer reads one kind of change at a
 * time. A language exercise's words are both, so it may change them together, and so may a
 * screen whose question another row decides (`keyedElsewhere`), which checks that row instead.
 */
export function checkScreenContentChange({
  after,
  before,
  keyedElsewhere = false,
  kind,
}: {
  after: unknown;
  before: unknown;
  keyedElsewhere?: boolean;
  kind: StepKind;
}): ScreenContentVerdict {
  const diff = diffValues(before, after, []);

  if ("problem" in diff) {
    return { ok: false, problem: diff.problem };
  }

  const answered = isAnswered({ content: before, kind });
  const classes = diff.changed.map((path) => ({ kind: classify({ answered, kind, path }), path }));
  const structural = classes.find((entry) => entry.kind === "structure");

  if (structural) {
    return { ok: false, problem: `${describePath(structural.path)} can't change in a fix` };
  }

  const changesAnswerKey = classes.some((entry) => entry.kind === "answerKey");
  const changesQuestion = classes.some((entry) => entry.kind === "question");
  const together = keyedElsewhere || isExerciseKind(kind);

  if (changesAnswerKey && changesQuestion && !together) {
    return {
      ok: false,
      problem:
        "This changes both what learners read before answering and which answer is right. Propose one, and the other once it's approved.",
    };
  }

  return { changesAnswerKey, changesQuestion, ok: true };
}

function valueAt(value: unknown, path: Path): unknown {
  return path.reduce<unknown>((current, segment) => {
    if (Array.isArray(current)) {
      return current[Number(segment)];
    }

    return isRecord(current) ? current[segment] : undefined;
  }, value);
}

export type ContentValueChange = {
  after: unknown;
  before: unknown;
  /** Whether the value decides which answer is right. */
  isAnswerKey: boolean;
  path: string;
};

/**
 * Every value that differs between two versions of a screen's content or a lesson's map, for
 * showing a fix to its reviewer. Null when they don't share a shape, which no stored fix does.
 */
export function listContentValueChanges({
  after,
  before,
}: {
  after: unknown;
  before: unknown;
}): ContentValueChange[] | null {
  const diff = diffValues(before, after, []);

  if ("problem" in diff) {
    return null;
  }

  return diff.changed.map((path) => ({
    after: valueAt(after, path),
    before: valueAt(before, path),
    isAnswerKey: classify({ answered: false, path }) === "answerKey",
    path: path.join("."),
  }));
}
