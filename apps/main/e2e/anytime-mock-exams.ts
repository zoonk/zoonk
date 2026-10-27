/** The exams the anytime mock tests copy: one day of two subjects, or one with a written part. */
export const AREAS = ["Mathematics", "Languages"] as const;
const CITATION = { passage: "From the notice.", sourceId: "notice" };

/** One exam day of two sections of eight questions, each one of the notice's subjects. */
const STRUCTURE = {
  formats: [],
  mock: {
    adaptive: false,
    citations: [],
    order: null,
    scoring: { description: "", method: "raw" },
    sections: AREAS.map((name) => ({ day: null, minutes: 12, name, questions: 8 })),
    timeLimitMinutes: 24,
    totalQuestions: 16,
  },
  rules: [],
  subjects: AREAS.map((name) => ({
    citation: CITATION,
    name,
    questions: 8,
    topics: [],
    weight: null,
  })),
};

/** What the notice says it takes to pass, in its own words. */
const WRITTEN_PASS_MARK = "Aprovado quem obtiver no mínimo 4 dos 8 pontos (50%).";

/**
 * An exam day like a Cebraspe one: an objective test of eight Mathematics questions, then a
 * discursive test with its own half hour, and a pass mark in the notice.
 */
const WRITTEN_STRUCTURE = {
  formats: [
    {
      citation: CITATION,
      description: "Uma dissertação de até 30 linhas",
      kind: "essay",
      options: null,
    },
  ],
  mock: {
    adaptive: false,
    citations: [],
    order: null,
    scoring: { description: "", method: "raw" },
    sections: [
      { day: null, kind: "objective", minutes: 12, name: "Prova objetiva", questions: 8 },
      { day: null, kind: "written", minutes: 30, name: "Prova discursiva", questions: null },
    ],
    timeLimitMinutes: 42,
    totalQuestions: 8,
  },
  rules: [{ citation: CITATION, kind: "passMark", text: WRITTEN_PASS_MARK }],
  subjects: [
    { citation: CITATION, name: "Mathematics", questions: 8, topics: [], weight: null },
    { citation: CITATION, name: "Prova discursiva", questions: null, topics: [], weight: null },
  ],
};

/** The exam's own essay question, which its full mock's discursive test asks. */
export const WRITTEN_ESSAY = {
  context: "O controle externo da administração pública cabe ao Congresso Nacional.",
  keyPoints: ["Cites the constitution"],
  question: "Disserte sobre o controle externo da administração pública.",
  rubric: [
    { criterion: "Thesis", description: "A clear thesis" },
    { criterion: "Legal basis", description: "Cites the law" },
  ],
  sampleOutline: "Thesis, two arguments, conclusion.",
};

export function getStructure({ written }: { written: boolean }) {
  return written ? WRITTEN_STRUCTURE : STRUCTURE;
}
