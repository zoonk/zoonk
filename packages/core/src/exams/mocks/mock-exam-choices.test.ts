import { describe, expect, it } from "vitest";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { type ExamChoice, toChosenStructure } from "../choices/exam-choices";
import { planOptionMock } from "./mock-option-plan";
import { listMockOptions } from "./mock-options";
import { type MockCandidate } from "./mock-plan";

const citation = { passage: "", sourceId: "notice" };
const LANGUAGES = "Languages, Codes and their Technologies";
const GROUP = "Foreign language";
const SPANISH: ExamChoice = { group: GROUP, subject: "Spanish" };

/**
 * An ENEM-like first day: one section of ten questions over Languages and Humanities, whose
 * Languages count includes the foreign language the learner takes (English or Spanish).
 * `optionQuestions`: the count the notice gives each language, null when it gives none.
 */
function enemDay(optionQuestions: number | null): ExamStructure {
  const option = (name: string) => ({
    choiceGroup: GROUP,
    citation,
    name,
    partOf: LANGUAGES,
    questions: optionQuestions,
    topics: [],
    weight: null,
  });

  return {
    formats: [],
    mock: {
      adaptive: false,
      citations: [],
      order: null,
      scoring: { description: "", method: "raw" },
      sections: [{ day: 1, minutes: 30, name: "Languages and Humanities", questions: 10 }],
      timeLimitMinutes: 30,
      totalQuestions: 10,
    },
    rules: [],
    subjects: [
      { citation, name: LANGUAGES, questions: 5, shortName: "Languages", topics: [], weight: null },
      option("English"),
      option("Spanish"),
      { citation, name: "Humanities", questions: 5, topics: [], weight: null },
    ],
  };
}

/** The exam's bank on the plan's areas: `skills` topics in each, a few questions per topic. */
function bank(area: string, { count, skills }: { count: number; skills: number }) {
  return Array.from({ length: count }, (_, index): MockCandidate => ({
    answered: false,
    area,
    difficulty: null,
    itemId: `${area}#${index}`,
    skillId: `${area}-skill-${index % skills}`,
  }));
}

const CANDIDATES = [
  ...bank(LANGUAGES, { count: 12, skills: 4 }),
  ...bank("English", { count: 6, skills: 1 }),
  ...bank("Spanish", { count: 6, skills: 1 }),
  ...bank("Humanities", { count: 12, skills: 4 }),
];

/** How many questions of each area the full mock of the day asks, for the learner's picks. */
function askedByArea({
  choices,
  structure,
}: {
  choices: readonly ExamChoice[];
  structure: ExamStructure;
}) {
  const chosen = toChosenStructure({ choices, structure });

  const [full] = listMockOptions({
    dayInTurn: 1,
    goalAreas: [LANGUAGES, "Spanish", "Humanities"],
    structure: chosen,
  });

  if (!full) {
    throw new Error("Expected the full mock");
  }

  const plan = planOptionMock({ candidates: CANDIDATES, option: full, structure: chosen });
  const asked = plan.sections.flatMap((section) => section.itemIds);

  return Object.fromEntries(
    [LANGUAGES, "English", "Spanish", "Humanities"].map((area) => [
      area,
      asked.filter((id) => id.startsWith(`${area}#`)).length,
    ]),
  );
}

describe("a mock of an exam with a choice of subject", () => {
  it("asks the option the learner picked, out of the count of the subject it's part of", () => {
    expect(askedByArea({ choices: [SPANISH], structure: enemDay(1) })).toStrictEqual({
      English: 0,
      Humanities: 5,
      [LANGUAGES]: 4,
      Spanish: 1,
    });
  });

  it("asks no option before the learner picks one: the subject it's part of keeps its count", () => {
    expect(askedByArea({ choices: [], structure: enemDay(1) })).toStrictEqual({
      English: 0,
      Humanities: 5,
      [LANGUAGES]: 5,
      Spanish: 0,
    });
  });

  it("gives an option the notice doesn't count its part of its subject by topics", () => {
    // Languages has four topics in the bank and Spanish one: a fifth of Languages' five questions.
    expect(askedByArea({ choices: [SPANISH], structure: enemDay(null) })).toStrictEqual({
      English: 0,
      Humanities: 5,
      [LANGUAGES]: 4,
      Spanish: 1,
    });
  });

  // Ana takes English: the chooser offered "Língua Inglesa, 5 questions" as a subject of its own
  // and named it beside Languages on the first day, while her Plan counts it in Languages' 45.
  it("offers the option the learner picked inside its subject, never as a subject of its own", () => {
    const chosen = toChosenStructure({ choices: [SPANISH], structure: enemDay(1) });

    const options = listMockOptions({
      dayInTurn: 1,
      goalAreas: [LANGUAGES, "Spanish", "Humanities"],
      structure: chosen,
    });

    expect(options.find((option) => option.kind === "full")?.areas).toStrictEqual([
      LANGUAGES,
      "Humanities",
    ]);

    const subjects = options.filter((option) => option.kind === "area");

    expect(subjects.map((option) => [option.area, option.questions])).toStrictEqual([
      [LANGUAGES, 5],
      ["Humanities", 5],
    ]);

    // Languages' own mock asks the language she takes, as its share of the subject.
    const languages = subjects.find((option) => option.area === LANGUAGES);

    if (!languages) {
      throw new Error("Expected Languages' mock");
    }

    const plan = planOptionMock({ candidates: CANDIDATES, option: languages, structure: chosen });
    const asked = plan.sections.flatMap((section) => section.itemIds);

    expect(
      [LANGUAGES, "English", "Spanish", "Humanities"].map(
        (area) => asked.filter((id) => id.startsWith(`${area}#`)).length,
      ),
    ).toStrictEqual([4, 0, 1, 0]);
  });
});
