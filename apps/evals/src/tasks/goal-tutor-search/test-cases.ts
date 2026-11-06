import { type TestCase } from "@/lib/types";
import { type LessonScopeContext } from "@zoonk/ai/tasks/lessons/question-context";
import { type goalTutorSearchClassifier } from "@zoonk/ai/tasks/tutor/goal-tutor-search";

export type GoalTutorSearchInput = Parameters<typeof goalTutorSearchClassifier.toInput>[0];
export type GoalTutorSearchExpected = { needsCurrentSource: boolean };

const CAMARA_GOAL = "Concurso da Câmara dos Deputados: Analista Legislativo, Registro e Redação";
const OAB_GOAL = "Passar na 1ª fase da OAB";
const BAR_GOAL = "Pass the California bar exam in July";
const SAT_GOAL = "SAT in March";

function stepScreen({
  chapter,
  course,
  language = "pt",
  lesson,
  text,
}: {
  chapter: string;
  course: string;
  language?: string;
  lesson: string;
  text: string;
}): LessonScopeContext {
  const step = { content: { text }, kind: "static", sentence: null, stepNumber: 2, word: null };

  return {
    answer: null,
    chapter: { description: null, title: chapter },
    course: { description: null, language, targetLanguage: null, title: course },
    lesson: { description: null, kind: "explanation", language, title: lesson },
    lessonSteps: [step],
    scope: { kind: "step" },
    step,
    version: 1,
  };
}

const SUJEITO_SCREEN = stepScreen({
  chapter: "Sintaxe do período simples",
  course: "Língua Portuguesa",
  lesson: "Sujeito e predicado",
  text: "Em “O envio dos relatórios atrasou”, o que atrasou foi o envio. “Dos relatórios” só diz qual envio. Por isso o verbo fica no singular. Essa palavra central, que guia a concordância, é o núcleo do sujeito.",
});

const SUCUMBENCIA_SCREEN = stepScreen({
  chapter: "Honorários advocatícios",
  course: "Estatuto da Advocacia",
  lesson: "Honorários de sucumbência do advogado empregado",
  text: "Na relação de emprego, os honorários de sucumbência são devidos aos advogados empregados (art. 21 da Lei 8.906/94).",
});

const DISCRIMINANT_SCREEN = stepScreen({
  chapter: "Quadratics",
  course: "SAT Math",
  language: "en",
  lesson: "The discriminant",
  text: "For x² + 2x + 5 = 0, b² − 4ac = 4 − 20 = −16. A negative discriminant means the equation has no real solutions.",
});

const COMMUNITY_PROPERTY_SCREEN = stepScreen({
  chapter: "Community property",
  course: "California Bar: Essay Subjects",
  language: "en",
  lesson: "What counts as community property",
  text: "Property either spouse acquires during the marriage while domiciled in California is community property (Family Code § 760).",
});

function searchCase({
  earlierQuestion,
  goal,
  id,
  needsCurrentSource,
  question,
  screen,
}: Omit<GoalTutorSearchInput, "earlierQuestion" | "screen"> & {
  earlierQuestion?: string;
  id: string;
  needsCurrentSource: boolean;
  screen?: LessonScopeContext;
}): TestCase<GoalTutorSearchExpected, GoalTutorSearchInput> {
  return {
    expected: { needsCurrentSource },
    id,
    userInput: { earlierQuestion: earlierQuestion ?? null, goal, question, screen },
  };
}

export const TEST_CASES: TestCase<GoalTutorSearchExpected, GoalTutorSearchInput>[] = [
  // Searched about 4 in 10 times without the screen, sometimes for just "do" (issue #2236).
  searchCase({
    goal: CAMARA_GOAL,
    id: "pt-screen-grammar-points-at-step",
    needsCurrentSource: false,
    question: "o núcleo aqui é o envio, correto?",
    screen: SUJEITO_SCREEN,
  }),
  searchCase({
    goal: CAMARA_GOAL,
    id: "pt-screen-exam-rule-off-screen",
    needsCurrentSource: true,
    question: "o edital deste ano ainda cobra redação oficial na discursiva?",
    screen: SUJEITO_SCREEN,
  }),
  searchCase({
    goal: OAB_GOAL,
    id: "pt-screen-law-points-at-step",
    needsCurrentSource: true,
    question: "isso ainda vale?",
    screen: SUCUMBENCIA_SCREEN,
  }),
  searchCase({
    goal: OAB_GOAL,
    id: "pt-law-no-screen",
    needsCurrentSource: true,
    question: "o contrato pode dizer que a sucumbência vai pra empresa?",
  }),
  searchCase({
    goal: OAB_GOAL,
    id: "pt-plan-no-screen",
    needsCurrentSource: false,
    question: "dá pra passar a aula de amanhã pra sexta?",
  }),
  searchCase({
    goal: SAT_GOAL,
    id: "en-screen-math-points-at-step",
    needsCurrentSource: false,
    question: "so there's no answer here because it's negative?",
    screen: DISCRIMINANT_SCREEN,
  }),
  searchCase({
    goal: BAR_GOAL,
    id: "en-screen-law-points-at-step",
    needsCurrentSource: true,
    question: "does this apply to registered domestic partners too?",
    screen: COMMUNITY_PROPERTY_SCREEN,
  }),
  searchCase({
    earlierQuestion: "what's the difference between community and separate property?",
    goal: BAR_GOAL,
    id: "en-follow-up-concept",
    needsCurrentSource: false,
    question: "and can you give me an easy way to remember it?",
  }),
];
