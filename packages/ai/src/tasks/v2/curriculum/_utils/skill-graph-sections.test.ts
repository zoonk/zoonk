import { describe, expect, it } from "vitest";
import { type ExamOutline } from "../exam-outline";
import {
  type GraphFrameSection,
  joinSections,
  shouldWriteInSections,
  toSectionCalls,
} from "./skill-graph-sections";

function outline(subjects: number): ExamOutline {
  return {
    name: "Concurso",
    notes: [],
    subjects: Array.from({ length: subjects }, (_, index) => ({
      group: null,
      name: `Subject ${index + 1}`,
      questions: null,
      topics: ["Topic"],
      weight: null,
    })),
    topicFrequency: [],
  };
}

function section(subject: string, skills: number): GraphFrameSection {
  return {
    area: subject,
    course: "course",
    estimatedLessons: skills * 20,
    phases: [1],
    skills,
    subject,
  };
}

describe(shouldWriteInSections, () => {
  it("writes an exam with several subjects in sections, and anything else whole", () => {
    expect(shouldWriteInSections({ examBlueprint: outline(9) })).toBe(true);
    expect(shouldWriteInSections({ examBlueprint: outline(3) })).toBe(false);
    expect(shouldWriteInSections({})).toBe(false);

    // A test sized to the lessons that fit before it adds its sizes up in one answer.
    expect(shouldWriteInSections({ examBlueprint: outline(9), lessonBudget: 40 })).toBe(false);
  });
});

describe(toSectionCalls, () => {
  it("deals the sections with the most skills first to the lightest call, keeping the frame's order in each", () => {
    const sections = [
      section("S1", 30),
      section("S2", 8),
      section("S3", 25),
      section("S4", 6),
      section("S5", 4),
      section("S6", 20),
      section("S7", 3),
      section("", 2),
    ];

    const calls = toSectionCalls(sections);

    expect(calls.map((call) => call.map((item) => item.subject))).toStrictEqual([
      ["S1"],
      ["S3"],
      ["S6"],
      ["S2"],
      ["S4", ""],
      ["S5", "S7"],
    ]);

    // Every section is written exactly once.
    expect(calls.flat().toSorted((a, b) => a.subject.localeCompare(b.subject))).toStrictEqual(
      sections.toSorted((a, b) => a.subject.localeCompare(b.subject)),
    );
  });

  it("writes a few sections a call each, and nothing without sections", () => {
    expect(toSectionCalls([section("S1", 10), section("S2", 10)])).toHaveLength(2);
    expect(toSectionCalls([])).toStrictEqual([]);
  });
});

function rawSkill({
  key,
  prerequisites = [],
  topics = [],
}: {
  key: string;
  prerequisites?: string[];
  topics?: string[];
}) {
  return {
    area: "Area",
    course: "course",
    description: key,
    estimatedLessons: 10,
    examWeight: 3,
    key,
    level: "intermediate" as const,
    name: key,
    outcome: false,
    phase: 1,
    prerequisites,
    topics,
  };
}

describe(joinSections, () => {
  it("keeps keys of different calls apart, and their prerequisites inside each call", () => {
    const joined = joinSections([
      [rawSkill({ key: "interpret-texts", prerequisites: ["read-closely"] })],
      [rawSkill({ key: "interpret-texts" })],
    ]);

    expect(joined.map((skill) => [skill.key, skill.prerequisites])).toStrictEqual([
      ["s1-interpret-texts", ["s1-read-closely"]],
      ["s2-interpret-texts", []],
    ]);
  });

  it("turns a topic another call's subject teaches into the first skill that teaches it", () => {
    const joined = joinSections([
      [
        rawSkill({ key: "constitution-basics", topics: ["S2.1"] }),
        rawSkill({ key: "legislative-process-rules", topics: ["S2.4", "S2.5"] }),
        rawSkill({ key: "amendments", topics: ["S2.4"] }),
      ],
      [
        rawSkill({ key: "bill-procedure", prerequisites: ["S2.4", "S9.9"], topics: ["S5.1"] }),
        rawSkill({ key: "own-topic", prerequisites: ["S5.1"], topics: ["S5.2"] }),
      ],
    ]);

    // A topic nobody teaches points nowhere, and a skill never needs itself.
    expect(joined.map((skill) => [skill.key, skill.prerequisites])).toStrictEqual([
      ["s1-constitution-basics", []],
      ["s1-legislative-process-rules", []],
      ["s1-amendments", []],
      ["s2-bill-procedure", ["s1-legislative-process-rules"]],
      ["s2-own-topic", ["s2-bill-procedure"]],
    ]);
  });
});
