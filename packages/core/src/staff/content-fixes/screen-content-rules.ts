import { type StepKind } from "@zoonk/db";

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

const ANSWERED_KINDS = new Set<StepKind>([
  "activity",
  "challenge",
  "check",
  "spokenAnswer",
  "typedAnswer",
]);

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

function classify({ answered, path }: { answered: boolean; path: Path }): FieldClass {
  const keys = path.filter((segment): segment is string => typeof segment === "string");

  if (keys.some((key) => STRUCTURE_KEYS.has(key))) {
    return "structure";
  }

  const decided = keys.findLast((key) => ANSWER_KEY_KEYS.has(key) || PROSE_KEYS.has(key));

  if (decided) {
    return ANSWER_KEY_KEYS.has(decided) ? "answerKey" : "prose";
  }

  return answered ? "question" : "prose";
}

function isAnswered({ content, kind }: { content: unknown; kind: StepKind }): boolean {
  return (
    ANSWERED_KINDS.has(kind) ||
    (kind === "hook" && isRecord(content) && content.variant === "guess")
  );
}

/**
 * Whether a screen's content may change from `before` to `after` in one fix: the same shape with
 * only text, flags and numbers changed, never a structural part, and never both what learners
 * read before answering and which answer is right, since a learner still on the old screen would
 * be graded by a key written for another question.
 */
export function checkScreenContentChange({
  after,
  before,
  kind,
}: {
  after: unknown;
  before: unknown;
  kind: StepKind;
}): ScreenContentVerdict {
  const diff = diffValues(before, after, []);

  if ("problem" in diff) {
    return { ok: false, problem: diff.problem };
  }

  const answered = isAnswered({ content: before, kind });
  const classes = diff.changed.map((path) => ({ kind: classify({ answered, path }), path }));
  const structural = classes.find((entry) => entry.kind === "structure");

  if (structural) {
    return { ok: false, problem: `${describePath(structural.path)} can't change in a fix` };
  }

  const changesAnswerKey = classes.some((entry) => entry.kind === "answerKey");
  const changesQuestion = classes.some((entry) => entry.kind === "question");

  if (changesAnswerKey && changesQuestion) {
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
