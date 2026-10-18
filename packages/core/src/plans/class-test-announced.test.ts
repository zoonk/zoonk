import { prisma } from "@zoonk/db";
import { attemptFixture, learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";

/** A Thursday: Pedro's biology test is on Saturday, and Friday is its full review. */
const TODAY = new Date("2026-10-08T00:00:00Z");
const DAY_MS = 86_400_000;

const ANNOUNCEMENT =
  "A prof disse: vai ter questão de completar a tabela das organelas e uma dissertativa sobre osmose!";

/** His notes as their reading stores them: the formats the teacher's last line announces. */
const NOTES_STRUCTURE = {
  formats: [
    {
      citation: { passage: ANNOUNCEMENT, sourceId: "notes" },
      description: "Completar a tabela das organelas",
      kind: "shortAnswer",
      options: null,
    },
    {
      citation: { passage: ANNOUNCEMENT, sourceId: "notes" },
      description: "Dissertativa sobre osmose",
      kind: "essay",
      options: null,
    },
  ],
  mock: null,
  rules: [],
  subjects: [],
};

const OSMOSIS = "Osmose em células animais e vegetais";

/**
 * Pedro's shape (persona pass 7): passive transport, whose third lesson is osmosis, and the
 * organelles' roles, both missed in placement; nucleus and viruses answered right once.
 */
async function setup() {
  const user = await userFixture();

  const [blueprint, library] = await Promise.all([
    examBlueprintFixture({
      name: "Prova de biologia",
      ownerId: user.id,
      structure: NOTES_STRUCTURE,
      visibility: "private",
    }),
    planLibraryFixture({
      skills: [
        { area: "Biologia", lessons: 3, weight: 4 },
        { area: "Biologia", lessons: 3, weight: 5 },
        { area: "Biologia", lessons: 1, weight: 2 },
        { area: "Biologia", lessons: 1, weight: 3 },
      ],
    }),
  ]);

  const [passive, organelles, nucleus, virus] = library.skills;
  const osmosis = library.lessons[2];

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 20,
    details: { placementDeclined: true },
    examBlueprintId: blueprint.id,
    kind: "exam",
    targetDate: new Date(TODAY.getTime() + 2 * DAY_MS),
    timezone: "UTC",
    userId: user.id,
  });

  const items = await Promise.all(
    library.skills.map((skill) => itemFixture({ content: choiceItemContent(), skillId: skill.id })),
  );

  const answer = (index: number, isCorrect: boolean) =>
    attemptFixture({
      answeredAt: new Date(TODAY.getTime() - DAY_MS),
      isCorrect,
      itemId: items[index]?.id ?? null,
      skillId: library.skills[index]?.id ?? null,
      userId: user.id,
    });

  // One right answer: he recalls it for a couple of days, which the plan reads as known.
  const knownOnce = (skillId: string) =>
    learnerSkillFixture({
      difficulty: 5,
      due: new Date(TODAY.getTime() + 2 * DAY_MS),
      lastReviewedAt: new Date(TODAY.getTime() - DAY_MS),
      reps: 1,
      skillId,
      stability: 2.3,
      state: "learning",
      userId: user.id,
    });

  await Promise.all([
    prisma.lesson.update({ data: { title: OSMOSIS }, where: { id: osmosis?.id ?? "" } }),
    answer(0, false),
    answer(1, false),
    answer(2, true),
    answer(3, true),
    knownOnce(nucleus?.id ?? ""),
    knownOnce(virus?.id ?? ""),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
  ]);

  mockSession(user.id);
  await createGoalPlan({ goalId: goal.id, graph: library.graph });

  return { nucleus, organelles, passive, plan, virus };
}

describe("a class test whose material announces its questions", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const now = new Date(TODAY.getTime() + 12 * 60 * 60 * 1000);
    vi.setSystemTime(now);

    vi.mocked(getRequestProgressDateContext).mockResolvedValue({
      currentDate: TODAY,
      currentInstant: now,
      timeZone: "UTC",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the lesson on his miss the teacher announced an essay on, before what he knows", async () => {
    const { nucleus, passive, plan, virus } = await setup();

    const lessons = await prisma.planItem.findMany({
      orderBy: { position: "asc" },
      where: { kind: "lesson", planId: plan.id },
    });

    const titles = lessons.map((item) => item.titleSnapshot);
    const skills = new Set(lessons.map((item) => item.skillId));

    // The announced topic comes first, with its skill's core; what he knows waits for it.
    expect(titles).toContain(OSMOSIS);
    expect(skills.has(passive?.id ?? "")).toBe(true);
    expect(skills.has(nucleus?.id ?? "") || skills.has(virus?.id ?? "")).toBe(false);
  });

  it("keeps the table practice the teacher announced through a focus on osmosis", async () => {
    const { goal, osmosis, plan, table } = await setupFormatSkills();
    const tableLessons = await listSkillTitles({ planId: plan.id, skillId: table.id });

    expect(tableLessons).toHaveLength(TABLE_LESSONS);

    const result = await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ areas: [AREA], kind: "focusAreas", parts: [osmosis] }] },
    });

    expect(result.status).toBe("applied");

    await expect(listSkillTitles({ planId: plan.id, skillId: table.id })).resolves.toStrictEqual(
      tableLessons,
    );
  });
});

/** Pass 9's reading of Pedro's notes: the formats, described without what they ask about. */
const GENERIC_FORMATS = {
  ...NOTES_STRUCTURE,
  formats: [
    { ...NOTES_STRUCTURE.formats[0], description: "Questão de completar tabela." },
    { ...NOTES_STRUCTURE.formats[1], description: "Questão dissertativa." },
  ],
};

const AREA = "Biologia Celular";
const TABLE_LESSONS = 4;

/** Pedro's graph from pass 9: a skill for each of the formats his teacher announced. */
const FORMAT_SKILLS = [
  { lessons: 3, name: "Explicar os fundamentos da teoria celular", weight: 3 },
  { lessons: 5, name: "Calcular e prever processos de transporte passivo", weight: 5 },
  { lessons: 5, name: "Identificar organelas de síntese e digestão", weight: 5 },
  { lessons: TABLE_LESSONS, name: "Completar tabelas de funções das organelas", weight: 4 },
  { lessons: 4, name: "Elaborar resposta dissertativa sobre comportamento osmótico", weight: 4 },
  { lessons: 3, name: "Descrever a morfologia do núcleo eucarionte", weight: 3 },
];

async function listSkillTitles({ planId, skillId }: { planId: string; skillId: string }) {
  const items = await prisma.planItem.findMany({
    orderBy: { position: "asc" },
    where: { kind: "lesson", planId, skillId, status: "todo" },
  });

  return items.map((item) => item.titleSnapshot).toSorted();
}

/**
 * Pedro a week before his test with 25 minutes a day, as persona pass 9 met him: his notes'
 * reading kept the formats the teacher announced but not what they ask about, and his graph has
 * a skill practicing each format.
 */
async function setupFormatSkills() {
  const user = await userFixture();

  const [blueprint, library] = await Promise.all([
    examBlueprintFixture({
      name: "Prova de biologia",
      ownerId: user.id,
      structure: GENERIC_FORMATS,
      visibility: "private",
    }),
    planLibraryFixture({
      skills: FORMAT_SKILLS.map((skill) => ({
        area: AREA,
        lessons: skill.lessons,
        weight: skill.weight,
      })),
    }),
  ]);

  const graph = {
    ...library.graph,
    skills: library.graph.skills.map((skill, index) => ({
      ...skill,
      name: FORMAT_SKILLS[index]?.name ?? skill.name,
    })),
  };

  const [, passive, , table, essay] = library.skills;

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 25,
    details: { placementDeclined: true },
    examBlueprintId: blueprint.id,
    kind: "exam",
    targetDate: new Date(TODAY.getTime() + 7 * DAY_MS),
    timezone: "UTC",
    userId: user.id,
  });

  await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
  mockSession(user.id);
  await createGoalPlan({ goalId: goal.id, graph });

  if (!table) {
    throw new Error("The library has no table skill.");
  }

  // His focus on osmosis: the passive transport skill that teaches it and the essay on it.
  const osmosis = { area: AREA, name: "Osmose", skillIds: [passive?.id ?? "", essay?.id ?? ""] };

  return { goal, osmosis, plan, table };
}
