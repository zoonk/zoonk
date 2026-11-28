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

function examStructure(writtenQuestions: number | null) {
  return examStructureSchema.parse({
    formats: [],
    mock: {
      adaptive: false,
      citations: [],
      order: null,
      scoring: { description: "Each right answer earns one point.", method: "raw" },
      sections: [
        {
          day: 1,
          kind: "objective",
          minutes: 60,
          name: "Provas objetivas",
          questions: 20,
          session: "Morning",
        },
        {
          day: 1,
          kind: "written",
          minutes: 60,
          name: WRITTEN,
          questions: null,
          session: "Afternoon",
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
      questions: name === WRITTEN ? writtenQuestions : 10,
      topics: [],
      weight: null,
    })),
  });
}

const AREAS = [...OBJECTIVE_SUBJECTS, ...OBJECTIVE_SUBJECTS, WRITTEN, WRITTEN];

/** `day` is the exam day the plan saved for the paper; null when it predates the notice's days. */
async function scheduledPaperSetup({
  day,
  writtenQuestions = null,
}: {
  day: number | null;
  writtenQuestions?: number | null;
}) {
  const [user, blueprint, skills] = await Promise.all([
    userFixture(),
    examBlueprintFixture({ structure: examStructure(writtenQuestions) }),
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

/** The written paper's skills already hold objective questions, as an earlier writer left them. */
async function bankWrittenSkillQuestions({
  examBlueprintId,
  written,
}: {
  examBlueprintId: string;
  written: ReadonlySet<string>;
}) {
  await Promise.all(
    [...written].flatMap((skillId) =>
      Array.from({ length: 10 }, () => itemFixture({ examBlueprintId, mockOnly: true, skillId })),
    ),
  );
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

/** One pass of the daily supply: each paper in turn writes what it still lacks after the last. */
async function supplyPass({
  examBlueprintId,
  goalId,
}: {
  examBlueprintId: string;
  goalId: string;
}) {
  const { papers } = await listMockPrepWrites({ goalId });

  /* oxlint-disable no-await-in-loop -- Each paper draws on the questions the previous one wrote. */
  for (const { key } of papers) {
    const { papers: short } = await listMockPrepWrites({ goalId, only: key });
    await writeQuestions({ examBlueprintId, writes: short[0]?.writes ?? [] });
  }
  /* oxlint-enable no-await-in-loop */

  return papers;
}

/**
 * The notice counts the written paper's two questions, so only its section marks it as written,
 * and the plan saved its mock before the notice put the exam's sections on a day.
 */
async function writtenBankSetup() {
  const fixture = await scheduledPaperSetup({ day: null, writtenQuestions: 2 });

  await bankWrittenSkillQuestions({
    examBlueprintId: fixture.blueprint.id,
    written: fixture.written,
  });

  return fixture;
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

  it("doesn't seat questions written for the written paper's skills on the objective paper", async () => {
    const { blueprint, goal, written } = await scheduledPaperSetup({ day: 1 });

    await bankWrittenSkillQuestions({ examBlueprintId: blueprint.id, written });

    const { urgentShort, writes } = await listScheduledWrites(goal.id);

    expect(urgentShort).toBe(true);
    expect((writes ?? []).flatMap((write) => write.skillIds).length).toBeGreaterThan(0);
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

describe("writing an exam's mock questions ahead", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("asks no paper's questions of the written paper's skills", async () => {
    const { goal, written } = await writtenBankSetup();
    const { papers } = await listMockPrepWrites({ goalId: goal.id });

    const asked = papers.flatMap((paper) => paper.writes.flatMap((write) => write.skillIds));

    expect(papers.map(({ key }) => key)).toContain(JSON.stringify(["objective", 1, null]));
    expect(asked.length).toBeGreaterThan(0);
    expect(asked.filter((skillId) => written.has(skillId))).toStrictEqual([]);
  });

  it("writes nothing on the next pass once every paper holds its questions", async () => {
    const { blueprint, goal } = await writtenBankSetup();

    const first = await supplyPass({ examBlueprintId: blueprint.id, goalId: goal.id });
    const { papers } = await listMockPrepWrites({ goalId: goal.id });

    expect(first.map(({ key }) => key)).toContain(JSON.stringify(["objective", 1, null]));
    expect(papers.flatMap((paper) => paper.writes)).toStrictEqual([]);
  });
});
