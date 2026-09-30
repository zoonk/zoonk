import { type BlueprintExtraction } from "@zoonk/ai/tasks/v2/research/extract-exam-blueprint";
import { type ExtractionDocument } from "../blueprint-passages";

export const NOTICE = [
  "3.2 O Exame será constituído de quatro provas objetivas e uma redação em Língua Portuguesa. Cada prova objetiva terá 45 (quarenta e cinco) questões de múltipla escolha.",
  "| Aplicação | 8/11 e 15/11/2026 |",
  "14.3 O cálculo das proficiências terá como base a Teoria de Resposta ao Item (TRI).",
  "LINGUAGENS: 1 Língua Portuguesa. 2 Literatura. 3 Língua Estrangeira (Inglês ou Espa-",
  "nhol).",
  "20.1 É permitida a reprodução das questões desde que citada a fonte.",
].join("\n");

export const DOCUMENTS: ExtractionDocument[] = [{ sourceId: "notice", text: NOTICE }];

const COUNT_PASSAGE =
  "Cada prova objetiva terá 45 (quarenta e cinco) questões de múltipla escolha.";

const SCORING_PASSAGE =
  "14.3 O cálculo das proficiências terá como base a Teoria de Resposta ao Item (TRI).";

/** An ENEM-like reading of `NOTICE`, with one subject citing a document research never read. */
export function blueprintExtraction(
  overrides: Partial<BlueprintExtraction> = {},
): BlueprintExtraction {
  return {
    dates: [
      {
        date: "2026-11-08",
        document: 1,
        kind: "exam",
        label: "1º dia",
        passage: "| Aplicação | 8/11 e 15/11/2026 |",
        startTime: "13:30",
      },
      {
        date: "8/11/2026",
        document: 1,
        kind: "exam",
        label: "Formato errado",
        passage: "| Aplicação | 8/11 e 15/11/2026 |",
        startTime: "1h30",
      },
    ],
    edition: { passages: [], questionCount: null, timeZone: "America/Sao_Paulo", year: null },
    formats: [
      {
        description: "Múltipla escolha com cinco alternativas",
        document: 1,
        kind: "multipleChoice",
        options: null,
        passage: COUNT_PASSAGE,
      },
    ],
    mock: {
      adaptive: false,
      order: null,
      passages: [
        { document: 1, passage: SCORING_PASSAGE },
        { document: 1, passage: COUNT_PASSAGE },
      ],
      scoring: { description: "Proficiência pela TRI", method: "itemResponseTheory" },
      sections: [
        { day: 1, minutes: 330, name: "Linguagens", questions: 45 },
        { day: 2, minutes: null, name: "Matemática", questions: 45 },
      ],
      timeLimitMinutes: null,
      totalQuestions: null,
    },
    reusePolicy: {
      document: 1,
      passage: "É permitida a reprodução das questões desde que citada a fonte.",
      pastQuestions: "allowedWithCitation",
    },
    rules: [
      {
        document: 1,
        passage: "A redação nota zero elimina o participante.",
        text: "Nota zero na redação elimina.",
      },
    ],
    subjects: [
      {
        name: "Linguagens",
        passages: [
          { document: 1, passage: "LINGUAGENS: 1 Língua Portuguesa. 2 Literatura." },
          { document: 1, passage: COUNT_PASSAGE },
        ],
        questions: 45,
        topics: ["Língua Portuguesa", "Língua Estrangeira (Inglês ou Espanhol)", "Gramática"],
        weight: 0.25,
      },
      {
        name: "Matemática",
        passages: [{ document: 2, passage: "Cada prova objetiva terá 45 questões." }],
        questions: 45,
        topics: [],
        weight: null,
      },
    ],
    topicFrequency: [],
    ...overrides,
  };
}
