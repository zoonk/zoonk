import { answerKeyEvidence } from "@/lib/answer-key-evidence";
import { scoreWithCodeChecks } from "@/lib/code-checked-score";
import { defineScoreCategories } from "@/lib/score-categories";
import { type TaskCodeChecks, type TaskScorer } from "@/lib/types";
import { type WritingPromptOutput } from "@zoonk/ai/tasks/items/write-writing-prompt";
import { promptContent } from "@zoonk/core/library/items/write-writing-item";
import { normalizeString } from "@zoonk/utils/string";
import { type WriteWritingPromptInput } from "./test-cases";

const POINTS_PRECISION = 1e-9;

export const WRITE_WRITING_PROMPT_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations:
      "Judge the question as the exam's own board would set it for this task: its kind of text, its topic inside the task and the skills' field, a command a candidate can't misread, numbered aspects with their marks when the task has points, and nothing the screen already shows (line limit, total). For a drill, one short writing move on the drill skill. Score at most 6 when the question doesn't fit the task or its kind of text; at most 7 when it would look out of place in that exam.",
    id: "realism",
    label: "A question the board could set",
    weight: 40,
  },
  {
    expectations:
      "Judge the private key as an examiner who will grade with it: an item with definite answers is keyed as aspects that are each one observable thing, earned whole or not at all, or in three steps when it asks to explain or justify; an item that asks to discuss, analyze or relate a topic is one aspect with four steps on how well the answer treats it; every requested item is covered, and every fact in the key points is correct and current (articles, dates, figures). The context invents no quote or figure attributed to a real source. Score at most 5 when a key fact is wrong; at most 7 when an aspect is a vague quality or a requested aspect has no aspect.",
    id: "key",
    label: "A key an examiner can grade with",
    weight: 40,
  },
  {
    expectations:
      "The title names the topic in a few words and differs in substance from the used titles; assessedSkillIds hold only skills the answer exercises (never revising or proofreading for a whole answer; only the drill skill for a drill). Score at most 7 when the topic repeats a used title or a skill is credited without being exercised.",
    id: "fit",
    label: "Title and skills",
    weight: 20,
  },
]);

function checkPoints({
  input,
  output,
}: {
  input: WriteWritingPromptInput;
  output: WritingPromptOutput;
}) {
  const graded = input.unit === "answer" ? input.task.grading.criteria : [];

  return graded.flatMap(({ awards, id, points }) => {
    if (points === null || awards) {
      return [];
    }

    const aspects = output.aspects.filter((aspect) => aspect.criterionId === id);
    const sum = aspects.reduce((total, aspect) => total + (aspect.points ?? Number.NaN), 0);

    return Math.abs(sum - points) < POINTS_PRECISION
      ? []
      : [`Aspects of ${id} add up to ${sum}, not its ${points} points.`];
  });
}

function checkTitle({
  input,
  output,
}: {
  input: WriteWritingPromptInput;
  output: WritingPromptOutput;
}) {
  const title = normalizeString(output.title);

  return input.usedTitles.some((used) => {
    const old = normalizeString(used);
    return title === old || title.includes(old) || old.includes(title);
  })
    ? [`The title "${output.title}" repeats a used title.`]
    : [];
}

function checkValidator({
  input,
  output,
}: {
  input: WriteWritingPromptInput;
  output: WritingPromptOutput;
}) {
  try {
    promptContent({
      data: output,
      input: {
        count: 1,
        goalId: "eval",
        skillId: input.drillSkillId ?? undefined,
        taskKey: input.task.key,
        unit: input.unit,
        userId: "eval",
      },
      skills: input.skills,
      task: input.task,
    });

    return [];
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
}

const CHECKS = [checkPoints, checkTitle];

export const checkWriteWritingPrompt: TaskCodeChecks = ({ output, testCase }) => {
  const input = testCase.userInput as WriteWritingPromptInput;
  const parsed = JSON.parse(output) as WritingPromptOutput;
  const blockingProblems = checkValidator({ input, output: parsed });
  const results = [blockingProblems, ...CHECKS.map((check) => check({ input, output: parsed }))];

  return {
    ...(blockingProblems.length === 0
      ? answerKeyEvidence((label) => label(parsed, "question"))
      : {}),
    blockingProblems,
    judgedOutput: JSON.stringify(parsed, null, 2),
    passed: results.filter((problems) => problems.length === 0).length,
    problems: results.flat(),
    total: results.length,
  };
};

export const scoreWriteWritingPrompt: TaskScorer = ({ output, testCase }) =>
  scoreWithCodeChecks({
    check: (value) => checkWriteWritingPrompt({ output: value, testCase }),
    output,
    scoreCategories: WRITE_WRITING_PROMPT_SCORE_CATEGORIES,
    testCase,
  });
