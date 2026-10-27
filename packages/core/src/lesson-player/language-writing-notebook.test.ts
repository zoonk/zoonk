import { gradeTypedAnswer } from "@zoonk/ai/tasks/v2/grading/grade-typed-answer";
import { classifyMistakeCause } from "@zoonk/ai/tasks/v2/mistakes/cause";
import { prisma } from "@zoonk/db";
import { learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { describe, expect, it, vi } from "vitest";
import { runDeferredWork } from "../_test-utils/deferred-work";
import { mistakeListInputSchema } from "../mistakes/contract";
import { listCurrentUserMistakes } from "../mistakes/list-current-user-mistakes";
import { lessonRunFixture } from "./_test-utils/lesson-run-fixture";
import { setupPlayableLesson, stepOfKind } from "./_test-utils/playable-lesson-setup";
import { checkLessonStep } from "./check-lesson-step";

const ANSWER = "There is two bedrooms. There are a park near my home.";
const CORRECTED = "There are two bedrooms. There is a park near my home.";
const SAMPLE = "There is no balcony, but there is a small garden.";

const CORRECTIONS = [
  { right: "There are two bedrooms", wrong: "There is two bedrooms" },
  { right: "There is a park", wrong: "There are a park" },
];

async function writeAnswer({
  answer = ANSWER,
  corrections = CORRECTIONS,
  language = true,
  met = true,
  state = "solid",
}: {
  answer?: string;
  corrections?: { right: string; wrong: string }[];
  language?: boolean;
  met?: boolean;
  state?: "new" | "solid";
} = {}) {
  const { lesson, skill, steps, user } = await setupPlayableLesson({
    steps: [
      {
        content: {
          basis: null,
          keyPoints: ["Use there is and there are to describe your home"],
          question: "Describe where you live using there is and there are.",
          sampleAnswer: SAMPLE,
        },
        kind: "typedAnswer",
      },
    ],
  });

  await Promise.all([
    prisma.lesson.update({
      data: { targetLanguage: language ? "en" : null },
      where: { id: lesson.id },
    }),
    learnerSkillFixture({ skillId: skill.id, state, userId: user.id }),
  ]);

  const run = await lessonRunFixture({ lessonId: lesson.id, userId: user.id });
  const step = stepOfKind(steps, "typedAnswer");
  const flush = runDeferredWork();

  // The model is an external boundary; recording, skill history, and notebook reads use Postgres.
  vi.mocked(gradeTypedAnswer).mockResolvedValueOnce({
    data: {
      corrections,
      feedback: "Use there are for plural nouns and there is for singular nouns.",
      isCorrect: false,
      keyPoints: [{ met, text: "Describe your home" }],
      method: "model",
      score: met ? 1 : 0,
      spelling: null,
    },
    provenance: null,
    systemPrompt: "",
    usage: null,
    userPrompt: "",
  });

  const result = await checkLessonStep({
    input: {
      answer: { kind: "typedAnswer", text: answer },
      durationMs: 60_000,
      runId: run.id,
      timeZone: "America/Sao_Paulo",
    },
    stepId: step.id,
  });

  expect(result).toMatchObject({ result: { savedMistake: true }, status: "checked" });
  await flush();
  return listCurrentUserMistakes(mistakeListInputSchema.parse({}));
}

describe("language writing in the mistakes notebook", () => {
  it.each([true, false])(
    "keeps the corrected description when form key points are met: %s",
    async (met) => {
      const notebook = await writeAnswer({ met });

      expect(notebook).toMatchObject({
        mistakes: [{ snapshot: { answer: ANSWER, correctAnswer: CORRECTED } }],
        status: "ready",
      });
    },
  );

  it.each(["new", "solid"] as const)(
    "does not invent a cause for a %s learner's writing mistake",
    async (state) => {
      const notebook = await writeAnswer({ state });
      expect(notebook).toMatchObject({ mistakes: [{ cause: null }] });
      expect(classifyMistakeCause).not.toHaveBeenCalled();
    },
  );

  it.each([
    { corrections: [], met: false },
    { corrections: [{ right: "There are", wrong: "words not in the answer" }], met: true },
    { corrections: [{ right: "There are", wrong: "" }], met: true },
    { corrections: [{ right: "are", wrong: "There" }], met: true },
    {
      corrections: [
        { right: "There are", wrong: "There is two bedrooms" },
        { right: "bedroom", wrong: "bedrooms" },
      ],
      met: true,
    },
  ])("does not call a sample or an ambiguous correction the right answer: %j", async (grade) => {
    const notebook = await writeAnswer(grade);
    expect(notebook).toMatchObject({ mistakes: [{ snapshot: { correctAnswer: null } }] });
  });

  it("keeps the sample and existing cause behavior for non-language typed answers", async () => {
    const notebook = await writeAnswer({ corrections: [], language: false, met: false });

    expect(notebook).toMatchObject({
      mistakes: [{ cause: "misread", snapshot: { correctAnswer: SAMPLE } }],
    });
  });
});
