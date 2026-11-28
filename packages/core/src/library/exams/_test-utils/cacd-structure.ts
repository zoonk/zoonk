import { type ExamStructure } from "../blueprint-contract";

const citation = { passage: "…", sourceId: "notice" };

const FIRST = "Primeira Fase";
const SECOND = "Segunda Fase";
const LANGUAGE = "Idioma adicional";

/** Tested in both phases: true/false items in the first, a written test in the second. */
export const CACD_SHARED = [
  "Língua Portuguesa",
  "Língua Inglesa",
  "História do Brasil",
  "Política Internacional",
  "Geografia",
  "Economia",
  "Direito",
];

function subject(name: string, extra: Partial<ExamStructure["subjects"][number]>) {
  return { citation, name, questions: null, topics: [], weight: null, ...extra };
}

function written(name: string) {
  return { day: null, kind: "written" as const, minutes: 300, name, questions: null };
}

/**
 * The diplomat exam's shape: an eliminatory first phase of 240 true/false items over 8 areas that
 * doesn't count, then 8 written tests whose sum is the final score. Seven areas sit both phases.
 */
export function cacdStructure({
  finalShares = true,
  secondMaxPoints = null,
  secondQuestions = null,
  worldHistoryItems = null,
}: {
  finalShares?: boolean;
  secondMaxPoints?: number | null;
  secondQuestions?: number | null;
  worldHistoryItems?: number | null;
} = {}): ExamStructure {
  return {
    formats: [],
    mock: {
      adaptive: false,
      citations: [],
      order: null,
      scoring: {
        description: "",
        ...(finalShares ? { finalShares: [{ citation, parts: [SECOND], share: 1 }] } : {}),
        marking: [
          {
            citation,
            format: "trueFalse",
            part: FIRST,
            points: 1,
            questions: null,
            select: null,
            wrongPoints: 0.25,
          },
        ],
        method: "wrongCancelsRight",
        parts: [
          {
            citation,
            maxPoints: 240,
            minimum: { unit: "points", value: 120 },
            name: FIRST,
            qualifying: true,
            questions: 240,
          },
          {
            citation,
            maxPoints: secondMaxPoints,
            minimum: { unit: "points", value: 480 },
            name: SECOND,
            qualifying: false,
            questions: secondQuestions,
          },
        ],
      },
      sections: [
        {
          day: 1,
          kind: "objective",
          minutes: 210,
          name: "Prova objetiva da Primeira Fase — primeiro período",
          questions: null,
        },
        {
          day: 1,
          kind: "objective",
          minutes: 210,
          name: "Prova objetiva da Primeira Fase — segundo período",
          questions: null,
        },
        ...CACD_SHARED.map((name) => written(name)),
        written(LANGUAGE),
      ],
      timeLimitMinutes: null,
      totalQuestions: 240,
    },
    rules: [],
    subjects: [
      ...CACD_SHARED.map((name) => subject(name, { group: SECOND, otherGroups: [FIRST] })),
      subject("História Mundial", { group: FIRST, questions: worldHistoryItems }),
      subject("Língua Espanhola", { choiceGroup: LANGUAGE, group: SECOND }),
      subject("Língua Francesa", { choiceGroup: LANGUAGE, group: SECOND }),
    ],
  };
}
