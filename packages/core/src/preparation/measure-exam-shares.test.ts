import { describe, expect, it } from "vitest";
import { getSubjectPreparation, measurePreparation } from "./section-preparation";

const NOW = new Date("2026-10-13T12:00:00Z");
const BEFORE = new Date("2026-10-01T12:00:00Z");

function skill(skillId: string, section: string, studied = false, importance = 1) {
  return {
    areaId: section,
    fading: false,
    importance,
    retrievability: studied ? 0.9 : null,
    section,
    skillId,
    state: "new" as const,
    studiedAt: studied ? BEFORE : null,
  };
}

const skills = [
  skill("math", "Math", true),
  ...Array.from({ length: 3 }, (_, index) => skill(`language-${index}`, "Language")),
];

const input = { answers: [], asOf: NOW, mocks: [], skills };

const sectionWeights = new Map([
  ["Math", 0.5],
  ["Language", 0.5],
]);

describe("preparation weighted by exam shares", () => {
  it("keeps equal-share subjects equal despite different numbers and difficulties of skills", () => {
    const { sections, value } = measurePreparation({
      ...input,
      sectionWeights,
      skills: skills.map((entry) => ({
        ...entry,
        importance: entry.section === "Math" ? 0.5 : 1.5,
      })),
    });

    expect(sections.map(({ weight }) => weight)).toStrictEqual([0.5, 0.5]);
    expect(value).toBeCloseTo(0.135);
  });

  it("keeps zero-share and unmatched sections out of the exam's preparation", () => {
    const { components, sections, value } = measurePreparation({
      ...input,
      answers: Array.from({ length: 5 }, () => ({
        answeredAt: BEFORE,
        isCorrect: true,
        skillId: "strategy",
      })),
      sectionWeights: new Map([
        ["Math", 1],
        ["Language", 0],
      ]),
      skills: [...skills, skill("strategy", "Exam strategy", true, 5)],
    });

    expect(sections.map(({ weight }) => weight)).toStrictEqual([1, 0, 0]);
    expect(value).toBeCloseTo(0.27);
    expect(components.mastery.value).toBeNull();
  });

  it("normalizes the shares of the sections still in the goal", () => {
    const { sections, value } = measurePreparation({
      ...input,
      sectionWeights,
      skills: skills.filter((entry) => entry.section === "Math"),
    });

    expect(sections.map(({ weight }) => weight)).toStrictEqual([1]);
    expect(value).toBeCloseTo(0.27);
  });

  it("preserves a subject's share when it gathers multiple sections", () => {
    const { sections, value } = measurePreparation({
      ...input,
      sectionWeights: new Map([
        ["Math", 0.5],
        ["Language", 0.4],
        ["English", 0.1],
      ]),
      skills: [...skills, skill("english", "English", true)],
    });

    const language = getSubjectPreparation({ areas: ["Language", "English"], sections });
    const math = getSubjectPreparation({ areas: ["Math"], sections });

    expect(sections.map(({ weight }) => weight)).toStrictEqual([0.5, 0.4, 0.1]);
    expect(value).toBeCloseTo((math ?? 0) * 0.5 + (language ?? 0) * 0.5);
  });

  it("does not credit a goal whose included sections all have zero exam shares", () => {
    const { sections, value } = measurePreparation({
      ...input,
      sectionWeights: new Map([
        ["Math", 0],
        ["Language", 0],
      ]),
    });

    expect(sections.map(({ weight }) => weight)).toStrictEqual([0, 0]);
    expect(value).toBe(0);
  });

  it.each([undefined, new Map<string, number>()])(
    "keeps importance weighting when no exam shares are available (%s)",
    (weights) => {
      const { sections, value } = measurePreparation({ ...input, sectionWeights: weights });

      expect(sections.map(({ weight }) => weight)).toStrictEqual([0.25, 0.75]);
      expect(value).toBeCloseTo(0.0675);
    },
  );
});
