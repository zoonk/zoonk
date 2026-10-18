import { prisma } from "@zoonk/db";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { finishMock } from "./finish-mock";
import { getMock } from "./get-mock";
import { saveMockAnswer } from "./save-mock-answer";
import { submitMockSection } from "./submit-mock-section";

const NOW = new Date("2026-10-13T12:00:00.000Z");
const MINUTE_MS = 60_000;

async function textSitting(format: "typed" | "essay") {
  const [user, skill] = await Promise.all([userFixture(), skillFixture()]);

  const content = {
    acceptedAnswers: ["went"],
    context: null,
    keyPoints: ["Uses the past tense"],
    question: "Describe what happened yesterday.",
    rubric: [
      { criterion: "Clarity", description: "A clear account" },
      { criterion: "Sequence", description: "Events follow a logical order" },
    ],
    sampleAnswer: "went",
    sampleOutline: "Describe the events in order.",
  };

  const items = await Promise.all([
    itemFixture({ content, format, skillId: skill.id }),
    itemFixture({ content, format, skillId: skill.id }),
  ]);

  const itemIds = items.map((item) => item.id);

  const mock = await prisma.mockExam.create({
    data: {
      conditions: {
        day: null,
        fullLength: true,
        purpose: "practice",
        scoring: "raw",
        sections: [
          {
            essays: format === "essay" ? itemIds : [],
            itemIds: format === "typed" ? itemIds : [],
            minutes: 1,
            name: "Written answers",
            questions: format === "typed" ? 2 : 0,
            routing: null,
          },
        ],
        startTime: null,
        timeZone: null,
      },
      sectionStartedAt: NOW,
      startedAt: NOW,
      userId: user.id,
    },
  });

  mockSession(user.id);

  const save = (text: string) =>
    saveMockAnswer({
      blockId: mock.id,
      input: { answer: { text }, durationMs: 5000, flagged: false, itemId: items[0].id },
    });

  return { mock, save, user };
}

describe("cleared text in an abandoned mock", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it.each([
    { format: "typed", text: "" },
    { format: "typed", text: "   " },
    { format: "essay", text: "" },
    { format: "essay", text: "   " },
  ] as const)(
    "leaves a cleared $format draft ($text) unanswered and unscored",
    async ({ format, text }) => {
      const { mock, save, user } = await textSitting(format);

      await expect(save("An answer I changed my mind about.")).resolves.toStrictEqual({
        status: "saved",
      });

      await expect(save(text)).resolves.toStrictEqual({ status: "saved" });

      const draft = await prisma.mockExamAnswer.findFirstOrThrow({
        where: { mockExamId: mock.id },
      });

      expect(draft.answer).toStrictEqual({ text });

      vi.setSystemTime(new Date(NOW.getTime() + 12 * MINUTE_MS));
      await expect(getMock(mock.id)).resolves.toMatchObject({ mock: { status: "expired" } });

      await expect(
        submitMockSection({ blockId: mock.id, input: {}, section: 0 }),
      ).resolves.toStrictEqual({ status: "expired" });

      await expect(finishMock({ blockId: mock.id, input: {} })).resolves.toStrictEqual({
        status: "expired",
      });

      await expect(prisma.attempt.count({ where: { userId: user.id } })).resolves.toBe(0);
      await expect(prisma.learningEvent.count({ where: { userId: user.id } })).resolves.toBe(0);

      await expect(
        prisma.mockExam.findUniqueOrThrow({ where: { id: mock.id } }),
      ).resolves.toMatchObject({ finishedAt: null, result: null });
    },
  );

  it.each(["typed", "essay"] as const)(
    "keeps a %s sitting with half its answers genuinely written",
    async (format) => {
      const { mock, save } = await textSitting(format);
      await expect(save("  A real answer.  ")).resolves.toStrictEqual({ status: "saved" });
      vi.setSystemTime(new Date(NOW.getTime() + 12 * MINUTE_MS));
      await expect(getMock(mock.id)).resolves.toMatchObject({ mock: { status: "running" } });
    },
  );
});
