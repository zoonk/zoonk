import { describe, expect, it } from "vitest";
import { type BlueprintExtraction } from "./extract-exam-blueprint";
import { withWrittenTestSubjects } from "./written-test-subjects";

type Section = NonNullable<BlueprintExtraction["mock"]>["sections"][number];
type Subject = BlueprintExtraction["subjects"][number];

const DURATION = "A prova discursiva terá a duração de 3 horas e 30 minutos.";

function section(name: string, kind: Section["kind"]): Section {
  return {
    breakAfterMinutes: null,
    day: null,
    kind,
    minutes: 210,
    name,
    navigation: null,
    passages: [{ document: 1, passage: DURATION }],
    questions: null,
    tasks: [],
    tools: null,
  };
}

function subject(name: string, group: string | null): Subject {
  return {
    choiceGroup: null,
    group,
    matrix: [],
    name,
    partOf: null,
    passages: [],
    questions: null,
    shortName: name,
    topicHeadings: [],
    topics: [],
    weight: null,
  };
}

function reading({
  sections,
  subjects,
}: {
  sections: Section[];
  subjects: Subject[];
}): BlueprintExtraction {
  return {
    dates: [],
    edition: { passages: [], questionCount: null, timeZone: null, year: null },
    formats: [],
    mock: {
      adaptive: false,
      order: null,
      passages: [],
      scoring: {
        description: "",
        finalShares: [],
        marking: [],
        method: "raw",
        parts: [],
        relative: false,
        scale: null,
        totalMinimum: null,
        wrongPenalty: null,
      },
      sections,
      timeLimitMinutes: null,
      totalQuestions: null,
    },
    reusePolicy: { document: null, passage: null, pastQuestions: "unknown" },
    rules: [],
    subjects,
    testedLanguage: null,
    topicFrequency: [],
  };
}

const OBJECTIVE = subject("Língua Portuguesa", "Conhecimentos básicos (P1)");

describe(withWrittenTestSubjects, () => {
  it("makes a written test the notice only times or scores a subject in its own part", () => {
    const read = reading({
      sections: [
        section("Provas objetivas", "objective"),
        section("Prova discursiva (P4)", "written"),
      ],
      subjects: [OBJECTIVE],
    });

    expect(withWrittenTestSubjects(read).subjects).toStrictEqual([
      OBJECTIVE,
      {
        ...subject("Prova discursiva (P4)", "Prova discursiva (P4)"),
        passages: [{ document: 1, passage: DURATION }],
      },
    ]);
  });

  it("leaves a written test the reading already made a subject", () => {
    const read = reading({
      sections: [section("Prova discursiva (P4)", "written")],
      subjects: [OBJECTIVE, subject("Prova discursiva", "Prova discursiva (P4)")],
    });

    expect(withWrittenTestSubjects(read)).toBe(read);
  });
});
