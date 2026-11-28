import { type BlueprintExtraction } from "../extract-exam-blueprint";

type Section = NonNullable<BlueprintExtraction["mock"]>["sections"][number];
type Subject = BlueprintExtraction["subjects"][number];

export const TASK = "uma questão sobre os conhecimentos gerais, de até 30 linhas";
export const CASE = "um estudo de caso sobre a área escolhida, de até 60 linhas";
export const TIE = "A questão versará sobre os conhecimentos gerais.";

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

export function reading(): BlueprintExtraction {
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
