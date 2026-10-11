import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskScorer } from "@/lib/types";
import { type ExamSpeakingCardOutput } from "@zoonk/ai/tasks/v2/language/exam-speaking-card";
import { EXAM_SPEAKING_CARD_SCORE_CATEGORIES } from "./score-categories";
import { type ExamSpeakingCardInput } from "./test-cases";

const MAX_INSTRUCTIONS = 4;
const MIN_PROMPTS = 1;
const MAX_PROMPTS = 7;
const MIN_TEXT_WORDS = 100;
const MIN_TABLE_ROWS = 3;
const MAX_TABLE_ROWS = 8;
const FULL_SHARE = 100;
const SHARE_SLACK = 2;
const PERCENT = /^(?<value>\d+(?:[.,]\d+)?)\s*%$/u;

function readPercent(cell: string): number | null {
  const value = PERCENT.exec(cell.trim())?.groups?.value;
  return value === undefined ? null : Number(value.replace(",", "."));
}

/** Each line whose cells are all percentages, as its total. */
function sumShares(lines: readonly (readonly string[])[]): number[] {
  return lines
    .map((cells) => cells.map((cell) => readPercent(cell)))
    .filter((values) => values.length > 1 && values.every((value) => value !== null))
    .map((values) => values.reduce<number>((sum, value) => sum + (value ?? 0), 0));
}

/** Shares of one question add up to 100, whether the question runs down a column or along a row. */
function sharesAddUp(table: NonNullable<ExamSpeakingCardOutput["table"]>): boolean {
  const columns = table.columns.map((_, index) => table.rows.map((row) => row[index] ?? ""));
  const sums = [...sumShares(columns), ...sumShares(table.rows)];

  return sums.length === 0 || sums.some((sum) => Math.abs(sum - FULL_SHARE) <= SHARE_SLACK);
}

function checkMaterial({
  card,
  stimulus,
}: {
  card: ExamSpeakingCardOutput;
  stimulus: ExamSpeakingCardInput["task"]["stimulus"];
}): string | null {
  if (
    stimulus === "photos" &&
    (card.photos.length === 0 || card.photos.some((photo) => !photo.scene.trim()))
  ) {
    return "A photo task needs at least one photo scene.";
  }

  if (stimulus === "text" && (card.text?.body.split(/\s+/u).length ?? 0) < MIN_TEXT_WORDS) {
    return `A text task needs a text of at least ${MIN_TEXT_WORDS} words.`;
  }

  if (stimulus !== "data") {
    return null;
  }

  const { table } = card;

  if (
    !table ||
    table.rows.length < MIN_TABLE_ROWS ||
    table.rows.length > MAX_TABLE_ROWS ||
    table.rows.some((row) => row.length !== table.columns.length)
  ) {
    return "A data task needs a table of 3 to 8 rows, each with a cell per column.";
  }

  return sharesAddUp(table) ? null : "The table's shares of one question don't add up to 100.";
}

/** The card's parts: instructions, prompts, the task's material, and a script with its opening. */
function checkCard({
  input,
  output,
}: {
  input: ExamSpeakingCardInput;
  output: string;
}): CodeCheckResult {
  const card = JSON.parse(output) as ExamSpeakingCardOutput;

  const problems = [
    card.instructions.length > 0 && card.instructions.length <= MAX_INSTRUCTIONS
      ? null
      : `Instructions have ${card.instructions.length} lines instead of 1 to ${MAX_INSTRUCTIONS}.`,
    card.prompts.length >= MIN_PROMPTS && card.prompts.length <= MAX_PROMPTS
      ? null
      : `Prompts have ${card.prompts.length} items instead of ${MIN_PROMPTS} to ${MAX_PROMPTS}.`,
    checkMaterial({ card, stimulus: input.task.stimulus }),
    card.characterBrief.trim() && card.openingLine.trim()
      ? null
      : "The script or its opening line is empty.",
  ].filter((problem) => problem !== null);

  const total = 4;
  return { judgedOutput: output, passed: total - problems.length, problems, total };
}

/** Code checks the card's structure and material; the judge scores it against the exam's sheet. */
export const scoreExamSpeakingCardOutput: TaskScorer = ({ output, testCase }) =>
  scoreWithCodeChecks({
    check: (value) =>
      checkCard({ input: testCase.userInput as ExamSpeakingCardInput, output: value }),
    output,
    scoreCategories: EXAM_SPEAKING_CARD_SCORE_CATEGORIES,
    testCase,
  });
