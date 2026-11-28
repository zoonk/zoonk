import { describe, expect, it, vi } from "vitest";
import { type BlueprintExtraction } from "./extract-exam-blueprint";
import { applyWrittenTaskSubjects, listTaskSubjectInputs } from "./find-written-task-subjects";

vi.mock("server-only", () => ({}));
vi.mock("./find-written-task-subjects.prompt.md", () => ({ default: "Tie tasks to subjects." }));

type Section = NonNullable<BlueprintExtraction["mock"]>["sections"][number];
type Subject = BlueprintExtraction["subjects"][number];

const TASK = "uma questão sobre os conhecimentos gerais, de até 30 linhas";
const CASE = "um estudo de caso sobre a área escolhida, de até 60 linhas";
const TIE = "A questão versará sobre os conhecimentos gerais.";

function task(description: string): Section["tasks"][number] {
  return { count: 1, description, passages: [{ document: 1, passage: description }], plays: null };
}

function section(name: string, kind: Section["kind"], tasks: Section["tasks"] = []): Section {
  return {
    breakAfterMinutes: null,
    day: null,
    kind,
    minutes: 210,
    name,
    navigation: null,
    passages: [],
    questions: null,
    tasks,
    tools: null,
  };
}

function subject(name: string, group: string, choiceGroup: string | null = null): Subject {
  return {
    choiceGroup,
    group,
    matrix: [],
    name,
    otherGroups: [],
    partOf: null,
    passages: [],
    questions: null,
    shortName: name,
    topicHeadings: [],
    topics: [],
    weight: null,
  };
}

function reading(): BlueprintExtraction {
  return {
    choiceGroups: [],
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
      sections: [
        section("Prova objetiva", "objective"),
        section("Prova discursiva", "written", [task(TASK), task(CASE)]),
      ],
      timeLimitMinutes: null,
      totalQuestions: null,
    },
    reusePolicy: { document: null, passage: null, pastQuestions: "unknown" },
    rules: [],
    subjects: [
      subject("Ética", "Conhecimentos gerais"),
      subject("Auditoria", "Conhecimentos específicos", "Área"),
      subject("Sistemas", "Conhecimentos específicos", "Área"),
      subject("Prova discursiva", "Prova discursiva"),
    ],
    testedLanguage: null,
    topicFrequency: [],
  };
}

describe(listTaskSubjectInputs, () => {
  it("asks about each written task with the reading's subjects, parts and choices, never the written test itself", () => {
    expect(listTaskSubjectInputs(reading())).toStrictEqual({
      names: [
        "Ética",
        "Conhecimentos gerais",
        "Auditoria",
        "Conhecimentos específicos",
        "Área",
        "Sistemas",
      ],
      tasks: [
        { description: TASK, id: "2.1", section: "Prova discursiva" },
        { description: CASE, id: "2.2", section: "Prova discursiva" },
      ],
    });
  });
});

describe(applyWrittenTaskSubjects, () => {
  it("gives a task the subjects found for it with the passage that says so, and leaves the others as read", () => {
    const extraction = reading();

    const applied = applyWrittenTaskSubjects({
      extraction,
      found: [{ document: 1, passage: TIE, subjects: ["Conhecimentos gerais"], task: "2.1" }],
    });

    const [question, studyCase] = applied.mock?.sections[1]?.tasks ?? [];

    expect(question).toMatchObject({
      passages: [
        { document: 1, passage: TASK },
        { document: 1, passage: TIE },
      ],
      subjects: ["Conhecimentos gerais"],
    });

    expect(studyCase).toBe(extraction.mock?.sections[1]?.tasks[1]);
  });
});
