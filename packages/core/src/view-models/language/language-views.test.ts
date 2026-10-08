import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { RENTING_SCENARIO, languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getLanguageProgressView } from "./get-language-progress-view";
import { getLanguageTodayView } from "./get-language-today-view";
import { getLanguageUnitView } from "./get-language-unit-view";
import { getLanguageUnitsView } from "./get-language-units-view";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

const A2 = 1;
const B1 = 2;
const DAYS_AGO_2 = 2 * MS_PER_DAY;

/** The arriving unit's lessons done a couple of days ago: that unit is finished. */
async function finishArriving({ items }: { items: { id: string }[] }) {
  const completedAt = new Date(Date.now() - DAYS_AGO_2);

  await prisma.planItem.updateMany({
    data: { completedAt, status: "done" },
    where: { id: { in: items.slice(0, 2).map((item) => item.id) } },
  });
}

describe("language view models", () => {
  it("shows levels since the level test and can-dos", async () => {
    const setup = await languageGoalFixture();
    const { goal, user } = setup;
    mockSession(user.id);
    await finishArriving(setup);

    await prisma.languageSkillLevel.create({
      data: { language: "en", score: B1, skill: "listening", startScore: A2, userId: user.id },
    });

    const result = await getLanguageProgressView({ goalId: goal.id });

    if (result.status !== "ready") {
      throw new Error(result.status);
    }

    const { progress } = result;

    expect(progress.levels.find((level) => level.skill === "listening")).toMatchObject({
      label: "B1",
      startLabel: "A2",
      trend: "up",
    });

    expect(progress.levels.find((level) => level.skill === "writing")).toMatchObject({
      label: "A2",
      trend: "same",
    });

    expect(progress.target).toStrictEqual({ label: "B1+", score: 2.5 });
    // Listening at B1 and the rest at A2 average below A2+, so the level across skills is A2.
    expect(progress.level).toBe("A2");

    expect(progress.canDo).toStrictEqual([
      { done: true, text: "Consigo fazer a parte 1", unitTitle: "Chegando" },
      { done: false, text: "Consigo fazer a parte 2", unitTitle: "Alugando um apartamento" },
    ]);

    expect(progress.speakingMock).toBeNull();
  });

  it("shows the level the learner aims for from what onboarding understood", async () => {
    const { goal, user } = await languageGoalFixture();
    mockSession(user.id);

    // Onboarding writes a language goal's target as the CEFR level in `targetScore`.
    await prisma.goal.update({
      data: { details: { level: "B1+", reason: "Entrevista de emprego", targetScore: "B2" } },
      where: { id: goal.id },
    });

    const result = await getLanguageProgressView({ goalId: goal.id });

    expect(result.status === "ready" && result.progress.target).toStrictEqual({
      label: "B2",
      score: 3,
    });
  });

  it("shows no level the level test didn't measure until a handful of answers give it one", async () => {
    const { goal, user } = await languageGoalFixture();
    mockSession(user.id);

    await prisma.goal.update({
      data: {
        details: {
          ...(goal.details as object),
          skillLevels: { listening: "A1+", reading: "A2", writing: "A1+" },
        },
      },
      where: { id: goal.id },
    });

    const skillsShown = async () => {
      const result = await getLanguageProgressView({ goalId: goal.id });
      return result.status === "ready" ? result.progress.levels.map((level) => level.skill) : [];
    };

    await expect(skillsShown()).resolves.toStrictEqual(["reading", "listening", "writing"]);

    // One sentence spoken says little about speaking.
    const speaking = await prisma.languageSkillLevel.create({
      data: {
        language: "en",
        score: A2,
        skill: "speaking",
        startScore: A2,
        userId: user.id,
        windowCorrect: 1,
        windowTotal: 1,
      },
    });

    await expect(skillsShown()).resolves.toStrictEqual(["reading", "listening", "writing"]);

    await prisma.languageSkillLevel.update({
      data: { windowCorrect: 4, windowTotal: 5 },
      where: { id: speaking.id },
    });

    await expect(skillsShown()).resolves.toStrictEqual([
      "reading",
      "listening",
      "speaking",
      "writing",
    ]);
  });

  it("offers the speaking mock of the exam the goal's reason names", async () => {
    const [ielts, toefl] = await Promise.all([languageGoalFixture(), languageGoalFixture()]);

    await Promise.all([
      prisma.goal.update({
        data: { details: { reason: "Vou fazer o IELTS em março" } },
        where: { id: ielts.goal.id },
      }),
      prisma.goal.update({
        data: { details: { reason: "Preciso do TOEFL para o mestrado" } },
        where: { id: toefl.goal.id },
      }),
    ]);

    mockSession(ielts.user.id);
    const forIelts = await getLanguageProgressView({ goalId: ielts.goal.id });

    mockSession(toefl.user.id);
    const forToefl = await getLanguageProgressView({ goalId: toefl.goal.id });

    expect(forIelts.status === "ready" && forIelts.progress.speakingMock).toBe("ielts");
    expect(forToefl.status === "ready" && forToefl.progress.speakingMock).toBe("toefl");
  });

  it("is not for other goals", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });
    mockSession(user.id);

    await expect(getLanguageProgressView({ goalId: goal.id })).resolves.toStrictEqual({
      status: "notLanguage",
    });
  });

  it("shows a unit's tips, lessons, open mistakes by skill and its call", async () => {
    const { goal, lessons, renting, user } = await languageGoalFixture();
    mockSession(user.id);
    const [first] = lessons.slice(2);

    if (!first) {
      throw new Error("No lesson");
    }

    const [tip, writing] = await Promise.all([
      libraryStepFixture({
        content: {
          text: "There is para um, there are para vários.",
          title: "There is / there are",
        },
        kind: "explanation",
        lessonId: first.id,
        position: 0,
      }),
      libraryStepFixture({ kind: "typedAnswer", lessonId: first.id, position: 1 }),
    ]);

    await mistakeFixture({
      snapshot: {
        answer: "There is two",
        correctAnswer: "There are two",
        format: "typedAnswer",
        question: "Tem dois",
      },
      stepId: writing.id,
      userId: user.id,
    });

    const result = await getLanguageUnitView({ chapterId: renting.id });

    expect(tip.id).toBeTruthy();

    expect(result).toMatchObject({
      status: "ready",
      unit: {
        // A free learner picks the lengths their day holds; Plus's longer ones show locked.
        conversation: {
          character: { name: "Linda" },
          defaultMinutes: 2,
          limit: null,
          minutes: [1, 2],
          plusMinutes: [3, 5],
        },
        goalId: goal.id,
        grammarTips: [{ title: "There is / there are" }],
        mistakes: [{ answer: "There is two", skill: "writing" }],
        unit: { levelRange: "A1–A2", position: 2, title: "Alugando um apartamento" },
        words: { count: 0 },
      },
    });
  });

  it("offers only the call lengths left today, and says when calls come back once none fits", async () => {
    const { renting, user } = await languageGoalFixture();
    mockSession(user.id);

    await usageRecordsFixture({ count: 1, kind: "conversation", seconds: 50, userId: user.id });
    const oneLeft = await getLanguageUnitView({ chapterId: renting.id });

    await usageRecordsFixture({ count: 1, kind: "conversation", seconds: 30, userId: user.id });
    const noneLeft = await getLanguageUnitView({ chapterId: renting.id });

    expect(oneLeft.status === "ready" && oneLeft.unit.conversation).toMatchObject({
      defaultMinutes: 1,
      limit: null,
      minutes: [1],
      plusMinutes: [3, 5],
    });

    expect(noneLeft.status === "ready" && noneLeft.unit.conversation).toMatchObject({
      limit: { period: "day", tier: "free" },
      minutes: [],
      plusMinutes: [],
    });
  });

  it("lists the course's units in teaching order with what's done", async () => {
    const setup = await languageGoalFixture();
    mockSession(setup.user.id);
    await finishArriving(setup);

    await expect(getLanguageUnitsView({ goalId: setup.goal.id })).resolves.toStrictEqual({
      status: "ready",
      units: {
        alphabet: null,
        goalId: setup.goal.id,
        units: [
          {
            chapterId: setup.arriving.id,
            done: true,
            lessonsDone: 2,
            lessonsTotal: 2,
            position: 1,
            title: "Chegando",
          },
          {
            chapterId: setup.renting.id,
            done: false,
            lessonsDone: 0,
            lessonsTotal: 2,
            position: 2,
            title: "Alugando um apartamento",
          },
        ],
      },
    });
  });

  it("moves past a unit whose call was won in can-dos and the units list alike", async () => {
    const setup = await languageGoalFixture();
    const { arriving, goal, renting, user } = setup;
    mockSession(user.id);

    await prisma.languageConversation.create({
      data: {
        chapterId: arriving.id,
        endedAt: new Date(),
        kind: "checkpoint",
        language: "pt",
        level: "A2",
        minutes: 2,
        objectivesMet: RENTING_SCENARIO.objectives.map((objective) => objective.label),
        scenario: RENTING_SCENARIO,
        status: "completed",
        targetLanguage: "en",
        titleSnapshot: RENTING_SCENARIO.title,
        userId: user.id,
      },
    });

    const [progress, units] = await Promise.all([
      getLanguageProgressView({ goalId: goal.id }),
      getLanguageUnitsView({ goalId: goal.id }),
    ]);

    expect(progress.status === "ready" && progress.progress.canDo).toStrictEqual([
      { done: true, text: "Consigo fazer a parte 1", unitTitle: "Chegando" },
      { done: false, text: "Consigo fazer a parte 2", unitTitle: renting.title },
    ]);

    expect(units.status === "ready" && units.units.units.map((unit) => unit.done)).toStrictEqual([
      true,
      false,
    ]);
  });

  it("adds the level across skills and a noticed pattern to Today", async () => {
    const setup = await languageGoalFixture();
    const { goal, user } = setup;
    mockSession(user.id);

    const [pattern] = await Promise.all([
      prisma.mistakePattern.create({
        data: {
          content: { contrast: [], drill: [], examples: [], rule: "Use for com durações." },
          goalId: goal.id,
          kind: "pattern",
          language: "en",
          model: "test",
          promptVersion: "test",
          runId: "test",
          title: "since e for",
          userId: user.id,
        },
      }),
      prisma.languageSkillLevel.create({
        data: { language: "en", score: B1, skill: "listening", startScore: A2, userId: user.id },
      }),
    ]);

    const result = await getLanguageTodayView({ goalId: goal.id });

    // Listening went up to B1 and the rest stay at A2: the average rounds down to A2.
    expect(result).toStrictEqual({
      status: "ready",
      today: {
        level: { label: "A2", target: "B1+" },
        pattern: { id: pattern.id, kind: "pattern", title: "since e for" },
        pronunciation: null,
      },
    });
  });

  it("rounds the level across skills down to a half step", async () => {
    const setup = await languageGoalFixture();
    const { goal, user } = setup;
    mockSession(user.id);

    await Promise.all(
      (["listening", "reading"] as const).map((skill) =>
        prisma.languageSkillLevel.create({
          data: { language: "en", score: B1, skill, startScore: A2, userId: user.id },
        }),
      ),
    );

    const result = await getLanguageTodayView({ goalId: goal.id });

    expect(result.status === "ready" && result.today.level).toStrictEqual({
      label: "A2+",
      target: "B1+",
    });
  });
});
