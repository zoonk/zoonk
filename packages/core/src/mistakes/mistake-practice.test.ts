import { classifyMistakeCause } from "@zoonk/ai/tasks/v2/mistakes/cause";
import { prisma } from "@zoonk/db";
import { learnerSkillFixture, mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { after } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { answerMistakePractice } from "./answer-mistake-practice";
import { getMistakePractice } from "./get-mistake-practice";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

// The classifier is a paid model call; its behavior is covered by its eval.
vi.mock("@zoonk/ai/tasks/v2/mistakes/cause", () => ({ classifyMistakeCause: vi.fn() }));

const deferred: Promise<unknown>[] = [];
const YESTERDAY = new Date(Date.now() - 86_400_000);

async function setup() {
  const [user, skill] = await Promise.all([userFixture(), skillFixture()]);

  const [original, extra, lesson] = await Promise.all([
    itemFixture({ content: choiceItemContent(), skillId: skill.id }),
    itemFixture({ content: choiceItemContent(), skillId: skill.id }),
    libraryLessonFixture(),
  ]);

  await lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id });
  mockSession(user.id);

  return { extra, lesson, original, skill, user };
}

describe(getMistakePractice, () => {
  it("builds a drill per mistake from earlier days, the original question first", async () => {
    const { extra, lesson, original, skill, user } = await setup();

    const [mistake] = await Promise.all([
      mistakeFixture({
        cause: "gap",
        createdAt: YESTERDAY,
        itemId: original.id,
        skillId: skill.id,
        userId: user.id,
      }),
      mistakeFixture({
        cause: "trap",
        createdAt: new Date(),
        itemId: extra.id,
        skillId: skill.id,
        userId: user.id,
      }),
    ]);

    const result = await getMistakePractice({ timeZone: "UTC" });

    expect(result.status === "ready" && result.practice).toHaveLength(1);

    expect(result.status === "ready" && result.practice[0]).toMatchObject({
      cause: "gap",
      drill: {
        kind: "reteach",
        lesson: { id: lesson.id, ideas: [], title: lesson.title },
        timeLimitSeconds: null,
      },
      mistakeId: mistake.id,
    });

    expect(
      result.status === "ready" && result.practice[0]?.questions.map((question) => question.itemId),
    ).toStrictEqual([original.id, extra.id]);

    expect(JSON.stringify(result)).not.toContain("isCorrect");
  });

  it("goes over a lesson the learner can open, with its summary, before a gap's questions", async () => {
    const { original, skill, user } = await setup();
    const owner = await userFixture();

    const [hidden, shared] = await Promise.all([
      libraryLessonFixture({ ownerId: owner.id, visibility: "private" }),
      libraryLessonFixture({ summary: { ideas: [{ text: "Series resistors add up." }] } }),
    ]);

    await prisma.lessonSkill.deleteMany({ where: { skillId: skill.id } });
    await lessonSkillFixture({ lessonId: hidden.id, skillId: skill.id });
    await lessonSkillFixture({ lessonId: shared.id, skillId: skill.id });

    await mistakeFixture({
      cause: "gap",
      createdAt: YESTERDAY,
      itemId: original.id,
      skillId: skill.id,
      userId: user.id,
    });

    const result = await getMistakePractice({ timeZone: "UTC" });

    expect(result.status === "ready" && result.practice[0]?.drill.lesson).toStrictEqual({
      id: shared.id,
      ideas: ["Series resistors add up."],
      title: shared.title,
    });
  });

  it("times each question of a drill for a mistake made by running out of time", async () => {
    const { original, skill, user } = await setup();

    await mistakeFixture({
      cause: "time",
      createdAt: YESTERDAY,
      itemId: original.id,
      skillId: skill.id,
      userId: user.id,
    });

    const result = await getMistakePractice({ timeZone: "UTC" });

    expect(result.status === "ready" && result.practice[0]?.drill).toStrictEqual({
      kind: "timed",
      lesson: null,
      timeLimitSeconds: 45,
    });
  });
});

describe(answerMistakePractice, () => {
  beforeEach(() => {
    deferred.length = 0;

    vi.mocked(after).mockImplementation((task) => {
      deferred.push(typeof task === "function" ? Promise.resolve(task()) : task);
    });
  });

  it("fixes a mistake answered right on a later day", async () => {
    const { original, skill, user } = await setup();

    const mistake = await mistakeFixture({
      createdAt: YESTERDAY,
      itemId: original.id,
      skillId: skill.id,
      userId: user.id,
    });

    const result = await answerMistakePractice({
      input: {
        answer: { selectedIndex: 0 },
        durationMs: 9000,
        itemId: original.id,
        timeZone: "UTC",
      },
      mistakeId: mistake.id,
    });

    expect(result).toStrictEqual({
      feedback: {
        answerId: expect.any(String),
        correctAnswer: { selectedIndex: 0 },
        explanation: "It follows the rule.",
        isCorrect: true,
        mistakeStatus: "fixed",
        trap: null,
      },
      status: "ready",
    });

    await expect(
      prisma.mistake.findUniqueOrThrow({ where: { id: mistake.id } }),
    ).resolves.toMatchObject({ status: "fixed" });
  });

  it("fixes the drilled mistake through another question on its skill", async () => {
    const { extra, original, skill, user } = await setup();

    const mistake = await mistakeFixture({
      createdAt: YESTERDAY,
      itemId: original.id,
      skillId: skill.id,
      userId: user.id,
    });

    const result = await answerMistakePractice({
      input: { answer: { selectedIndex: 0 }, durationMs: 9000, itemId: extra.id },
      mistakeId: mistake.id,
    });

    expect(result.status === "ready" && result.feedback.mistakeStatus).toBe("fixed");
  });

  it("names an ambiguous cause after the response, with the classifier", async () => {
    const { extra, original, skill, user } = await setup();

    const mistake = await mistakeFixture({
      createdAt: YESTERDAY,
      itemId: original.id,
      skillId: skill.id,
      userId: user.id,
    });

    await learnerSkillFixture({
      difficulty: 5,
      lastReviewedAt: YESTERDAY,
      reps: 4,
      skillId: skill.id,
      stability: 3,
      state: "learning",
      userId: user.id,
    });

    await Promise.all(
      [true, false, true, true].map((isCorrect, index) =>
        prisma.attempt.create({
          data: {
            answer: {},
            durationMs: 9000,
            hour: 10,
            isCorrect,
            localDate: new Date("2026-09-01"),
            skillId: skill.id,
            userId: user.id,
            weekday: index,
          },
        }),
      ),
    );

    vi.mocked(classifyMistakeCause).mockResolvedValue({
      data: { cause: "trap" },
      provenance: {} as never,
      systemPrompt: "",
      usage: {} as never,
      userPrompt: "",
    });

    const result = await answerMistakePractice({
      input: { answer: { selectedIndex: 1 }, durationMs: 9000, itemId: extra.id },
      mistakeId: mistake.id,
    });

    await Promise.all(deferred);

    expect(result.status === "ready" && result.feedback).toMatchObject({
      isCorrect: false,
      mistakeStatus: "open",
    });

    expect(classifyMistakeCause).toHaveBeenCalledWith(
      expect.objectContaining({
        learnerAnswer: "Wrong answer",
        misconception: "Applies the rule backwards",
      }),
    );

    const added = await prisma.mistake.findFirstOrThrow({
      where: { itemId: extra.id, userId: user.id },
    });

    expect(added.cause).toBe("trap");
  });

  it("counts an answer that takes a timed drill's whole time box as wrong, run out of time", async () => {
    const { extra, original, skill, user } = await setup();

    const mistake = await mistakeFixture({
      cause: "time",
      createdAt: YESTERDAY,
      itemId: original.id,
      skillId: skill.id,
      userId: user.id,
    });

    const late = await answerMistakePractice({
      input: { answer: { selectedIndex: 0 }, durationMs: 45_000, itemId: original.id },
      mistakeId: mistake.id,
    });

    expect(late.status === "ready" && late.feedback).toMatchObject({
      isCorrect: false,
      mistakeStatus: "open",
    });

    await answerMistakePractice({
      input: { answer: { dontKnow: true }, durationMs: 45_000, itemId: extra.id },
      mistakeId: mistake.id,
    });

    await expect(
      prisma.mistake.findFirstOrThrow({ where: { itemId: extra.id, userId: user.id } }),
    ).resolves.toMatchObject({ cause: "time" });
  });

  it("names the trap after every answer in a trap drill", async () => {
    const { extra, original, skill, user } = await setup();

    const mistake = await mistakeFixture({
      cause: "trap",
      createdAt: YESTERDAY,
      itemId: original.id,
      skillId: skill.id,
      userId: user.id,
    });

    const [right, wrong] = await Promise.all([
      answerMistakePractice({
        input: { answer: { selectedIndex: 0 }, durationMs: 9000, itemId: original.id },
        mistakeId: mistake.id,
      }),
      answerMistakePractice({
        input: { answer: { selectedIndex: 1 }, durationMs: 9000, itemId: extra.id },
        mistakeId: mistake.id,
      }),
    ]);

    expect(right.status === "ready" && right.feedback.trap).toBe("Applies the rule backwards");
    expect(wrong.status === "ready" && wrong.feedback.trap).toBe("Applies the rule backwards");
  });

  it("only accepts questions on the mistake's skill", async () => {
    const { original, skill, user } = await setup();

    const mistake = await mistakeFixture({
      itemId: original.id,
      skillId: skill.id,
      userId: user.id,
    });

    const otherSkill = await skillFixture();
    const otherItem = await itemFixture({ content: choiceItemContent(), skillId: otherSkill.id });

    const result = await answerMistakePractice({
      input: { answer: { selectedIndex: 0 }, durationMs: 9000, itemId: otherItem.id },
      mistakeId: mistake.id,
    });

    expect(result).toStrictEqual({ status: "invalidItem" });
  });

  it("hides another learner's mistake", async () => {
    const { original, skill } = await setup();
    const other = await userFixture();

    const mistake = await mistakeFixture({
      itemId: original.id,
      skillId: skill.id,
      userId: other.id,
    });

    const result = await answerMistakePractice({
      input: { answer: { selectedIndex: 0 }, durationMs: 9000, itemId: original.id },
      mistakeId: mistake.id,
    });

    expect(result).toStrictEqual({ status: "notFound" });
  });
});
