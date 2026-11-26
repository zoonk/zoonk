import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { itemFixture, skillsFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { examStructureSchema } from "../../library/exams/blueprint-contract";
import { CGU_WRITTEN_GRADING } from "./_test-utils/cgu-written";
import { listMockPrepWrites } from "./prepare-mock-questions";

const NOW = new Date("2026-03-02T06:00:00Z");
const SCHEDULED = new Date("2026-03-04T00:00:00Z");
const CITATION = { passage: "Synthetic notice", sourceId: "notice" };
const OBJECTIVE_SUBJECTS = ["Direito Administrativo", "Ética no Serviço Público"];

/** The written paper's name shares a word with the objective section's, as "Prova" and "Provas" do. */
const WRITTEN = "Prova discursiva";

const STRUCTURE = examStructureSchema.parse({
  formats: [],
  mock: {
    adaptive: false,
    citations: [],
    order: null,
    scoring: { description: "Each right answer earns one point.", method: "raw" },
    sections: [
      { day: 1, kind: "objective", minutes: 60, name: "Provas objetivas", questions: 20 },
      {
        day: 1,
        kind: "written",
        minutes: 60,
        name: WRITTEN,
        questions: null,
        tasks: [
          {
            count: 1,
            description: "Short question",
            grading: CGU_WRITTEN_GRADING,
            key: "short",
            lines: 30,
            points: 100,
          },
        ],
      },
    ],
    timeLimitMinutes: 120,
    totalQuestions: null,
  },
  rules: [],
  subjects: [...OBJECTIVE_SUBJECTS, WRITTEN].map((name) => ({
    citation: CITATION,
    group: null,
    name,
    questions: name === WRITTEN ? null : 10,
    topics: [],
    weight: null,
  })),
});

const AREAS = [...OBJECTIVE_SUBJECTS, ...OBJECTIVE_SUBJECTS, WRITTEN, WRITTEN];

/** `day` is the exam day the plan saved for the paper; null when it predates the notice's days. */
async function scheduledPaperSetup({ day }: { day: number | null }) {
  const [user, blueprint, skills] = await Promise.all([
    userFixture(),
    examBlueprintFixture({ structure: STRUCTURE }),
    skillsFixture(AREAS.map((area, index) => `${area} ${index} ${crypto.randomUUID()}`)),
  ]);

  const goal = await goalFixture({
    examBlueprintId: blueprint.id,
    kind: "exam",
    targetDate: new Date("2026-06-01T00:00:00Z"),
    userId: user.id,
  });

  const plan = await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "Phase" }],
      skills: skills.map((skill, index) => ({
        area: AREAS[index],
        lessons: 1,
        name: skill.name,
        phase: 0,
        skillId: skill.id,
        weight: null,
      })),
    },
    settings: {
      mockFunding: [{ contributions: [], date: "2026-03-04", day, fullLength: false, minutes: 30 }],
    },
  });

  await Promise.all([
    planItemFixture({
      kind: "mock",
      planId: plan.id,
      position: 0,
      scheduledFor: SCHEDULED,
      titleSnapshot: "Mock exam",
    }),
    prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    }),
  ]);

  const written = new Set(
    skills.flatMap((skill, index) => (AREAS[index] === WRITTEN ? [skill.id] : [])),
  );

  return { blueprint, goal, written };
}

async function listScheduledWrites(goalId: string) {
  const { papers, urgentShort } = await listMockPrepWrites({ goalId });
  const paper = papers.find(({ key }) => key === SCHEDULED.toISOString());

  return { urgentShort, writes: paper?.writes ?? null };
}

/** Stands in for the question writers: every question each write asks for. */
async function writeQuestions({
  examBlueprintId,
  writes,
}: {
  examBlueprintId: string;
  writes: NonNullable<Awaited<ReturnType<typeof listScheduledWrites>>["writes"]>;
}) {
  await Promise.all(
    writes.flatMap((write) =>
      write.skillIds.flatMap((skillId) =>
        Array.from({ length: write.questionsPerSkill }, () =>
          itemFixture({ examBlueprintId, mockOnly: true, skillId }),
        ),
      ),
    ),
  );
}

describe("preparing a scheduled mock's questions", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("writes the questions for the subjects the paper asks, not for the written paper", async () => {
    const { blueprint, goal, written } = await scheduledPaperSetup({ day: 1 });

    const { urgentShort, writes } = await listScheduledWrites(goal.id);
    const asked = (writes ?? []).flatMap((write) => write.skillIds);

    expect(urgentShort).toBe(true);
    expect(asked.length).toBeGreaterThan(0);
    expect(asked.filter((skillId) => written.has(skillId))).toStrictEqual([]);

    await writeQuestions({ examBlueprintId: blueprint.id, writes: writes ?? [] });

    await expect(listScheduledWrites(goal.id)).resolves.toStrictEqual({
      urgentShort: false,
      writes: null,
    });
  });

  it("fills a paper the plan dated before the notice put the exam's sections on a day", async () => {
    const { blueprint, goal } = await scheduledPaperSetup({ day: null });

    const { writes } = await listScheduledWrites(goal.id);
    await writeQuestions({ examBlueprintId: blueprint.id, writes: writes ?? [] });

    await expect(listScheduledWrites(goal.id)).resolves.toStrictEqual({
      urgentShort: false,
      writes: null,
    });
  });
});
