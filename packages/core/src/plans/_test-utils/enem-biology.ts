import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { skillPrerequisiteFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { vi } from "vitest";
import { getRequestProgressDateContext } from "../../progress/get-request-date-context";
import { type PlanGraph } from "../planner/plan-state";
import { planLibraryFixture, unplannedGoalFixture } from "./plan-library";

const TODAY = new Date("2026-10-09T00:00:00Z");
const DAY_MS = 86_400_000;

export function day(offset: number): Date {
  return new Date(TODAY.getTime() + offset * DAY_MS);
}

export function isoDay(offset: number): string {
  return day(offset).toISOString().slice(0, 10);
}

export function setClock(offset: number) {
  const now = new Date(day(offset).getTime() + 12 * 60 * 60 * 1000);

  vi.setSystemTime(now);

  vi.mocked(getRequestProgressDateContext).mockResolvedValue({
    currentDate: day(offset),
    currentInstant: now,
    timeZone: "UTC",
  });
}

export const TOPICS = ["Células", "Seres vivos", "Ecologia", "Água"];

function frequency({ level, topic }: { level: "high" | "low"; topic: string }) {
  return {
    appearances: null,
    basis: "Provas anteriores",
    citation: { passage: topic, sourceId: "papers" },
    level,
    subject: "Biologia",
    topic,
  };
}

const ENEM_BIOLOGY = {
  name: "ENEM",
  structure: {
    formats: [],
    mock: null,
    rules: [],
    subjects: [
      {
        citation: { passage: "Biologia", sourceId: "notice" },
        name: "Biologia",
        questions: null,
        topics: TOPICS,
        weight: null,
      },
    ],
  },
  topicFrequency: [
    frequency({ level: "high", topic: "Células" }),
    frequency({ level: "low", topic: "Seres vivos" }),
    frequency({ level: "high", topic: "Ecologia" }),
    frequency({ level: "low", topic: "Água" }),
  ],
};

function withTopics(graph: PlanGraph): PlanGraph {
  return {
    ...graph,
    skills: graph.skills.map((skill, index) => ({ ...skill, topics: [TOPICS[index] ?? ""] })),
  };
}

const ENEM_DAILY_MINUTES = 15;

export async function enemBiologyGoal({
  dailyMinutes = ENEM_DAILY_MINUTES,
  days,
  edition = null,
  size = 30,
}: {
  dailyMinutes?: number;
  days: number;
  edition?: object | null;
  size?: number;
}) {
  const user = await userFixture();

  const [blueprint, library] = await Promise.all([
    examBlueprintFixture({ ...ENEM_BIOLOGY, ...(edition ? { edition } : {}) }),
    planLibraryFixture({
      skills: TOPICS.map(() => ({ area: "Biologia", lessons: 3, size, weight: 3 })),
    }),
  ]);

  const [cells, living, ecology] = library.skills;

  if (!(cells && living && ecology)) {
    throw new Error("The ENEM library has a skill for each topic");
  }

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes,
    details: { placementDeclined: true },
    examBlueprintId: blueprint.id,
    kind: "exam",
    targetDate: day(days),
    timezone: "UTC",
    userId: user.id,
  });

  await Promise.all([
    skillPrerequisiteFixture({ prerequisiteId: cells.id, skillId: living.id }),
    skillPrerequisiteFixture({ prerequisiteId: living.id, skillId: ecology.id }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
  ]);

  return { ecology, goal, graph: withTopics(library.graph), library, living, plan, user };
}
