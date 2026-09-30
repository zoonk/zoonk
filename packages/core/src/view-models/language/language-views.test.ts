import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { RENTING_SCENARIO, languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
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
  it("shows levels since the level test, can-dos, current unit and the last four weeks", async () => {
    const setup = await languageGoalFixture();
    const { goal, user } = setup;
    mockSession(user.id);
    await finishArriving(setup);

    await Promise.all([
      prisma.languageSkillLevel.create({
        data: { language: "en", score: B1, skill: "listening", startScore: A2, userId: user.id },
      }),
      prisma.learnerWord.create({
        data: { language: "en", text: "rent", userId: user.id, wordId: crypto.randomUUID() },
      }),
      prisma.languageConversation.create({
        data: {
          endedAt: new Date(),
          kind: "practice",
          language: "pt",
          level: "A2",
          minutes: 2,
          scenario: RENTING_SCENARIO,
          spokenSeconds: 90,
          status: "completed",
          targetLanguage: "en",
          titleSnapshot: RENTING_SCENARIO.title,
          userId: user.id,
        },
      }),
    ]);

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

    expect(progress.canDo).toStrictEqual([
      { done: true, text: "Consigo fazer a parte 1", unitTitle: "Chegando" },
      { done: false, text: "Consigo fazer a parte 2", unitTitle: "Alugando um apartamento" },
    ]);

    expect(progress.currentUnit).toMatchObject({
      chapterId: setup.renting.id,
      lessonsDone: 0,
      lessonsTotal: 2,
      position: 2,
      units: 2,
    });

    expect(progress.recent).toStrictEqual({ conversations: 1, minutesSpoken: 2, wordsLearned: 1 });
    expect(progress.speakingMock).toBeNull();
  });

  it("shows no speaking level the level test didn't measure until the learner speaks", async () => {
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

    await prisma.languageSkillLevel.create({
      data: { language: "en", score: A2, skill: "speaking", startScore: A2, userId: user.id },
    });

    await expect(skillsShown()).resolves.toStrictEqual([
      "reading",
      "listening",
      "speaking",
      "writing",
    ]);
  });

  it("counts every word known in the language, and only this month's as recent", async () => {
    const { goal, user } = await languageGoalFixture();
    mockSession(user.id);
    const longAgo = new Date(Date.now() - 90 * MS_PER_DAY);

    const word = (input: { language: string; learnedAt?: Date; text: string }) =>
      prisma.learnerWord.create({
        data: { ...input, userId: user.id, wordId: crypto.randomUUID() },
      });

    await Promise.all([
      word({ language: "en", learnedAt: longAgo, text: "landlord" }),
      word({ language: "en", learnedAt: longAgo, text: "lease" }),
      word({ language: "en", text: "rent" }),
      word({ language: "es", text: "alquiler" }),
    ]);

    const result = await getLanguageProgressView({ goalId: goal.id });

    if (result.status !== "ready") {
      throw new Error(result.status);
    }

    expect(result.progress.wordsKnown).toBe(3);
    expect(result.progress.recent.wordsLearned).toBe(1);
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
        conversation: { character: { name: "Linda" }, defaultMinutes: 2, minutes: [1, 2, 3, 5] },
        goalId: goal.id,
        grammarTips: [{ title: "There is / there are" }],
        mistakes: [{ answer: "There is two", skill: "writing" }],
        unit: { levelRange: "A1–A2", position: 2, title: "Alugando um apartamento" },
        words: { count: 0 },
      },
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

  it("moves past a unit whose call was won on Today, Progress and the units list alike", async () => {
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

    const [today, progress, units] = await Promise.all([
      getLanguageTodayView({ goalId: goal.id }),
      getLanguageProgressView({ goalId: goal.id }),
      getLanguageUnitsView({ goalId: goal.id }),
    ]);

    expect(today.status === "ready" && today.today.currentUnit?.chapterId).toBe(renting.id);

    expect(progress.status === "ready" && progress.progress.currentUnit?.chapterId).toBe(
      renting.id,
    );

    expect(units.status === "ready" && units.units.units.map((unit) => unit.done)).toStrictEqual([
      true,
      false,
    ]);
  });

  it("adds the current unit, a new can-do and a noticed pattern to Today", async () => {
    const setup = await languageGoalFixture();
    const { goal, user } = setup;
    mockSession(user.id);
    await finishArriving(setup);

    const pattern = await prisma.mistakePattern.create({
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
    });

    const result = await getLanguageTodayView({ goalId: goal.id });

    expect(result).toMatchObject({
      status: "ready",
      today: {
        currentUnit: { chapterId: setup.renting.id },
        newCanDo: "Consigo fazer a parte 1",
        pattern: { id: pattern.id, kind: "pattern", title: "since e for" },
      },
    });
  });
});
