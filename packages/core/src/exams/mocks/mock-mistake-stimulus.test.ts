import { gradeTypedAnswer } from "@zoonk/ai/tasks/v2/grading/grade-typed-answer";
import { prisma } from "@zoonk/db";
import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { listeningContent, listeningSetFixture } from "@zoonk/testing/fixtures/listening";
import { choiceItemContent, itemSetFixture } from "@zoonk/testing/fixtures/skills";
import { describe, expect, it, vi } from "vitest";
import { freezeClock } from "../../_test-utils/frozen-clock";
import { thirdsMath, thirdsQuestion } from "../../library/items/_test-utils/math-problems";
import { mistakeListInputSchema } from "../../mistakes/contract";
import { listCurrentUserMistakes } from "../../mistakes/list-current-user-mistakes";
import { runningMock, scheduledMockSetup } from "./_test-utils/scheduled-mock";
import { finishMock } from "./finish-mock";
import { type MockAnswer } from "./mock-answer-contract";
import { saveMockAnswer } from "./save-mock-answer";
import { startMock } from "./start-mock";

const CONTEXT = "A tree casts a 12 m shadow while a 2 m post casts a 3 m shadow.";

type SnapshotFormat = "multipleChoice" | "numeric" | "trueFalse" | "typed";

const VISUAL = {
  events: [
    { date: "09:00", detail: null, label: "Measure the post" },
    { date: "09:05", detail: null, label: "Measure the tree" },
  ],
  kind: "timeline" as const,
  title: "Shadow measurements",
};

function supplyWrongTypedVerdict() {
  vi.mocked(gradeTypedAnswer).mockResolvedValue({
    data: {
      corrections: [],
      feedback: "The answer does not match the question's key point.",
      isCorrect: false,
      keyPoints: [{ met: false, text: "Uses the right proportion" }],
      method: "model",
      score: 0,
      spelling: null,
    },
    provenance: null,
    systemPrompt: "",
    usage: null,
    userPrompt: "",
  });
}

function stimulusQuestion(format: SnapshotFormat) {
  const question = "What is the estimated height of the tree?";

  const support = {
    context: CONTEXT,
    image: { alt: "A tree and a post with their shadows", prompt: "Tree and post shadows" },
    visual: VISUAL,
  };

  if (format === "numeric") {
    return {
      context: "The pizza has {slices} equal slices.",
      entry: { kind: "number", places: null },
      math: thirdsMath,
      otherSolutions: [],
      question: thirdsQuestion,
    };
  }

  if (format === "trueFalse") {
    return {
      ...support,
      isTrue: true,
      misconception: "Confuses heights and shadows",
      reason: "The ratios are equal",
      statement: question,
    };
  }

  if (format === "typed") {
    return {
      ...support,
      acceptedAnswers: ["8 m"],
      keyPoints: ["Uses the right proportion"],
      question,
      sampleAnswer: "8 m",
    };
  }

  return { ...choiceItemContent(question), ...support };
}

function wrongSnapshotAnswer(format: SnapshotFormat): MockAnswer {
  if (format === "numeric") {
    return { number: 0 };
  }

  if (format === "typed") {
    return { text: "12 m" };
  }

  return format === "multipleChoice" ? { selectedIndex: 1 } : { isTrue: false };
}

describe("a mock mistake's saved stimulus", () => {
  it.each(["multipleChoice", "trueFalse", "typed", "numeric"] as const)(
    "keeps a %s question's displayed stimulus and shared passage after content is deleted",
    async (format) => {
      freezeClock();
      supplyWrongTypedVerdict();
      const { blockId, goal, user } = await scheduledMockSetup();
      await startMock({ blockId, input: {} });
      const mock = await runningMock(blockId);
      const itemId = mock.current?.questions[0]?.itemId;

      if (!itemId) {
        throw new Error("Expected the mock's first question");
      }

      const [picture, set] = await Promise.all([
        mediaAssetFixture({ height: 200, width: 300 }),
        itemSetFixture({
          content: { source: "A field notebook", text: CONTEXT, title: "Shadows" },
        }),
      ]);

      await prisma.item.update({
        data: {
          content: stimulusQuestion(format),
          format,
          mediaAssetId: picture.id,
          setId: set.id,
          setPosition: 0,
        },
        where: { id: itemId },
      });

      const withStimulus = await runningMock(blockId);

      const shown = withStimulus.current?.questions.find((question) => question.itemId === itemId);

      if (!shown) {
        throw new Error("Expected the question with its stimulus");
      }

      await saveMockAnswer({
        blockId,
        input: { answer: wrongSnapshotAnswer(format), durationMs: 30_000, flagged: false, itemId },
      });

      await expect(finishMock({ blockId, input: { timeZone: "UTC" } })).resolves.toStrictEqual({
        status: "finished",
      });

      const saved = await prisma.mistake.findFirstOrThrow({ where: { itemId, userId: user.id } });

      const stimulus = {
        context: shown.context,
        ...(shown.image ? { image: shown.image } : {}),
        question: shown.question,
        set: {
          count: 1,
          id: set.id,
          kind: "text",
          listening: null,
          position: 0,
          source: "A field notebook",
          text: CONTEXT,
          title: "Shadows",
          visual: null,
        },
        ...(shown.visual ? { visual: shown.visual } : {}),
      };

      expect(saved.snapshot).toMatchObject(stimulus);

      await prisma.item.delete({ where: { id: itemId } });
      await prisma.itemSet.delete({ where: { id: set.id } });

      const notebook = await listCurrentUserMistakes(
        mistakeListInputSchema.parse({ goalId: goal.id }),
      );

      expect(
        notebook.status === "ready" &&
          notebook.mistakes.find((mistake) => mistake.id === saved.id)?.snapshot,
      ).toMatchObject(stimulus);
    },
  );

  it.each(["multipleChoice", "typed"] as const)(
    "keeps a %s recording mistake's revealed transcript while the running mock hides it",
    async (format) => {
      freezeClock();
      supplyWrongTypedVerdict();
      const { blockId, goal, user } = await scheduledMockSetup();
      await startMock({ blockId, input: {} });
      const running = await runningMock(blockId);
      const itemId = running.current?.questions[0]?.itemId;

      if (!itemId) {
        throw new Error("Expected the mock's first question");
      }

      const audio = await mediaAssetFixture({ durationMs: 3000, kind: "audio" });
      const content = listeningContent({ uniqueLine: "My booking number is 1234." });
      const set = await listeningSetFixture({ content, mediaAssetId: audio.id });

      await prisma.item.update({
        data: { content: stimulusQuestion(format), format, setId: set.id, setPosition: 0 },
        where: { id: itemId },
      });

      const withStimulus = await runningMock(blockId);

      const shown = withStimulus.current?.questions.find((question) => question.itemId === itemId);

      expect(shown?.set?.listening?.transcript).toBeNull();

      await saveMockAnswer({
        blockId,
        input: { answer: wrongSnapshotAnswer(format), durationMs: 30_000, flagged: false, itemId },
      });

      await finishMock({ blockId, input: { timeZone: "UTC" } });
      const saved = await prisma.mistake.findFirstOrThrow({ where: { itemId, userId: user.id } });

      const transcript = content.script.turns.map((turn) => ({
        speaker: turn.speaker,
        text: turn.text,
      }));

      const support = { set: { listening: { audio: { url: audio.url }, transcript } } };
      expect(saved.snapshot).toMatchObject(support);

      await prisma.item.delete({ where: { id: itemId } });
      await prisma.itemSet.delete({ where: { id: set.id } });

      const notebook = await listCurrentUserMistakes(
        mistakeListInputSchema.parse({ goalId: goal.id }),
      );

      expect(
        notebook.status === "ready" &&
          notebook.mistakes.find((entry) => entry.id === saved.id)?.snapshot,
      ).toMatchObject(support);
    },
  );
});
