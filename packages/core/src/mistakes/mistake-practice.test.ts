import { classifyMistakeCause } from "@zoonk/ai/tasks/mistakes/cause";
import { prisma } from "@zoonk/db";
import { learnerSkillFixture, mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import {
  choiceItemContent,
  itemFixture,
  itemSetFixture,
  skillFixture,
  textSetContent,
} from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { after } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { freezeClock } from "../_test-utils/frozen-clock";
import { mockSession } from "../_test-utils/mock-session";
import { listFollowUps } from "../follow-ups/follow-up-rows";
import { learnerGoalFixture } from "../learner/_test-utils/learner-goal";
import { answerMistakePractice } from "./answer-mistake-practice";
import { MAX_PRACTICE_ANSWERS } from "./contract";
import { getMistakePractice } from "./get-mistake-practice";
import { resolveMistakeCause } from "./resolve-mistake-cause";

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

async function withoutOwnQuestion() {
  const { extra, original, skill, user } = await setup();

  const practiced = await mistakeFixture({
    createdAt: YESTERDAY,
    skillId: skill.id,
    userId: user.id,
  });

  const covered = await mistakeFixture({
    createdAt: YESTERDAY,
    skillId: skill.id,
    userId: user.id,
  });

  return { covered, extra, original, practiced, skill, user };
}

function fixedIds(result: Awaited<ReturnType<typeof answerMistakePractice>>) {
  return result.status === "ready" ? result.feedback.fixedMistakeIds.toSorted() : null;
}

describe(getMistakePractice, () => {
  it("keeps the saved context and visual beside a practice after the live question changes", async () => {
    const { original, skill, user } = await setup();
    const context = "A tree casts a 12 m shadow while a 2 m post casts a 3 m shadow.";

    const visual = {
      events: [
        { date: "09:00", detail: null, label: "Measure the post" },
        { date: "09:05", detail: null, label: "Measure the tree" },
      ],
      kind: "timeline",
      title: "Shadow measurements",
    };

    await mistakeFixture({
      cause: "gap",
      createdAt: YESTERDAY,
      itemId: original.id,
      skillId: skill.id,
      snapshot: { answer: "Wrong answer", context, question: "What is the tree's height?", visual },
      userId: user.id,
    });

    const result = await getMistakePractice({ timeZone: "UTC" });

    expect(result.status === "ready" && result.practice[0]?.snapshot).toMatchObject({
      context,
      visual,
    });

    expect(result.status === "ready" && result.practice[0]?.questions[0]?.context).toBeNull();
  });

  it("builds a drill per mistake from earlier days, with its own question", async () => {
    freezeClock();

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
    ).toStrictEqual([original.id]);

    expect(JSON.stringify(result)).not.toContain("isCorrect");
  });

  it("drills a mistake with its skill's other questions once a fix retires the original", async () => {
    const { extra, original, skill, user } = await setup();

    await Promise.all([
      prisma.item.update({ data: { retiredAt: new Date() }, where: { id: original.id } }),
      mistakeFixture({
        createdAt: YESTERDAY,
        itemId: original.id,
        skillId: skill.id,
        userId: user.id,
      }),
    ]);

    const result = await getMistakePractice({ timeZone: "UTC" });

    expect(
      result.status === "ready" && result.practice[0]?.questions.map((question) => question.itemId),
    ).toStrictEqual([extra.id]);
  });

  it("shows the picture of a question about a figure, with the writer's alt text", async () => {
    const { skill, user } = await setup();
    const picture = await mediaAssetFixture({ height: 1024, width: 1536 });

    const image = {
      alt: "A circuit with two resistors in series.",
      prompt: "Two resistors in series",
    };

    const pictured = await itemFixture({
      content: { ...choiceItemContent("Which resistor gets more voltage?"), image },
      mediaAssetId: picture.id,
      skillId: skill.id,
    });

    await mistakeFixture({
      cause: "gap",
      createdAt: YESTERDAY,
      itemId: pictured.id,
      skillId: skill.id,
      userId: user.id,
    });

    const result = await getMistakePractice({ timeZone: "UTC" });
    const questions = result.status === "ready" ? (result.practice[0]?.questions ?? []) : [];

    expect(questions.map((question) => [question.itemId, question.image])).toStrictEqual([
      [pictured.id, { alt: image.alt, height: 1024, url: picture.url, width: 1536 }],
    ]);
  });

  it("brings a passage question's mistake back with its passage, and only that question of it", async () => {
    const { skill, user } = await setup();
    const passage = textSetContent("The Sunday library");
    const set = await itemSetFixture({ content: passage });

    const [, missed] = await Promise.all([
      itemFixture({
        content: choiceItemContent(),
        setId: set.id,
        setPosition: 0,
        skillId: skill.id,
      }),
      itemFixture({
        content: choiceItemContent(),
        setId: set.id,
        setPosition: 1,
        skillId: skill.id,
      }),
    ]);

    await mistakeFixture({
      cause: "gap",
      createdAt: YESTERDAY,
      itemId: missed?.id,
      skillId: skill.id,
      userId: user.id,
    });

    const result = await getMistakePractice({ timeZone: "UTC" });
    const questions = result.status === "ready" ? (result.practice[0]?.questions ?? []) : [];

    expect(
      questions.map((question) => [question.itemId, question.set?.text ?? null]),
    ).toStrictEqual([[missed?.id, passage.text]]);

    expect(questions[0]?.set).toMatchObject({ count: 2, position: 1, title: "The Sunday library" });
  });

  it("keeps a passage question for its own mistake's drill, never another mistake's", async () => {
    const { original, skill, user } = await setup();
    const set = await itemSetFixture({ content: textSetContent("The Sunday library") });

    const missed = await itemFixture({
      content: choiceItemContent(),
      setId: set.id,
      setPosition: 0,
      skillId: skill.id,
    });

    const [passageMistake, plainMistake] = await Promise.all([
      mistakeFixture({
        cause: "gap",
        createdAt: YESTERDAY,
        itemId: missed.id,
        skillId: skill.id,
        userId: user.id,
      }),
      mistakeFixture({
        cause: "gap",
        createdAt: YESTERDAY,
        itemId: original.id,
        skillId: skill.id,
        userId: user.id,
      }),
    ]);

    const result = await getMistakePractice({ timeZone: "UTC" });
    const practice = result.status === "ready" ? result.practice : [];

    const questionsOf = (mistakeId: string) =>
      practice
        .find((entry) => entry.mistakeId === mistakeId)
        ?.questions.map((question) => question.itemId);

    expect(questionsOf(passageMistake.id)).toStrictEqual([missed.id]);
    expect(questionsOf(plainMistake.id)).toStrictEqual([original.id]);
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

  it("practices one skill's mistakes, only from the goal's skills", async () => {
    const { original, skill, user } = await setup();
    const { goal, skills } = await learnerGoalFixture({ phases: [1], userId: user.id });
    const [goalSkill] = skills as [(typeof skills)[number]];
    const goalItem = await itemFixture({ content: choiceItemContent(), skillId: goalSkill.id });

    const [inSkill] = await Promise.all([
      mistakeFixture({
        cause: "trap",
        createdAt: YESTERDAY,
        itemId: goalItem.id,
        skillId: goalSkill.id,
        userId: user.id,
      }),
      mistakeFixture({
        cause: "trap",
        createdAt: YESTERDAY,
        itemId: original.id,
        skillId: skill.id,
        userId: user.id,
      }),
    ]);

    const [practiced, outsideGoal] = await Promise.all([
      getMistakePractice({ goalId: goal.id, skillId: goalSkill.id, timeZone: "UTC" }),
      getMistakePractice({ goalId: goal.id, skillId: skill.id, timeZone: "UTC" }),
    ]);

    expect(
      practiced.status === "ready" && practiced.practice.map((entry) => entry.mistakeId),
    ).toStrictEqual([inSkill.id]);

    expect(outsideGoal.status === "ready" && outsideGoal.practice).toStrictEqual([]);
  });

  it("practices a miss on a finer skill a goal lesson teaches, with its goal skill's questions", async () => {
    const user = await userFixture();
    mockSession(user.id);

    const { goal, planItems } = await learnerGoalFixture({ phases: [1], userId: user.id });
    const [finer, lesson] = await Promise.all([skillFixture(), libraryLessonFixture()]);

    await Promise.all([
      lessonSkillFixture({ lessonId: lesson.id, skillId: finer.id }),
      prisma.planItem.update({ data: { lessonId: lesson.id }, where: { id: planItems[0]?.id } }),
    ]);

    const miss = await mistakeFixture({
      cause: "gap",
      createdAt: YESTERDAY,
      skillId: finer.id,
      userId: user.id,
    });

    const result = await getMistakePractice({ goalId: goal.id, timeZone: "UTC" });

    expect(
      result.status === "ready" && result.practice.map((entry) => entry.mistakeId),
    ).toStrictEqual([miss.id]);

    const question = result.status === "ready" ? result.practice[0]?.questions[0] : undefined;

    const answered = await answerMistakePractice({
      input: { answer: { selectedIndex: 0 }, durationMs: 9000, itemId: question?.itemId ?? "" },
      mistakeId: miss.id,
    });

    expect(answered.status === "ready" && answered.feedback.mistakeStatus).toBe("fixed");
  });

  it("brings every ready mistake with its own question, past the old limit of five", async () => {
    const [user, skill] = await Promise.all([userFixture(), skillFixture()]);
    mockSession(user.id);

    const mistakes = await Promise.all(
      Array.from({ length: 7 }, async () => {
        const item = await itemFixture({ content: choiceItemContent(), skillId: skill.id });

        return mistakeFixture({
          cause: "gap",
          createdAt: YESTERDAY,
          itemId: item.id,
          skillId: skill.id,
          userId: user.id,
        });
      }),
    );

    const result = await getMistakePractice({ timeZone: "UTC" });
    const practice = result.status === "ready" ? result.practice : [];

    const asked = (mistakeId: string) =>
      practice
        .find((entry) => entry.mistakeId === mistakeId)
        ?.questions.map((question) => question.itemId);

    expect(practice).toHaveLength(mistakes.length);

    expect(mistakes.map((mistake) => asked(mistake.id))).toStrictEqual(
      mistakes.map((mistake) => [mistake.itemId]),
    );
  });

  it("stops a run at what its answers can hold, leaving the rest for the next", async () => {
    const [user, skill] = await Promise.all([userFixture(), skillFixture()]);
    mockSession(user.id);

    await Promise.all(
      Array.from({ length: MAX_PRACTICE_ANSWERS + 1 }, async () => {
        const item = await itemFixture({ content: choiceItemContent(), skillId: skill.id });

        return mistakeFixture({
          createdAt: YESTERDAY,
          itemId: item.id,
          skillId: skill.id,
          userId: user.id,
        });
      }),
    );

    const result = await getMistakePractice({ timeZone: "UTC" });

    expect(result.status === "ready" && result.practice).toHaveLength(MAX_PRACTICE_ANSWERS);
  });

  it("asks a skill's only question once when several mistakes have no question of their own", async () => {
    const [user, skill] = await Promise.all([userFixture(), skillFixture()]);
    mockSession(user.id);

    const only = await itemFixture({ content: choiceItemContent(), skillId: skill.id });

    await Promise.all(
      Array.from({ length: 3 }, () =>
        mistakeFixture({
          cause: "misread",
          createdAt: YESTERDAY,
          skillId: skill.id,
          userId: user.id,
        }),
      ),
    );

    const result = await getMistakePractice({ timeZone: "UTC" });
    const practice = result.status === "ready" ? result.practice : [];

    expect(
      practice.flatMap((entry) => entry.questions.map((question) => question.itemId)),
    ).toStrictEqual([only.id]);
  });

  it("never asks a goal skill's question twice for misses on the finer skills its lesson teaches", async () => {
    const user = await userFixture();
    mockSession(user.id);

    const { goal, planItems } = await learnerGoalFixture({ phases: [1], userId: user.id });

    const [first, second, lesson] = await Promise.all([
      skillFixture(),
      skillFixture(),
      libraryLessonFixture(),
    ]);

    await Promise.all([
      lessonSkillFixture({ lessonId: lesson.id, skillId: first.id }),
      lessonSkillFixture({ lessonId: lesson.id, skillId: second.id }),
      prisma.planItem.update({ data: { lessonId: lesson.id }, where: { id: planItems[0]?.id } }),
    ]);

    await Promise.all(
      [first.id, second.id, first.id, second.id].map((skillId) =>
        mistakeFixture({ cause: "misread", createdAt: YESTERDAY, skillId, userId: user.id }),
      ),
    );

    const result = await getMistakePractice({ goalId: goal.id, timeZone: "UTC" });
    const practice = result.status === "ready" ? result.practice : [];
    const asked = practice.flatMap((entry) => entry.questions.map((question) => question.itemId));

    expect(asked.length).toBeGreaterThan(0);
    expect(new Set(asked).size).toBe(asked.length);
  });

  it("goes over a lesson's idea once when several of its mistakes are in the run", async () => {
    const { extra, lesson, original, skill, user } = await setup();

    await Promise.all(
      [original.id, extra.id].map((itemId) =>
        mistakeFixture({
          cause: "gap",
          createdAt: YESTERDAY,
          itemId,
          skillId: skill.id,
          userId: user.id,
        }),
      ),
    );

    const result = await getMistakePractice({ timeZone: "UTC" });
    const practice = result.status === "ready" ? result.practice : [];

    expect(practice.map((entry) => entry.drill.lesson?.id ?? null)).toStrictEqual([
      lesson.id,
      null,
    ]);
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

  it("keeps a don't-know practice open as a gap without inventing a trap", async () => {
    const { original, skill, user } = await setup();

    const mistake = await mistakeFixture({
      cause: "trap",
      createdAt: YESTERDAY,
      itemId: original.id,
      skillId: skill.id,
      userId: user.id,
    });

    await learnerSkillFixture({ skillId: skill.id, state: "solid", userId: user.id });

    const result = await answerMistakePractice({
      input: { answer: { dontKnow: true }, durationMs: 100, itemId: original.id, timeZone: "UTC" },
      mistakeId: mistake.id,
    });

    expect(result).toMatchObject({
      feedback: { fixed: false, isCorrect: false, mistakeStatus: "open", trap: null },
      status: "ready",
    });

    await expect(
      prisma.mistake.findUniqueOrThrow({ where: { id: mistake.id } }),
    ).resolves.toMatchObject({ cause: "gap", fixedAt: null, status: "open" });

    expect(classifyMistakeCause).not.toHaveBeenCalled();
  });

  it("announces a fix only for the answer that fixed the notebook entry", async () => {
    const { original, extra, skill, user } = await setup();

    const mistake = await mistakeFixture({
      createdAt: YESTERDAY,
      itemId: original.id,
      skillId: skill.id,
      userId: user.id,
    });

    const first = await answerMistakePractice({
      input: { answer: { selectedIndex: 0 }, durationMs: 9000, itemId: original.id },
      mistakeId: mistake.id,
    });

    const next = await answerMistakePractice({
      input: { answer: { selectedIndex: 0 }, durationMs: 9000, itemId: extra.id },
      mistakeId: mistake.id,
    });

    expect(first).toMatchObject({ feedback: { fixed: true, mistakeStatus: "fixed" } });
    expect(next).toMatchObject({ feedback: { fixed: false, mistakeStatus: "fixed" } });
  });

  it("returns a previously fixed drill entry to the notebook when the learner does not know another question", async () => {
    const { original, extra, skill, user } = await setup();

    const mistake = await mistakeFixture({
      createdAt: YESTERDAY,
      itemId: original.id,
      skillId: skill.id,
      userId: user.id,
    });

    await answerMistakePractice({
      input: { answer: { selectedIndex: 0 }, durationMs: 9000, itemId: original.id },
      mistakeId: mistake.id,
    });

    const result = await answerMistakePractice({
      input: { answer: { dontKnow: true }, durationMs: 9000, itemId: extra.id },
      mistakeId: mistake.id,
    });

    expect(result).toMatchObject({ feedback: { fixed: false, mistakeStatus: "open", trap: null } });

    await expect(
      prisma.mistake.findUniqueOrThrow({ where: { id: mistake.id } }),
    ).resolves.toMatchObject({ cause: "gap", fixedAt: null, status: "open" });
  });

  it("reports every notebook entry fixed by an overlapping drill question", async () => {
    const { original, extra, skill, user } = await setup();

    const [first, other] = await Promise.all([
      mistakeFixture({
        createdAt: YESTERDAY,
        itemId: original.id,
        skillId: skill.id,
        userId: user.id,
      }),
      mistakeFixture({
        createdAt: YESTERDAY,
        itemId: extra.id,
        skillId: skill.id,
        userId: user.id,
      }),
    ]);

    await answerMistakePractice({
      input: { answer: { selectedIndex: 0 }, durationMs: 9000, itemId: original.id },
      mistakeId: first.id,
    });

    const result = await answerMistakePractice({
      input: { answer: { selectedIndex: 0 }, durationMs: 9000, itemId: extra.id },
      mistakeId: first.id,
    });

    expect(result).toMatchObject({
      feedback: { fixed: false, fixedMistakeIds: [other.id], mistakeStatus: "fixed" },
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
        fixed: true,
        fixedMistakeIds: [mistake.id],
        isCorrect: true,
        mistakeStatus: "fixed",
        reached: { energy: null, level: null },
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

  describe("mistakes with no question of their own", () => {
    it("are all fixed by one right answer on their skill, and a retry says the same", async () => {
      const { covered, extra, practiced } = await withoutOwnQuestion();
      const attemptId = "01a1c0be-0000-7000-8000-000000000001";
      const input = { answer: { selectedIndex: 0 }, attemptId, durationMs: 9000, itemId: extra.id };

      const first = await answerMistakePractice({ input, mistakeId: practiced.id });
      const retry = await answerMistakePractice({ input, mistakeId: practiced.id });

      expect(fixedIds(first)).toStrictEqual([covered.id, practiced.id].toSorted());
      expect(fixedIds(retry)).toStrictEqual([covered.id, practiced.id].toSorted());
    });

    it("all stay open after a wrong answer or an honest don't-know", async () => {
      const { covered, extra, practiced } = await withoutOwnQuestion();

      await answerMistakePractice({
        input: { answer: { selectedIndex: 1 }, durationMs: 9000, itemId: extra.id },
        mistakeId: practiced.id,
      });

      await answerMistakePractice({
        input: { answer: { dontKnow: true }, durationMs: 9000, itemId: extra.id },
        mistakeId: practiced.id,
      });

      await expect(
        prisma.mistake.findUniqueOrThrow({ where: { id: covered.id } }),
      ).resolves.toMatchObject({ status: "open" });
    });

    it("count a retired question as no question of their own", async () => {
      const { covered, extra, original, practiced, skill, user } = await withoutOwnQuestion();

      const [retired] = await Promise.all([
        mistakeFixture({
          createdAt: YESTERDAY,
          itemId: original.id,
          skillId: skill.id,
          userId: user.id,
        }),
        prisma.item.update({ data: { retiredAt: new Date() }, where: { id: original.id } }),
      ]);

      const result = await answerMistakePractice({
        input: { answer: { selectedIndex: 0 }, durationMs: 9000, itemId: extra.id },
        mistakeId: practiced.id,
      });

      expect(fixedIds(result)).toStrictEqual([covered.id, practiced.id, retired.id].toSorted());
    });

    it("leave out a mistake with its own question, one from today and another skill's", async () => {
      const { covered, extra, original, practiced, skill, user } = await withoutOwnQuestion();
      const otherSkill = await skillFixture();

      const [withOwn, today, elsewhere] = await Promise.all([
        mistakeFixture({
          createdAt: YESTERDAY,
          itemId: original.id,
          skillId: skill.id,
          userId: user.id,
        }),
        mistakeFixture({ skillId: skill.id, userId: user.id }),
        mistakeFixture({ createdAt: YESTERDAY, skillId: otherSkill.id, userId: user.id }),
      ]);

      const result = await answerMistakePractice({
        input: { answer: { selectedIndex: 0 }, durationMs: 9000, itemId: extra.id },
        mistakeId: practiced.id,
      });

      expect(fixedIds(result)).toStrictEqual([covered.id, practiced.id].toSorted());

      await expect(
        prisma.mistake.findMany({
          select: { status: true },
          where: { id: { in: [withOwn.id, today.id, elsewhere.id] } },
        }),
      ).resolves.toStrictEqual([{ status: "open" }, { status: "open" }, { status: "open" }]);
    });

    it("are fixed by a question on the goal skill their lesson's plan item counts for", async () => {
      const user = await userFixture();
      mockSession(user.id);

      const { goal, planItems, skills } = await learnerGoalFixture({
        phases: [1],
        userId: user.id,
      });

      const [goalSkill] = skills as [(typeof skills)[number]];

      const [first, second] = await Promise.all([skillFixture(), skillFixture()]);
      const lessonId = planItems[0]?.lessonId ?? "";

      await Promise.all([
        lessonSkillFixture({ lessonId, skillId: first.id }),
        lessonSkillFixture({ lessonId, skillId: second.id }),
      ]);

      const practiced = await mistakeFixture({
        createdAt: YESTERDAY,
        skillId: first.id,
        userId: user.id,
      });

      const covered = await mistakeFixture({
        createdAt: YESTERDAY,
        skillId: second.id,
        userId: user.id,
      });

      const item = await prisma.item.findFirstOrThrow({ where: { skillId: goalSkill.id } });

      const result = await answerMistakePractice({
        input: {
          answer: { selectedIndex: 0 },
          durationMs: 9000,
          itemId: item.id,
          run: { answerIds: [], goalId: goal.id },
          timeZone: "UTC",
        },
        mistakeId: practiced.id,
      });

      expect(fixedIds(result)).toStrictEqual([covered.id, practiced.id].toSorted());
    });

    it("stay open when the question is on another goal skill their lesson also teaches", async () => {
      const user = await userFixture();
      mockSession(user.id);

      const { goal, planItems, skills } = await learnerGoalFixture({
        phases: [2],
        userId: user.id,
      });

      const [answered, other] = skills as [(typeof skills)[number], (typeof skills)[number]];
      const planItem = planItems.find(({ skillId }) => skillId === answered.id);

      await lessonSkillFixture({ lessonId: planItem?.lessonId ?? "", skillId: other.id });

      const practiced = await mistakeFixture({
        createdAt: YESTERDAY,
        skillId: answered.id,
        userId: user.id,
      });

      const onOtherSkill = await mistakeFixture({
        createdAt: YESTERDAY,
        skillId: other.id,
        userId: user.id,
      });

      const item = await prisma.item.findFirstOrThrow({ where: { skillId: answered.id } });

      const result = await answerMistakePractice({
        input: {
          answer: { selectedIndex: 0 },
          durationMs: 9000,
          itemId: item.id,
          run: { answerIds: [], goalId: goal.id },
          timeZone: "UTC",
        },
        mistakeId: practiced.id,
      });

      expect(fixedIds(result)).toStrictEqual([practiced.id]);

      await expect(
        prisma.mistake.findUniqueOrThrow({ where: { id: onOtherSkill.id } }),
      ).resolves.toMatchObject({ status: "open" });
    });

    it("sit out a run that asks a mistake's own question on their skill from outside the bank", async () => {
      const { practiced, skill, user } = await withoutOwnQuestion();

      const outside = await itemFixture({
        content: choiceItemContent(),
        field: "healthcare",
        skillId: skill.id,
      });

      const withOwn = await mistakeFixture({
        createdAt: new Date(YESTERDAY.getTime() - 86_400_000),
        itemId: outside.id,
        skillId: skill.id,
        userId: user.id,
      });

      const result = await getMistakePractice({});
      const practice = result.status === "ready" ? result.practice : [];

      expect(practice.map(({ mistakeId }) => mistakeId)).toStrictEqual([withOwn.id]);

      const answer = await answerMistakePractice({
        input: { answer: { selectedIndex: 0 }, durationMs: 9000, itemId: outside.id },
        mistakeId: withOwn.id,
      });

      expect(fixedIds(answer)).toContain(practiced.id);
    });

    it("keep a timed mistake's clock", async () => {
      const { extra, practiced, skill, user } = await withoutOwnQuestion();

      const timed = await mistakeFixture({
        cause: "time",
        createdAt: YESTERDAY,
        skillId: skill.id,
        userId: user.id,
      });

      const slow = await answerMistakePractice({
        input: { answer: { selectedIndex: 0 }, durationMs: 120_000, itemId: extra.id },
        mistakeId: practiced.id,
      });

      expect(fixedIds(slow)).not.toContain(timed.id);

      const quick = await answerMistakePractice({
        input: { answer: { selectedIndex: 0 }, durationMs: 9000, itemId: extra.id },
        mistakeId: practiced.id,
      });

      expect(fixedIds(quick)).toContain(timed.id);
    });
  });

  it("owes an ambiguous cause's naming by the classifier", async () => {
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

    expect(result.status === "ready" && result.feedback).toMatchObject({
      isCorrect: false,
      mistakeStatus: "open",
    });

    const added = await prisma.mistake.findFirstOrThrow({
      where: { itemId: extra.id, userId: user.id },
    });

    const [owed] = await listFollowUps(user.id);

    expect(owed).toMatchObject({
      input: {
        cause: { learnerAnswer: "Wrong answer", misconception: "Applies the rule backwards" },
        mistakeId: added.id,
      },
      kind: "classifyMistakeCause",
    });

    if (owed?.kind === "classifyMistakeCause") {
      await resolveMistakeCause({ ...owed.input, userId: user.id });
    }

    await expect(
      prisma.mistake.findUniqueOrThrow({ where: { id: added.id } }),
    ).resolves.toMatchObject({ cause: "trap" });
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

  it("names only the trap matching a wrong answer in a trap drill", async () => {
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

    expect(right.status === "ready" && right.feedback.trap).toBeNull();
    expect(wrong.status === "ready" && wrong.feedback.trap).toBe("Applies the rule backwards");
  });

  it("does not borrow a different wrong option's trap during practice", async () => {
    const { original, skill, user } = await setup();
    const content = choiceItemContent();

    const unmatched = await itemFixture({
      content: {
        ...content,
        options: [
          ...content.options,
          { isCorrect: false, misconception: null, reason: "A different mistake.", text: "Other" },
        ],
      },
      skillId: skill.id,
    });

    const mistake = await mistakeFixture({
      cause: "trap",
      createdAt: YESTERDAY,
      itemId: original.id,
      skillId: skill.id,
      userId: user.id,
    });

    const result = await answerMistakePractice({
      input: { answer: { selectedIndex: 2 }, durationMs: 100, itemId: unmatched.id },
      mistakeId: mistake.id,
    });

    expect(result).toMatchObject({ feedback: { isCorrect: false, trap: null }, status: "ready" });

    await expect(
      prisma.attempt.findFirstOrThrow({ where: { itemId: unmatched.id, userId: user.id } }),
    ).resolves.toMatchObject({ isCorrect: false });
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
