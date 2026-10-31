import { type Random, seededRandom } from "@zoonk/utils/seeded-random";
import { describe, expect, it } from "vitest";
import { type PreparationSkill, type UnseenAnswer } from "./preparation-math";
import {
  getSubjectMastery,
  getSubjectPreparation,
  measurePreparation,
} from "./section-preparation";

const NOW = new Date("2026-10-13T12:00:00Z");
const BEFORE = new Date("2026-10-01T12:00:00Z");

function skill(skillId: string, section: string | null, studied: boolean, importance = 1) {
  return {
    areaId: "chapter",
    fading: false,
    importance,
    retrievability: studied ? 0.9 : null,
    section,
    skillId,
    state: studied ? "learning" : "new",
    studiedAt: studied ? BEFORE : null,
  } satisfies PreparationSkill;
}

const skills = [
  skill("math-1", "Matemática", true, 2),
  skill("math-2", "Matemática", false, 2),
  skill("lang-1", "Linguagens", true),
  skill("lang-2", "Linguagens", true),
  skill("loose", null, false),
];

const answers = ["math-1", "lang-1", "lang-2"].flatMap((skillId) =>
  Array.from({ length: 6 }, (_, index) => ({ answeredAt: BEFORE, isCorrect: index > 0, skillId })),
);

const mocks = [{ correct: 30, endedAt: BEFORE, total: 45 }];

const EPSILON = 1e-9;

const SECTIONS = ["Linguagens", "Língua Inglesa", "Humanas", "Natureza", "Matemática"];

function pick<T>(random: Random, values: readonly T[]): T {
  return values[Math.floor(random() * values.length)] ?? values[0]!;
}

function count(random: Random, max: number): number {
  return Math.floor(random() * (max + 1));
}

function randomGoal(random: Random) {
  const sections = SECTIONS.slice(0, 2 + count(random, 3));

  const goalSkills = sections.flatMap((section) =>
    Array.from({ length: 1 + count(random, 3) }, (_, index) => {
      const studied = random() < 0.7;

      return {
        areaId: section,
        fading: false,
        importance: pick(random, [0.5, 1, 1.5, 3]),
        retrievability: studied ? 0.3 + random() * 0.7 : null,
        section,
        skillId: `${section}-${index}`,
        state: studied ? "learning" : "new",
        studiedAt: studied ? BEFORE : null,
      } satisfies PreparationSkill;
    }),
  );

  const goalAnswers = goalSkills.flatMap((entry): UnseenAnswer[] => {
    const accuracy = random();

    return Array.from({ length: count(random, 6) }, () => ({
      answeredAt: BEFORE,
      isCorrect: random() < accuracy,
      skillId: entry.skillId,
    }));
  });

  return {
    answers: goalAnswers,
    asOf: NOW,
    mocks: random() < 0.5 ? [] : [{ correct: count(random, 45), endedAt: BEFORE, total: 45 }],
    skills: goalSkills,
    testKind: pick(random, ["mockExams", "fullReviews"] as const),
    testPlusRequired: random() < 0.2,
  };
}

describe(measurePreparation, () => {
  it("keeps the exact subject mean but requires evidence on the goal's hard part for Solid", () => {
    const medium = Array.from({ length: 20 }, (_, index) => ({
      ...skill(`medium-${index}`, "Medium subjects", true),
      retrievability: 0.95,
    }));

    const input = {
      answers: Array.from({ length: 40 }, (_, index) => ({
        answeredAt: BEFORE,
        isCorrect: true,
        skillId: `medium-${index % 20}`,
      })),
      asOf: NOW,
      mocks: [{ correct: 44, endedAt: BEFORE, total: 45 }],
      skills: [...medium, skill("hard", "Hard subject", false, 1.5)],
    };

    const measured = measurePreparation(input);
    expect(measured.components.coverage.heaviest.value).toBe(0);
    expect(measured.value).toBeCloseTo(0.886500213291165, 12);
    expect(measured.stage).toBe("growing");

    const confirmed = measurePreparation({
      ...input,
      skills: input.skills.map((entry) => ({ ...entry, retrievability: 0.95, studiedAt: BEFORE })),
    });

    expect(confirmed.components.coverage.heaviest.value).toBe(1);

    expect(confirmed.value).toBeCloseTo(
      confirmed.sections.reduce((sum, entry) => sum + entry.preparation * entry.weight, 0),
      12,
    );

    expect(confirmed.stage).toBe("solid");
  });

  it("measures each section by the goal's rule, weighted by its share of the goal", () => {
    const { sections, value: goal } = measurePreparation({ answers, asOf: NOW, mocks, skills });

    expect(sections.map(({ section, weight }) => [section, weight])).toStrictEqual([
      ["Matemática", 4 / 7],
      ["Linguagens", 2 / 7],
    ]);

    const [math, languages] = sections;

    expect(languages?.preparation).toBeGreaterThan(math?.preparation ?? 1);

    const weighted = sections.reduce((sum, entry) => sum + entry.preparation * entry.weight, 0);
    expect(weighted).toBeCloseTo(goal, 12);
  });

  it("reads the whole as its subjects together when each has too few answers to count", () => {
    const studied = [skill("a", "A", true), skill("b", "B", true)];

    const sparse = studied.flatMap((entry) =>
      Array.from({ length: 3 }, () => ({
        answeredAt: BEFORE,
        isCorrect: true,
        skillId: entry.skillId,
      })),
    );

    const { components, sections, value } = measurePreparation({
      answers: sparse,
      asOf: NOW,
      mocks: [],
      skills: studied,
    });

    expect(sections.map((section) => section.preparation)).toStrictEqual([
      expect.closeTo(0.27),
      expect.closeTo(0.27),
    ]);

    expect(value).toBeCloseTo(0.27);
    expect(components.mastery.value).toBeNull();
  });

  it("never puts the whole outside the range its subjects make", () => {
    const outside = Array.from({ length: 300 }, (_, index) => index + 1).flatMap((seed) => {
      const goal = randomGoal(seededRandom(seed));
      const { sections, value } = measurePreparation(goal);

      const [first, second, ...rest] = sections;

      const subjects =
        first && second && rest.length > 0
          ? [[first, second], ...rest.map((section) => [section])]
          : sections.map((section) => [section]);

      const shares = subjects.map(
        (subject) =>
          getSubjectPreparation({ areas: subject.map((section) => section.section), sections }) ??
          0,
      );

      const low = Math.min(...shares);
      const high = Math.max(...shares);

      return value < low - EPSILON || value > high + EPSILON ? [{ high, low, seed, value }] : [];
    });

    expect(outside).toStrictEqual([]);
  });
});

describe(getSubjectPreparation, () => {
  const sections = [
    { mastery: { answered: 8, correct: 6 }, preparation: 0.6, section: "Linguagens", weight: 0.3 },
    { mastery: null, preparation: 0.2, section: "Língua Inglesa", weight: 0.1 },
    { mastery: null, preparation: 0, section: "Matemática", weight: 0.6 },
  ];

  it("weighs the sections a subject gathers by their share of the goal", () => {
    expect(
      getSubjectPreparation({ areas: ["Linguagens", "Língua Inglesa"], sections }),
    ).toBeCloseTo(0.5);
  });

  it("has nothing to say of a subject the goal doesn't measure", () => {
    expect(getSubjectPreparation({ areas: ["Redação"], sections })).toBeNull();
  });

  it("averages sections that carry no weight", () => {
    expect(
      getSubjectPreparation({
        areas: ["A", "B"],
        sections: [
          { mastery: null, preparation: 0.4, section: "A", weight: 0 },
          { mastery: null, preparation: 0.2, section: "B", weight: 0 },
        ],
      }),
    ).toBeCloseTo(0.3);
  });

  it("says how well a subject is known from its sections with enough answers", () => {
    expect(getSubjectMastery({ areas: ["Linguagens", "Língua Inglesa"], sections })).toStrictEqual({
      answered: 8,
      correct: 6,
    });

    expect(getSubjectMastery({ areas: ["Matemática"], sections })).toBeNull();
  });
});
