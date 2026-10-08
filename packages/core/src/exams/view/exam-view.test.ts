import { prisma } from "@zoonk/db";
import { learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { SESSION_NOW, sessionGoalFixture } from "../../sessions/_test-utils/session-goal";
import { getTodayView } from "../../view-models/today/get-today-view";
import { getExamView } from "./get-exam-view";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

const citation = { passage: "", sourceId: "notice" };

function frequency(topic: string, level: "high" | "medium") {
  return { appearances: null, basis: "Past papers", citation, level, subject: "Math", topic };
}

async function examSetup({ examDay }: { examDay: string }) {
  const user = await userFixture();

  const blueprint = await examBlueprintFixture({
    edition: {
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
      mock: null,
      rules: [],
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

  it("is only for exam goals", async () => {
    const user = await userFixture();
    const { goal } = await sessionGoalFixture({ userId: user.id });
    mockSession(user.id);

    await expect(getExamView({ goalId: goal.id })).resolves.toStrictEqual({ status: "notExam" });
  });
});
