import { prisma } from "@zoonk/db";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { describe, expect, it } from "vitest";
import { chooseExamOptionSkills } from "../_utils/exam-option-skills";
import { addSharedOptionSkills, joinOptionSkills, setAsideOptionSkills } from "./option-skills";
import { type PlanGraph, parsePlanGraph } from "./plan-state";

const ENGLISH = "Lengua Extranjera: inglés";
const FRENCH = "Lengua Extranjera: francés";

function skill(skillId: string, area: string, phase = 0) {
  return { area, lessons: 2, name: skillId, phase, skillId, weight: null };
}

const GRAPH: PlanGraph = {
  phases: [
    { milestone: null, name: "Bases" },
    { milestone: null, name: "Práctica" },
  ],
  skills: [
    skill("reading", "Lengua Castellana"),
    skill("en-1", ENGLISH),
    skill("en-2", ENGLISH),
    skill("fr-1", FRENCH),
    skill("history", "Historia de España"),
    skill("essay", "Lengua Castellana", 1),
  ],
};

const ids = (graph: PlanGraph) => graph.skills.map((item) => item.skillId);
const asideIds = (graph: PlanGraph) => (graph.optionSkills ?? []).map((item) => item.skillId);

describe(setAsideOptionSkills, () => {
  it("sets aside every option of a choice not picked yet, each with the skill it came after", () => {
    const graph = setAsideOptionSkills({ areas: new Set([ENGLISH, FRENCH]), graph: GRAPH });

    expect(ids(graph)).toStrictEqual(["reading", "history", "essay"]);

    expect(graph.optionSkills?.map(({ after, skillId }) => [skillId, after])).toStrictEqual([
      ["en-1", "reading"],
      ["en-2", "reading"],
      ["fr-1", "reading"],
    ]);
  });

  it("swaps one option's skills for another's in the same place when the pick changes", () => {
    const none = setAsideOptionSkills({ areas: new Set([ENGLISH, FRENCH]), graph: GRAPH });
    const french = setAsideOptionSkills({ areas: new Set([ENGLISH]), graph: none });

    expect(ids(french)).toStrictEqual(["reading", "fr-1", "history", "essay"]);
    expect(asideIds(french)).toStrictEqual(["en-1", "en-2"]);

    const english = setAsideOptionSkills({ areas: new Set([FRENCH]), graph: french });

    expect(ids(english)).toStrictEqual(["reading", "en-1", "en-2", "history", "essay"]);
    expect(asideIds(english)).toStrictEqual(["fr-1"]);
  });

  it("leaves a graph without options to set aside as it is", () => {
    expect(setAsideOptionSkills({ areas: new Set(), graph: GRAPH })).toStrictEqual(GRAPH);
  });
});

describe(joinOptionSkills, () => {
  it("brings a skill whose anchor left the graph back at the end of its phase", () => {
    const graph: PlanGraph = {
      ...GRAPH,
      optionSkills: [{ ...skill("fr-1", FRENCH), after: "gone" }],
      skills: GRAPH.skills.filter((item) => item.area !== FRENCH),
    };

    expect(ids(joinOptionSkills(graph))).toStrictEqual([
      "reading",
      "en-1",
      "en-2",
      "history",
      "fr-1",
      "essay",
    ]);

    expect(joinOptionSkills(graph).optionSkills).toBeUndefined();
  });
});

describe(addSharedOptionSkills, () => {
  it("adds a picked option a plan never had from the shared graph, after its neighbor there", () => {
    const old: PlanGraph = {
      ...GRAPH,
      skills: GRAPH.skills
        .filter((item) => item.area !== ENGLISH && item.area !== FRENCH)
        .map((item) => (item.skillId === "history" ? { ...item, phase: 1 } : item)),
    };

    const graph = addSharedOptionSkills({ areas: new Set([FRENCH]), graph: old, shared: GRAPH });

    expect(ids(graph)).toStrictEqual(["reading", "fr-1", "history", "essay"]);
    expect(graph.skills.find((item) => item.skillId === "fr-1")?.phase).toBe(0);
  });
});

describe(chooseExamOptionSkills, () => {
  it("keeps the picked option's reading and writing when switching or rebuilding", async () => {
    const french = "French";
    const spanish = "Spanish";
    const group = "Foreign language";
    const reading = "Read public notices";
    const common = { ...skill("common-writing", "Writing"), outcome: true };

    const blueprint = await examBlueprintFixture({
      structure: {
        formats: [],
        mock: null,
        rules: [],
        subjects: [french, spanish].map((name) => ({
          choiceGroup: group,
          citation: { passage: "Choose French or Spanish", sourceId: "notice" },
          name,
          questions: null,
          topics: name === french ? [reading] : [],
          weight: null,
        })),
      },
    });

    const full: PlanGraph = {
      phases: GRAPH.phases,
      skills: [
        { ...skill("french-reading", french), topics: [reading] },
        { ...skill("french-writing", "Writing"), outcome: true, subject: french },
        { ...skill("spanish-writing", "Writing"), outcome: true, subject: spanish },
        common,
      ],
    };

    const pick = (graph: PlanGraph, subject: string) =>
      chooseExamOptionSkills({
        goal: { examBlueprintId: blueprint.id, kind: "exam" },
        graph: parsePlanGraph(graph),
        picks: { examChoices: [{ group, subjects: [subject] }], examSubjects: [] },
      });

    const pickedSpanish = await pick(full, spanish);
    expect(ids(pickedSpanish)).toStrictEqual(["spanish-writing", "common-writing"]);

    const pickedFrench = await pick(pickedSpanish, french);
    expect(ids(pickedFrench)).toStrictEqual(["french-reading", "french-writing", "common-writing"]);

    await prisma.examSkillGraph.create({
      data: {
        examBlueprintId: blueprint.id,
        generatedAt: new Date(),
        graph: full,
        model: "test",
        promptVersion: "test",
        runId: crypto.randomUUID(),
      },
    });

    const rebuilt = await pick({ ...full, skills: [common] }, french);
    expect(ids(rebuilt)).toStrictEqual(ids(pickedFrench));
  });
});
