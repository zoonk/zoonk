import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { RENTING_SCENARIO, languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { chapterSkillFixture } from "@zoonk/testing/fixtures/library-chapters";
import { lessonSkillFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { describe, expect, it } from "vitest";
import { freezeClock } from "../../_test-utils/frozen-clock";
import { mockGuestSession, mockSession } from "../../_test-utils/mock-session";
import { getLanguageProgressView } from "./get-language-progress-view";
import { getLanguageTodayView } from "./get-language-today-view";
import { getLanguageUnitView } from "./get-language-unit-view";
import { getLanguageUnitsView } from "./get-language-units-view";

const A2 = 1;
const B1 = 2;
const DAYS_AGO_2 = 2 * MS_PER_DAY;

/** Arriving's lessons teach A1 and renting's A2. */
async function tagSkills({ skills }: { skills: { id: string }[] }) {
  await Promise.all(
    skills.map((skill, index) =>
      prisma.skill.update({
        data: { cefrLevel: index < 2 ? "A1" : "A2", level: "beginner" },
        where: { id: skill.id },
      }),
    ),
  );
}

async function finishArriving({ items }: { items: { id: string }[] }) {
  const completedAt = new Date(Date.now() - DAYS_AGO_2);

  await prisma.planItem.updateMany({
    data: { completedAt, status: "done" },
    where: { id: { in: items.slice(0, 2).map((item) => item.id) } },
  });
}

describe("language view models", () => {
  it("shows the plan's level, skill estimates since the level test and can-dos", async () => {
    const setup = await languageGoalFixture();
    const { goal, user } = setup;
    mockSession(user.id);
    await Promise.all([tagSkills(setup), finishArriving(setup)]);

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
    expect(progress.level).toStrictEqual({ label: "A2", target: "B1+" });

    expect(progress.canDo).toStrictEqual([
      { done: true, text: "Consigo fazer a parte 1", unitTitle: "Chegando" },
      { done: false, text: "Consigo fazer a parte 2", unitTitle: "Alugando um apartamento" },
    ]);

    expect(progress.speakingMock).toBeNull();
  });

  it("shows the goal beside the plan's level only while the level is below it", async () => {
    const setup = await languageGoalFixture();
    const { goal, user } = setup;
    mockSession(user.id);
    await Promise.all([tagSkills(setup), finishArriving(setup)]);

    const levelsFor = async (targetLevel: string) => {
      await prisma.goal.update({
        data: { details: { ...(goal.details as object), targetLevel } },
        where: { id: goal.id },
      });

      const [progress, today] = await Promise.all([
        getLanguageProgressView({ goalId: goal.id }),
        getLanguageTodayView({ goalId: goal.id }),
      ]);

      if (progress.status !== "ready" || today.status !== "ready") {
        throw new Error("Not ready");
      }

      return {
        goalTarget: progress.progress.target,
        level: progress.progress.level,
        today: today.today.level,
      };
    };

    await expect(levelsFor("A2+")).resolves.toStrictEqual({
      goalTarget: { label: "A2+", score: 1.5 },
      level: { label: "A2", target: "A2+" },
      today: { label: "A2", target: "A2+" },
    });

    await expect(levelsFor("A2")).resolves.toStrictEqual({
      goalTarget: { label: "A2", score: 1 },
      level: { label: "A2", target: null },
      today: { label: "A2", target: null },
    });

    await expect(levelsFor("A1+")).resolves.toStrictEqual({
      goalTarget: { label: "A1+", score: 0.5 },
      level: { label: "A2", target: null },
      today: { label: "A2", target: null },
    });
  });

  it.each(["lesson", "unit"] as const)(
    "reads a rental lesson that also teaches an A1 skill through its %s at A1 on Today, and its unit as A1–A2",
    async (link) => {
      const setup = await languageGoalFixture();
      const { goal, items, renting, skills, user } = setup;
      mockSession(user.id);
      await Promise.all([tagSkills(setup), finishArriving(setup)]);

      const skillId = skills[0]?.id ?? "";

      await (link === "lesson"
        ? lessonSkillFixture({ lessonId: items[2]?.lessonId ?? "", skillId })
        : chapterSkillFixture({ chapterId: renting.id, skillId }));

      const [today, unit] = await Promise.all([
        getLanguageTodayView({ goalId: goal.id }),
        getLanguageUnitView({ chapterId: renting.id }),
      ]);

      expect(today).toMatchObject({ today: { level: { label: "A1+" } } });
      expect(unit).toMatchObject({ unit: { unit: { levelRange: "A1–A2" } } });
    },
  );

  it("shows the level the learner aims for from what onboarding understood", async () => {
    const { goal, user } = await languageGoalFixture();
    mockSession(user.id);

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

    expect(forIelts.status === "ready" && forIelts.progress.speaking).toBeNull();
  });

  it("gives a language goal the speaking paper of the exam it names, at its target", async () => {
    const setup = await languageGoalFixture();

    await prisma.goal.update({
      data: {
        details: { reason: "Quero fazer o DELE um dia", targetLevel: "B2" },
        targetLanguage: "es",
        title: "Espanhol",
      },
      where: { id: setup.goal.id },
    });

    await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: setup.user.id, status: "active" },
    });

    mockSession(setup.user.id);

    const [today, progress] = await Promise.all([
      getLanguageTodayView({ goalId: setup.goal.id }),
      getLanguageProgressView({ goalId: setup.goal.id }),
    ]);

    expect(today.status === "ready" && today.today.speaking).toStrictEqual({
      access: "open",
      title: "DELE B2",
    });

    expect(progress.status === "ready" && progress.progress.speaking).toMatchObject({
      access: "open",
      exam: "dele",
      level: "B2",
    });

    expect(progress.status === "ready" && progress.progress.speakingMock).toBeNull();
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

    const [, writing] = await Promise.all([
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

    expect(result).toMatchObject({
      status: "ready",
      unit: {
        conversation: {
          character: { name: "Linda" },
          defaultMinutes: 2,
          limit: null,
          minutes: [1, 2],
          plusMinutes: [3, 5],
        },
        goalId: goal.id,
        grammarTips: [
          { text: "There is para um, there are para vários.", title: "There is / there are" },
        ],
        mistakes: [{ answer: "There is two", skill: "writing" }],
        unit: { levelRange: "A1–A2", position: 2, title: "Alugando um apartamento" },
        words: { count: 0 },
      },
    });
  });

  it("shows a unit at its lessons' level, the span when they differ, and its band until each has one", async () => {
    const { renting, skills, user } = await languageGoalFixture();
    mockSession(user.id);
    const [first, second] = skills.slice(2);

    if (!first || !second) {
      throw new Error("No skills");
    }

    const unitSkills = [first, second];

    async function levelRangeWith(levels: ["A2" | null, "A2" | "B1"]) {
      await Promise.all(
        unitSkills.map((skill, index) =>
          prisma.skill.update({ data: { cefrLevel: levels[index] }, where: { id: skill.id } }),
        ),
      );

      const result = await getLanguageUnitView({ chapterId: renting.id });
      return result.status === "ready" ? result.unit.unit.levelRange : null;
    }

    await expect(levelRangeWith([null, "A2"])).resolves.toBe("A1–A2");
    await expect(levelRangeWith(["A2", "A2"])).resolves.toBe("A2");
    await expect(levelRangeWith(["A2", "B1"])).resolves.toBe("A2–B1");
  });

  it("keeps the free-account recovery for a guest instead of claiming a global pause", async () => {
    const { renting, user } = await languageGoalFixture();
    await prisma.user.update({ data: { isAnonymous: true }, where: { id: user.id } });
    mockGuestSession(user.id);
    const result = await getLanguageUnitView({ chapterId: renting.id });

    expect(result).toMatchObject({
      status: "ready",
      unit: { conversation: { limit: { period: "total", tier: "guest" }, paused: false } },
    });
  });

  it("offers every call length the plan allows while any of today's call time is left, and says when calls come back once none is", async () => {
    freezeClock();

    const { renting, user } = await languageGoalFixture();
    mockSession(user.id);

    await usageRecordsFixture({ count: 1, kind: "conversation", seconds: 110, userId: user.id });
    const someLeft = await getLanguageUnitView({ chapterId: renting.id });

    await usageRecordsFixture({ count: 1, kind: "conversation", seconds: 10, userId: user.id });
    const noneLeft = await getLanguageUnitView({ chapterId: renting.id });

    expect(someLeft.status === "ready" && someLeft.unit.conversation).toMatchObject({
      defaultMinutes: 2,
      limit: null,
      minutes: [1, 2],
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

  it("adds the plan's level to Today, leaves the noticed pattern to Today's own read, and offers no exam's speaking to a goal that names none", async () => {
    const setup = await languageGoalFixture();
    const { goal, user } = setup;
    mockSession(user.id);

    await Promise.all([
      tagSkills(setup),
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

    expect(result).toStrictEqual({
      status: "ready",
      today: { level: { label: "A1", target: "B1+" }, pronunciation: null, speaking: null },
    });
  });
});
