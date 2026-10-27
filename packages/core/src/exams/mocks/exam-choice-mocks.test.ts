import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getMock } from "./get-mock";
import { startAnytimeMock } from "./start-anytime-mock";

const CITATION = { passage: "From the notice.", sourceId: "source" };
const LANGUAGES = "Languages, Codes and their Technologies";
const GROUP = "Foreign language";

/**
 * An ENEM-like first day: ten questions over Languages and Humanities, where Languages' five
 * include one of the foreign language the learner takes, English or Spanish.
 */
const STRUCTURE = {
  formats: [],
  mock: {
    adaptive: false,
    citations: [],
    order: null,
    scoring: { description: "", method: "raw" },
    sections: [
      { day: 1, kind: "objective", minutes: 30, name: "Languages and Humanities", questions: 10 },
    ],
    timeLimitMinutes: 30,
    totalQuestions: 10,
  },
  rules: [],
  subjects: [
    {
      citation: CITATION,
      name: LANGUAGES,
      questions: 5,
      shortName: "Languages",
      topics: [],
      weight: null,
    },
    ...["English", "Spanish"].map((name) => ({
      choiceGroup: GROUP,
      citation: CITATION,
      name,
      partOf: LANGUAGES,
      questions: 1,
      topics: [],
      weight: null,
    })),
    { citation: CITATION, name: "Humanities", questions: 5, topics: [], weight: null },
  ],
};

/** The plan's areas, each with its topics, as the plan studies them once Spanish is picked. */
const AREAS = [
  { name: LANGUAGES, skills: 4 },
  { name: "Spanish", skills: 1 },
  { name: "Humanities", skills: 4 },
] as const;

describe("mocks of an exam with a choice of subject", () => {
  it("ask the foreign language the learner picked, out of the share of the subject it's part of", async () => {
    const [user, blueprint] = await Promise.all([
      userFixture(),
      examBlueprintFixture({ structure: STRUCTURE }),
    ]);

    const skills = await Promise.all(
      AREAS.flatMap((area) =>
        Array.from({ length: area.skills }, async (_, index) => ({
          area: area.name,
          skill: await skillFixture({ name: `${area.name} ${index} ${crypto.randomUUID()}` }),
        })),
      ),
    );

    const goal = await goalFixture({
      examBlueprintId: blueprint.id,
      kind: "exam",
      timezone: "UTC",
      userId: user.id,
    });

    const plan = await planFixture({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: null, name: "Basics" }],
        skills: skills.map(({ area, skill }) => ({
          area,
          lessons: 1,
          name: skill.name,
          phase: 0,
          skillId: skill.id,
          weight: null,
        })),
      },
      settings: { examChoices: [{ group: GROUP, subject: "Spanish" }] },
    });

    await Promise.all([
      ...skills.map(({ skill }, position) =>
        planItemFixture({ kind: "lesson", planId: plan.id, position, skillId: skill.id }),
      ),
      ...skills.flatMap(({ skill }) =>
        Array.from({ length: 3 }, () =>
          itemFixture({
            content: choiceItemContent(),
            examBlueprintId: blueprint.id,
            skillId: skill.id,
          }),
        ),
      ),
      prisma.subscription.create({
        data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
      }),
    ]);

    mockSession(user.id);

    const started = await startAnytimeMock({
      goalId: goal.id,
      input: { shape: { area: null, day: 1, kind: "full" }, timeZone: "UTC" },
    });

    if (started.status !== "started") {
      throw new Error(`Expected a started mock, got ${started.status}`);
    }

    const mock = await getMock(started.id);
    const asked = mock.status === "ready" ? (mock.mock.current?.questions ?? []) : [];
    const areaOf = new Map(skills.map(({ area, skill }) => [skill.id, area]));

    const items = await prisma.item.findMany({
      select: { id: true, skillId: true },
      where: { id: { in: asked.map((question) => question.itemId) } },
    });

    const count = (area: string) =>
      items.filter((item) => item.skillId && areaOf.get(item.skillId) === area).length;

    expect({
      humanities: count("Humanities"),
      languages: count(LANGUAGES),
      spanish: count("Spanish"),
    }).toStrictEqual({ humanities: 5, languages: 4, spanish: 1 });
  });
});
