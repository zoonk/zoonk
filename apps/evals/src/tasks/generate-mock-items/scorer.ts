import { createHash } from "node:crypto";
import { createFixedScore } from "@/lib/score";
import { calculateScore } from "@/lib/score-calculation";
import { type CategoryScore, type TaskScorer, toTokenUsage } from "@/lib/types";
import { type GeneratedItem, OPTION_LETTERS } from "@zoonk/ai/tasks/items/schemas";
import { Output, generateText } from "ai";
import z from "zod";
import { type GenerateItemsCase, checkGeneratedItems } from "../generate-items/scorer";
import judgePrompt from "./blind-judge-prompt.md";
import { type GenerateMockItemsExpected, type ReleasedQuestion } from "./test-cases";

/**
 * The writers under test are mostly OpenAI's, so a judge from another family reads the blind mix:
 * it shouldn't share their idea of what the exam looks like.
 */
const BLIND_JUDGE_MODEL_ID = "anthropic/claude-opus-5.5";

const DIFFICULTY_TOLERANCE = 0.5;

const WEIGHTS = { codeChecks: 15, difficulty: 35, keys: 20, style: 30 } as const;

type MockItemsCase = GenerateItemsCase & { skill: { name: string; description: string } };

type BlindQuestion = ReleasedQuestion & { source: "released" | "written" };

const judgeSchema = z.object({
  questions: z.array(
    z.object({
      answer: z.string(),
      difficulty: z.number().min(1).max(5),
      number: z.number().int(),
      released: z.boolean(),
      tells: z.string().nullable(),
    }),
  ),
});

type Judgment = z.infer<typeof judgeSchema>["questions"][number];

function toBlindQuestion(item: GeneratedItem, command: string): ReleasedQuestion | null {
  if (item.format === "trueFalse") {
    const text = [item.context ?? command, item.statement].join("\n");
    return { key: item.isTrue ? "true" : "false", text };
  }

  if (item.format === "multipleChoice") {
    const options = item.options.map(
      (option, index) => `${OPTION_LETTERS[index] ?? index + 1}) ${option.text}`,
    );

    const right = item.options.findIndex((option) => option.isCorrect);
    const text = [item.context ?? command, item.question, ...options].join("\n");
    return { key: OPTION_LETTERS[right] ?? "", text };
  }

  return null;
}

/** The same mix for the same questions on every run, so reruns compare. */
function shuffle(questions: readonly BlindQuestion[]): BlindQuestion[] {
  const rank = (question: BlindQuestion) =>
    createHash("sha256").update(question.text).digest("hex");

  return questions.toSorted((first, second) => rank(first).localeCompare(rank(second)));
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function share<T>(values: readonly T[], test: (value: T) => boolean): number {
  return values.length === 0 ? 0 : values.filter((value) => test(value)).length / values.length;
}

type JudgedRow = { judgment: Judgment; question: BlindQuestion };

function rateDifficulty(judged: readonly JudgedRow[]): number {
  return mean(judged.map((row) => row.judgment.difficulty));
}

function shareSolved(judged: readonly JudgedRow[]): number {
  return share(
    judged,
    (row) => row.judgment.answer.trim().toLowerCase() === row.question.key.toLowerCase(),
  );
}

function clampScore(score: number): number {
  return Math.min(10, Math.max(1, score));
}

/** Easier is the failure the eval guards against; somewhat harder is closer to what the owner wants. */
function scoreDifficulty(gap: number): number {
  if (gap < -DIFFICULTY_TOLERANCE / 2) {
    return clampScore(10 - 4 * (-gap - DIFFICULTY_TOLERANCE / 2));
  }

  return clampScore(10 - 2 * Math.max(0, gap - 1));
}

function describeGap(gap: number): string {
  if (gap <= -DIFFICULTY_TOLERANCE) {
    return "easier than";
  }

  return gap >= DIFFICULTY_TOLERANCE ? "harder than" : "as hard as";
}

function category({
  id,
  label,
  reasoning,
  score,
}: {
  id: keyof typeof WEIGHTS;
  label: string;
  reasoning: string;
  score: number;
}): CategoryScore {
  return { categoryId: id, label, reasoning, score, weight: WEIGHTS[id] };
}

function format(value: number): string {
  return value.toFixed(2);
}

/**
 * Code checks first, then a judge reads the written questions mixed blind with released ones it
 * wasn't shown: it answers each, rates its difficulty and guesses which are real. Written questions
 * should rate as hard, be no easier to spot than the real ones, and keep their keys.
 */
export const scoreMockItems: TaskScorer<GenerateMockItemsExpected> = async ({
  output,
  testCase,
}) => {
  const input = testCase.userInput as MockItemsCase & { examFormat?: { name: string | null } };
  const { command = "", released } = testCase.expected ?? {};

  if (!released?.length) {
    throw new Error(`Test case ${testCase.id} needs released questions to compare.`);
  }

  const checked = checkGeneratedItems(output, input);
  const { items } = JSON.parse(checked.judgedOutput) as { items: GeneratedItem[] };
  const written = items.flatMap((item) => toBlindQuestion(item, command) ?? []);

  if (written.length === 0) {
    return createFixedScore({
      conclusion: `No written question passed the code checks. ${checked.problems.join(" ")}`,
      score: 6,
    });
  }

  const mix = shuffle([
    ...written.map((question) => ({ ...question, source: "written" as const })),
    ...released.map((question) => ({ ...question, source: "released" as const })),
  ]);

  const { output: judged, usage } = await generateText({
    instructions: judgePrompt,
    model: BLIND_JUDGE_MODEL_ID,
    output: Output.object({ schema: judgeSchema }),
    prompt: [
      `EXAM: ${input.examFormat?.name ?? "none"}`,
      `SKILL: ${input.skill.name}: ${input.skill.description}`,
      "QUESTIONS:",
      ...mix.map((question, index) => `${index + 1}. ${question.text}`),
    ].join("\n"),
  });

  const rows: JudgedRow[] = mix.flatMap((question, index) => {
    const judgment = judged.questions.find((entry) => entry.number === index + 1);
    return judgment ? [{ judgment, question }] : [];
  });

  const of = (source: BlindQuestion["source"]) =>
    rows.filter((row) => row.question.source === source);

  const [writtenRows, releasedRows] = [of("written"), of("released")];

  const gap = rateDifficulty(writtenRows) - rateDifficulty(releasedRows);

  const spotted = share(writtenRows, (row) => !row.judgment.released);
  const doubted = share(releasedRows, (row) => !row.judgment.released);
  const advantage = Math.max(0, spotted - doubted);

  const tells = writtenRows.flatMap((row) => (row.judgment.tells ? [row.judgment.tells] : []));

  const categoryScores = [
    category({
      id: "difficulty",
      label: "Difficulty against released questions",
      reasoning: `Written questions rate ${format(rateDifficulty(writtenRows))} and released ones ${format(rateDifficulty(releasedRows))} (1-5): ${describeGap(gap)} the exam.`,
      score: scoreDifficulty(gap),
    }),
    category({
      id: "style",
      label: "Exam style (blind)",
      reasoning: `The judge marked ${format(spotted)} of written and ${format(doubted)} of released questions as imitations. ${tells.join(" ")}`,
      score: clampScore(10 - 9 * advantage),
    }),
    category({
      id: "keys",
      label: "Keys a blind expert reproduces",
      reasoning: `The judge reproduced ${format(shareSolved(writtenRows))} of written keys and ${format(shareSolved(releasedRows))} of official released keys.`,
      score: 1 + 9 * shareSolved(writtenRows),
    }),
    category({
      id: "codeChecks",
      label: "Code checks",
      reasoning:
        checked.problems.length === 0
          ? `All ${checked.total} questions passed the code checks.`
          : `${checked.passed} of ${checked.total} passed. ${checked.problems.join(" ")}`,
      score: 1 + (9 * checked.passed) / Math.max(1, checked.total),
    }),
  ];

  const score = calculateScore({ categoryScores, steps: [] });

  return {
    ...createFixedScore({
      conclusion: categoryScores.map((entry) => `${entry.label}: ${entry.reasoning}`).join(" "),
      score,
    }),
    categoryScores,
    judge: { modelId: BLIND_JUDGE_MODEL_ID, usage: toTokenUsage(usage) },
    score,
  };
};
