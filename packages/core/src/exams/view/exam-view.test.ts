import { prisma } from "@zoonk/db";
import { learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import {
  DAY_MS,
  SESSION_NOW,
  SESSION_TODAY,
  checkpointItemFixture,
  sessionGoalFixture,
} from "../../sessions/_test-utils/session-goal";
import { getTodayView } from "../../view-models/today/get-today-view";
import { getExamView } from "./get-exam-view";

const citation = { passage: "", sourceId: "notice" };

function frequency(topic: string, level: "high" | "medium") {
  return { appearances: null, basis: "Past papers", citation, level, subject: "Math", topic };
}

async function examSetup({
  examDay,
  language,
  mock = null,
  rules = [],
}: {
  examDay: string;
  /** The language the notice was read in, when it isn't the learner's. */
  language?: string;
  mock?: ExamStructure["mock"];
  rules?: ExamStructure["rules"];
}) {
  const user = await userFixture();

  const blueprint = await examBlueprintFixture({
    ...(language ? { language } : {}),
    edition: {
      check: null,
      citations: [],
      dates: [{ citation, date: examDay, kind: "exam", label: "Day 1", startTime: "13:30" }],
      noticeUrl: null,
      questionCount: 90,
      sourceHash: null,
      timeZone: "America/Sao_Paulo",
      year: 2026,
    },
    name: "ENEM",
    structure: {
      formats: [],
      mock,
      rules,
      subjects: [
        {
          citation,
          group: "Day 1",
          name: "Mathematics and its Technologies",
          questions: 45,
          topics: ["Functions", "Percentages"],
          weight: null,
        },
        {
          citation,
          group: "Day 2",
          name: "Humanities",
          questions: 45,
          topics: ["Brazil's Republic"],
          weight: null,
        },
      ],
    },
    topicFrequency: [frequency("Percentages", "high"), frequency("Functions", "medium")],
  });

  const fixture = await sessionGoalFixture({
    goal: {
      examBlueprintId: blueprint.id,
      kind: "exam",
      targetDate: new Date(`${examDay}T00:00:00Z`),
    },
    userId: user.id,
  });

  const [percentages, functions, republic] = fixture.skills;

  await prisma.plan.update({
    data: {
      graph: {
        phases: [{ name: "Basics" }],
        skills: [
          {
            area: "Math",
            lessons: 1,
            name: "Percentages",
            phase: 0,
            skillId: percentages?.id,
            weight: 2,
          },
          {
            area: "Math",
            lessons: 1,
            name: "Linear functions",
            phase: 0,
            skillId: functions?.id,
            weight: 2,
          },
          {
            area: "Humanities",
            lessons: 1,
            name: "The Old Republic",
            phase: 0,
            skillId: republic?.id,
            weight: 1,
          },
        ],
      },
    },
    where: { id: fixture.plan.id },
  });

  await learnerSkillFixture({ skillId: percentages?.id ?? "", state: "solid", userId: user.id });
  mockSession(user.id);

  return { ...fixture, blueprint, user };
}

describe("exam screen", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("maps the exam with topic frequency and the learner's level per subject", async () => {
    const { goal } = await examSetup({ examDay: "2026-11-08" });
    const result = await getExamView({ goalId: goal.id });

    expect(result).toMatchObject({
      exam: {
        days: [{ date: "2026-11-08", startTime: "13:30" }],
        examName: "ENEM",
        map: {
          hasFrequency: true,
          subjects: [
            {
              frequency: "high",
              group: "Day 1",
              level: { solid: 1, studied: 1, total: 2 },
              name: "Mathematics and its Technologies",
              share: 0.5,
              topics: [
                { frequency: "high", name: "Percentages" },
                { frequency: "medium", name: "Functions" },
              ],
            },
            { frequency: null, group: "Day 2", level: { solid: 0, total: 1 }, name: "Humanities" },
          ],
          topicCount: 3,
        },
        mocks: [],
        stage: "preparing",
      },
      status: "ready",
    });
  });

  it("tags Today's stops on topics the board asks a lot", async () => {
    const { goal } = await examSetup({ examDay: "2026-11-08" });
    const result = await getTodayView({ goalId: goal.id });
    const today = result.status === "ready" ? result.today : null;

    expect(today?.exam).toBeNull();

    const tagged = today?.session.blocks.filter((block) => block.oftenTested) ?? [];

    expect(tagged.map((block) => block.title)).toStrictEqual(["Lesson 1"]);
  });

  it("shows the day before's checklist on Today", async () => {
    const { goal } = await examSetup({ examDay: "2026-10-01" });
    const result = await getTodayView({ goalId: goal.id });

    expect(result.status === "ready" && result.today.exam).toMatchObject({
      checklist: ["documents", "blackPen", "route", "examTime", "sleep"],
      day: { date: "2026-10-01", startTime: "13:30" },
      // A plan that starts the day before the exam spends it on the topics that come up most.
      dayBefore: "learn",
      examName: "ENEM",
      resultReported: false,
      stage: "dayBefore",
    });
  });

  it("starts the final stretch on Today and the exam screen when the plan's phase starts", async () => {
    const { goal, plan } = await examSetup({ examDay: "2026-10-12" });

    const startFinalStretch = (startDate: string) =>
      prisma.plan.update({
        data: { phases: [{ endDate: "2026-10-11", kind: "finalStretch", name: "", startDate }] },
        where: { id: plan.id },
      });

    const stages = async () => {
      const [exam, today] = await Promise.all([
        getExamView({ goalId: goal.id }),
        getTodayView({ goalId: goal.id }),
      ]);

      return [
        exam.status === "ready" && exam.exam.stage,
        today.status === "ready" && (today.today.exam?.stage ?? "preparing"),
      ];
    };

    await startFinalStretch("2026-10-07");
    await expect(stages()).resolves.toStrictEqual(["preparing", "preparing"]);

    await startFinalStretch("2026-09-28");
    await expect(stages()).resolves.toStrictEqual(["finalStretch", "finalStretch"]);
  });

  // DELE's pass mark showed in Spanish in a Portuguese screen, with nothing saying it was the
  // notice's own words.
  it("says the pass mark in the notice's words with their language, unless the scale says it", async () => {
    const passMark = {
      citation,
      kind: "passMark" as const,
      text: "Apto con un mínimo de 30 puntos en el Grupo 1 y 30 puntos en el Grupo 2.",
    };

    const { goal } = await examSetup({ examDay: "2026-11-08", language: "es", rules: [passMark] });

    const result = await getExamView({ goalId: goal.id });

    expect(result).toMatchObject({
      exam: { passMarks: { language: "es", texts: [passMark.text] } },
      status: "ready",
    });

    // A scale with its passing score says it in the learner's own language instead.
    const scaled = await examSetup({
      examDay: "2026-11-08",
      language: "es",
      mock: {
        adaptive: false,
        citations: [],
        order: null,
        scoring: {
          description: "",
          method: "scaled",
          scale: { fromPercent: null, max: 100, min: 0, name: null, passScore: 60, step: null },
        },
        sections: [],
        timeLimitMinutes: null,
        totalQuestions: null,
      },
      rules: [passMark],
    });

    await expect(getExamView({ goalId: scaled.goal.id })).resolves.toMatchObject({
      exam: { passMarks: null, scoring: { noticeScale: { passScore: 60 } } },
    });
  });

  it("says the pass mark in the learner's language when the notice's reading translated it", async () => {
    const passMark = {
      citation,
      kind: "passMark" as const,
      text: "Apto con un mínimo de 30 puntos en el Grupo 1 y 30 puntos en el Grupo 2.",
      translations: { en: "Pass with at least 30 points in Group 1 and 30 points in Group 2." },
    };

    const { goal } = await examSetup({ examDay: "2026-11-08", language: "es", rules: [passMark] });

    await expect(getExamView({ goalId: goal.id })).resolves.toMatchObject({
      exam: { passMarks: { language: "en", texts: [passMark.translations.en] } },
      status: "ready",
    });
  });

  // DELE's pages called its official guide a notice ("edital" in Portuguese).
  it("names a language certificate's documents its official guide, any other exam's its notice", async () => {
    const certificate = await examSetup({ examDay: "2026-11-08", language: "es" });

    await prisma.goal.update({
      data: { targetLanguage: "es" },
      where: { id: certificate.goal.id },
    });

    await expect(getExamView({ goalId: certificate.goal.id })).resolves.toMatchObject({
      exam: { examDocument: "guide" },
    });

    // Each setup signs its own learner in.
    const notice = await examSetup({ examDay: "2026-11-08" });

    await expect(getExamView({ goalId: notice.goal.id })).resolves.toMatchObject({
      exam: { examDocument: "notice" },
    });
  });

  // Back after days away, the exam page named the mock the learner missed as their next one, while
  // Today, which reads the plan as it is now, said another day.
  it("never names a mock dated before today as the next one", async () => {
    const { goal, plan } = await examSetup({ examDay: "2026-11-08" });

    const [, upcoming] = await Promise.all([
      checkpointItemFixture({
        kind: "mock",
        planId: plan.id,
        position: 10,
        scheduledFor: new Date(SESSION_TODAY.getTime() - 2 * DAY_MS),
      }),
      checkpointItemFixture({
        kind: "mock",
        planId: plan.id,
        position: 11,
        scheduledFor: new Date(SESSION_TODAY.getTime() + 5 * DAY_MS),
      }),
    ]);

    await expect(getExamView({ goalId: goal.id })).resolves.toMatchObject({
      exam: { nextMock: { date: "2026-10-05", planItemId: upcoming.id } },
    });
  });

  it("is only for exam goals", async () => {
    const user = await userFixture();
    const { goal } = await sessionGoalFixture({ userId: user.id });
    mockSession(user.id);

    await expect(getExamView({ goalId: goal.id })).resolves.toStrictEqual({ status: "notExam" });
  });
});
