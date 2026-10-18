/**
 * The exams the anytime mock tests copy: one day of two subjects, and the same day with a break,
 * with sections that set how candidates move, scored on its own scale, in other answer formats,
 * or with a written part.
 */
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

/** What the notice lets candidates use in each section, in its own words. */
export const SECTION_TOOLS = { Languages: "No calculator.", Mathematics: "Calculator allowed." };

/**
 * An exam day like a computer-based one with a break: Mathematics, ten minutes off, then
 * Languages, each with what may be used in it; a lab practical a mock can't run; and a quarter of
 * a point lost per wrong answer, as JEE's +4 and -1 do.
 */
const BREAK_STRUCTURE = {
  ...STRUCTURE,
  mock: {
    ...STRUCTURE.mock,
    scoring: {
      description: "+4 for a right answer, -1 for a wrong one",
      method: "wrongCancelsRight",
      wrongPenalty: 0.25,
    },
    sections: [
      ...AREAS.map((name, index) => ({
        breakAfterMinutes: index === 0 ? 10 : null,
        day: null,
        minutes: 12,
        name,
        questions: 8,
        tools: SECTION_TOOLS[name],
      })),
      { day: null, kind: "practical", minutes: 30, name: "Lab practical", questions: null },
    ],
  },
};

/**
 * An exam day like a computer-based one that sets how candidates move: Mathematics one question
 * after another, each answered before the next, with a review at its end that may change one
 * answer (like the GMAT's), then Languages with a clock of three seconds per question.
 */
const NAVIGATION_STRUCTURE = {
  ...STRUCTURE,
  mock: {
    ...STRUCTURE.mock,
    sections: [
      {
        day: null,
        minutes: 12,
        name: "Mathematics",
        navigation: { answerChanges: 1, forwardOnly: true, itemSeconds: null, mustAnswer: true },
        questions: 8,
      },
      {
        day: null,
        minutes: 12,
        name: "Languages",
        navigation: { answerChanges: null, forwardOnly: false, itemSeconds: 3, mustAnswer: false },
        questions: 8,
      },
    ],
  },
};

/**
 * An exam scored on its own scale, like EXANI-II's Ceneval index: from 700 to 1300, 700 plus 6 per
 * percent of right answers, and 1000 to pass.
 */
const SCALE_STRUCTURE = {
  ...STRUCTURE,
  mock: {
    ...STRUCTURE.mock,
    scoring: {
      description: "Índice Ceneval de 700 a 1300",
      method: "scaled",
      scale: {
        fromPercent: { base: 700, perPercent: 6 },
        max: 1300,
        min: 700,
        name: "Ceneval index",
        passScore: 1000,
        step: 1,
      },
    },
  },
};

/** Mathematics' quick questions, one right option each. */
const FORMATS_QUICK_QUESTIONS = 8;

/** Mathematics' quick questions and the three in the exam's other answer formats. */
export const FORMATS_QUESTIONS = FORMATS_QUICK_QUESTIONS + 3;

/**
 * An exam like JEE Advanced: one Mathematics paper whose questions may have one right option or
 * several (+1 per right option picked, all of them the full mark), take a fraction typed into a
 * box, or a word typed in, in the mix the notice counts (eight, one, one and one), which the bank
 * holds, so the mock starts without writing any.
 */
const FORMATS_STRUCTURE = {
  ...STRUCTURE,
  formats: [
    {
      citation: CITATION,
      description: "One option correct",
      kind: "multipleChoice",
      options: null,
      share: FORMATS_QUICK_QUESTIONS / FORMATS_QUESTIONS,
    },
    {
      citation: CITATION,
      description: "One or more options correct",
      kind: "multipleChoice",
      options: null,
      partialCredit: "perOption",
      select: "all",
      share: 1 / FORMATS_QUESTIONS,
    },
    {
      citation: CITATION,
      description: "A fraction or a decimal",
      entry: { kind: "fraction", places: null },
      kind: "numeric",
      options: null,
      share: 1 / FORMATS_QUESTIONS,
    },
    {
      citation: CITATION,
      description: "A word",
      kind: "shortAnswer",
      options: null,
      share: 1 / FORMATS_QUESTIONS,
    },
  ],
  mock: {
    ...STRUCTURE.mock,
    sections: [
      {
        day: null,
        kind: "objective",
        minutes: 22,
        name: "Mathematics",
        questions: FORMATS_QUESTIONS,
      },
    ],
    timeLimitMinutes: 22,
    totalQuestions: FORMATS_QUESTIONS,
  },
  subjects: [
    {
      citation: CITATION,
      name: "Mathematics",
      questions: FORMATS_QUESTIONS,
      topics: [],
      weight: null,
    },
  ],
};

/** The exam's questions in its other answer formats: several picks, a fraction, a word. */
export const FORMAT_ITEMS = {
  number: {
    content: {
      context: null,
      entry: { kind: "fraction", places: null },
      // Fixed numbers, so two thirds is always the answer.
      math: {
        answer: 2 / 3,
        commonMistakes: [
          { expression: "eaten / slices", misconception: "Eaten share", reason: "That's eaten." },
        ],
        solution: "(slices - eaten) / slices",
        steps: [],
        tolerance: { kind: "absolute", value: 0.005 },
        unit: null,
        variables: [
          { max: 3, min: 3, name: "slices", step: 1, unit: null, value: 3 },
          { max: 1, min: 1, name: "eaten", step: 1, unit: null, value: 1 },
        ],
      },
      otherSolutions: [],
      question: "A pizza has {slices} slices and you eat {eaten}. What share is left?",
    },
    format: "numeric",
  },
  picks: {
    content: {
      context: null,
      fixedOrder: true,
      options: [
        { isCorrect: true, misconception: null, reason: "2 + 2 is 4.", text: "2 + 2 = 4" },
        { isCorrect: true, misconception: null, reason: "3 × 3 is 9.", text: "3 × 3 = 9" },
        { isCorrect: false, misconception: "Adds one", reason: "5 − 1 is 4.", text: "5 − 1 = 5" },
        { isCorrect: false, misconception: "Halves", reason: "8 ÷ 2 is 4.", text: "8 ÷ 2 = 3" },
      ],
      question: "Which of these are true?",
      select: "all",
    },
    format: "multipleChoice",
  },
  word: {
    content: {
      acceptedAnswers: ["prime"],
      context: null,
      keyPoints: ["Names a prime number"],
      question: "A number whose only divisors are 1 and itself is called ____.",
      sampleAnswer: "prime",
    },
    format: "typed",
  },
} as const;

/** What the notice says it takes to pass, in its own words. */
export const WRITTEN_PASS_MARK = "Aprovado quem obtiver no mínimo 4 dos 8 pontos (50%).";

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

type StructurePick = {
  breaks: boolean;
  formats: boolean;
  navigation: boolean;
  scale: boolean;
  written: boolean;
};

export function getStructure({ breaks, formats, navigation, scale, written }: StructurePick) {
  if (formats) {
    return FORMATS_STRUCTURE;
  }

  if (written) {
    return WRITTEN_STRUCTURE;
  }

  if (navigation) {
    return NAVIGATION_STRUCTURE;
  }

  if (scale) {
    return SCALE_STRUCTURE;
  }

  return breaks ? BREAK_STRUCTURE : STRUCTURE;
}

/** A text three of the exam's Mathematics questions read, as one set. */
export const TEXT_SET = {
  source: "Adapted from a town report.",
  text: "A town's library opened on Sundays last year. Visits rose by a third, mostly families.",
  title: "Sunday openings",
};
