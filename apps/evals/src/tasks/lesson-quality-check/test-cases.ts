import { type TestCase } from "@/lib/types";
import { type WrittenLesson, type WrittenScreen } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import {
  type CheckLessonQualityParams,
  type LessonQualityIssueKind,
} from "@zoonk/ai/tasks/v2/quality/lesson-check";
import { BASE_LESSONS } from "./base-lessons";
import { SOURCED_BASE_LESSONS } from "./sourced-lessons";

type BaseLesson = (typeof BASE_LESSONS)[keyof typeof BASE_LESSONS];

/** A lesson as the reviewer reads it; lessons of goals built from sources add their passages. */
export type LessonQualityCheckInput = Pick<
  CheckLessonQualityParams,
  "chapterLessons" | "chapterTitle" | "courseTitle" | "language" | "level" | "sources" | "spec"
> & { lesson: WrittenLesson };

/**
 * A clean lesson must pass (no blocking issue); a planted one must be blocked
 * on the planted screen (1-based, or null for the summary card), ideally with
 * one of the expected kinds.
 */
export type LessonQualityCheckExpected =
  | { verdict: "pass" }
  | { kinds: LessonQualityIssueKind[]; screen: number | null; verdict: "fail" };

function plant(
  base: LessonQualityCheckInput,
  screen: number,
  replacement: WrittenScreen,
): LessonQualityCheckInput {
  const lesson: WrittenLesson = structuredClone(base.lesson);

  return {
    ...base,
    lesson: {
      ...lesson,
      screens: lesson.screens.map((current, index) =>
        index === screen - 1 ? replacement : current,
      ),
    },
  };
}

function screenOf(base: BaseLesson, screen: number): WrittenScreen {
  const found = base.lesson.screens[screen - 1];

  if (!found) {
    throw new Error(`No screen ${screen}`);
  }

  return found;
}

const { eletron, regra, temperature } = BASE_LESSONS;
const { estabilidade, taxDeadlines } = SOURCED_BASE_LESSONS;

/** The sourced cases come first, so a small `--limit` run checks that sources settle facts. */
export const TEST_CASES: TestCase<LessonQualityCheckExpected, LessonQualityCheckInput>[] = [
  { expected: { verdict: "pass" }, id: "en-tax-deadlines-sourced-clean", userInput: taxDeadlines },
  { expected: { verdict: "pass" }, id: "pt-estabilidade-sourced-clean", userInput: estabilidade },
  {
    // The IRS page says an extension moves filing only; the lesson says it moves paying too.
    expected: { kinds: ["incorrect"], screen: 3, verdict: "fail" },
    id: "en-tax-deadlines-contradicts-source",
    userInput: plant(taxDeadlines, 3, {
      exampleLineIdea: null,
      image: null,
      kind: "explanation",
      text: "If your forms aren't ready, send **Form 4868** by April 15 and both deadlines move 6 months: you can file and pay until October 15, 2026, at no extra cost.",
      title: "Six more months for everything",
    }),
  },
  {
    // Article 41 says three years; many remember the 24 months of the old statute.
    expected: { kinds: ["incorrect"], screen: 2, verdict: "fail" },
    id: "pt-estabilidade-contradicts-source",
    userInput: plant(estabilidade, 2, {
      exampleLineIdea: null,
      image: null,
      kind: "explanation",
      text: "**Estabilidade** é a garantia de não ser mandado embora por decisão de um chefe. Quem entra por concurso ganha essa garantia depois de **dois anos** (24 meses) trabalhando no cargo, e só se for aprovado numa avaliação do seu trabalho feita por uma comissão.",
      title: "Dois anos e uma avaliação",
    }),
  },
  {
    expected: { verdict: "pass" },
    id: "en-temperature-clean",
    userInput: { ...temperature, lesson: temperature.lesson },
  },
  {
    expected: { verdict: "pass" },
    id: "pt-regra-clean",
    userInput: { ...regra, lesson: regra.lesson },
  },
  {
    expected: { kinds: ["incorrect"], screen: 3, verdict: "fail" },
    id: "en-temperature-wrong-math",
    userInput: plant(temperature, 3, {
      image: null,
      kind: "workedExample",
      problem: "It's −3 °C and the temperature rises 5 degrees. What's the new temperature?",
      result: "It's 3 °C: three degrees above zero.",
      steps: [
        { math: null, text: "First climb to zero: that takes 3 degrees." },
        { math: null, text: "The rest of the rise, 3 degrees, takes you above zero." },
      ],
      title: "From −3 °C, up 5 degrees",
    }),
  },
  {
    expected: { kinds: ["filler", "scope"], screen: 5, verdict: "fail" },
    id: "en-temperature-filler",
    userInput: plant(temperature, 5, {
      exampleLineIdea: null,
      image: null,
      kind: "explanation",
      text: "Thermometers have a long history. Galileo built an early one around 1593, and Daniel Fahrenheit made the mercury thermometer popular in 1714. Today they're everywhere, from kitchens to hospitals.",
      title: "A short history of thermometers",
    }),
  },
  {
    expected: { kinds: ["decorativeActivity", "weakCheck", "unclear"], screen: 6, verdict: "fail" },
    id: "en-temperature-decorative-activity",
    userInput: plant(temperature, 6, {
      content: JSON.stringify({
        check: {
          answer: 5,
          explanation: "The dot stopped at 5.",
          kind: "numeric",
          question: "Where did the dot stop?",
          tolerance: { kind: "absolute", value: 0.01 },
        },
        fields: {
          label: "Fun line",
          max: 7,
          min: -5,
          moves: [{ by: 3 }, { by: 5 }],
          start: -3,
          step: 1,
        },
        prompt: "Move the dot for fun and watch it jump.",
      }),
      kind: "activity",
      template: "numberLine",
    }),
  },
  {
    expected: { kinds: ["jargon", "unclear", "level"], screen: 3, verdict: "fail" },
    id: "pt-regra-jargon",
    userInput: plant(regra, 3, {
      exampleLineIdea: null,
      image: null,
      kind: "explanation",
      text: "Grandezas inversamente proporcionais têm produto constante: $x \\cdot y = k$, em que $k$ é a constante de proporcionalidade. Já nas diretamente proporcionais, a razão $y/x$ é invariante. Identifique a relação funcional antes de montar a proporção.",
      title: "Proporcionalidade",
    }),
  },
  {
    expected: { kinds: ["incorrect"], screen: 2, verdict: "fail" },
    id: "pt-regra-wrong-answer-key",
    userInput: plant(regra, 2, {
      ...(screenOf(regra, 2) as Extract<WrittenScreen, { kind: "check" }>),
      options: [
        {
          isCorrect: false,
          reason:
            "É tentador pensar que a equipe maior acelera, mas o prazo depende só do tamanho do pedido.",
          text: "Cai pela metade; depois dobra.",
        },
        {
          isCorrect: true,
          reason: "Qualquer aumento, de equipe ou de pedido, aumenta o prazo na mesma proporção.",
          text: "Dobra nos dois casos.",
        },
        {
          isCorrect: false,
          reason:
            "Uma equipe maior reduz o prazo, mas um pedido maior aumenta o tempo quando você mantém a equipe.",
          text: "Cai pela metade nos dois casos.",
        },
        {
          isCorrect: false,
          reason:
            "Você trocou os efeitos: mais gente acelera o trabalho, enquanto mais trabalho leva mais tempo.",
          text: "Dobra; depois cai pela metade.",
        },
      ],
    }),
  },
  {
    expected: { kinds: ["level", "jargon"], screen: 5, verdict: "fail" },
    id: "pt-eletron-formula-in-overview",
    userInput: plant(eletron, 5, {
      exampleLineIdea: null,
      image: null,
      kind: "explanation",
      text: "O arranjo mais estável minimiza a energia total $E = \\frac{\\hbar^2}{2 m r^2} - \\frac{e^2}{4 \\pi \\varepsilon_0 r}$. Derivando em $r$ e igualando a zero, você obtém o raio de Bohr, $a_0 \\approx 0{,}53$ Å.",
      title: "O arranjo mais estável",
    }),
  },
  {
    expected: { kinds: ["incorrect"], screen: 5, verdict: "fail" },
    id: "pt-regra-worked-example-trap",
    userInput: plant(regra, 5, {
      image: null,
      kind: "workedExample",
      problem:
        "Quatro trabalhadores terminam um muro em 6 dias. No mesmo ritmo, quantos dias 8 trabalhadores levam para terminar o mesmo muro?",
      result: "Oito trabalhadores terminam o muro em 12 dias.",
      steps: [
        { math: null, text: "Mantenha a obra fixa: é o mesmo muro." },
        { math: "\\frac{8}{4}", text: "A equipe dobrou, então use a razão entre as equipes." },
        { math: "6\\times\\frac{8}{4}=12", text: "Multiplique o prazo inicial por essa razão." },
      ],
      title: "Mais gente, menos dias",
    }),
  },
  {
    expected: { kinds: ["incorrect"], screen: 8, verdict: "fail" },
    id: "en-temperature-mismatched-reason",
    userInput: plant(temperature, 8, {
      context:
        "It's −6 °C on a winter morning in Chicago, and the forecast says it will warm up 9 degrees.",
      image: null,
      kind: "check",
      options: [
        {
          isCorrect: true,
          reason: "Six degrees reach zero and three more go above it.",
          text: "3 °C",
        },
        {
          isCorrect: false,
          reason: "That's what you get by moving down 9 degrees instead of up.",
          text: "−3 °C",
        },
        {
          isCorrect: false,
          reason: "You added the numbers without their signs: the start is below zero.",
          text: "15 °C",
        },
      ],
      question: "What will the thermometer show?",
    }),
  },
  {
    expected: { kinds: ["incorrect"], screen: null, verdict: "fail" },
    id: "pt-regra-wrong-summary",
    userInput: {
      ...regra,
      lesson: {
        ...(regra.lesson as WrittenLesson),
        summary: [
          "Com o trabalho fixo, mais trabalhadores ou máquinas reduzem o tempo; com a capacidade fixa, mais trabalho aumenta o tempo.",
          "Na regra de três simples, você ajusta o prazo pela razão da única grandeza que mudou.",
          "Na regra de três composta, todas as razões entram na mesma ordem, sem inverter nenhuma.",
        ],
      },
    },
  },
  {
    expected: { verdict: "pass" },
    id: "en-temperature-chapter-siblings-clean",
    userInput: {
      ...temperature,
      chapterLessons: [
        {
          canDo: "Read a thermometer below zero",
          examples: ["Which is colder: −8 °C in Minneapolis or −3 °C in Chicago?"],
          ideas: ["Below zero, a bigger number means colder."],
          order: "before",
          title: "Negative numbers on a thermometer",
        },
        {
          canDo: "Work out a temperature after it drops",
          order: "after",
          title: "Temperature drops",
        },
      ],
    },
  },
  {
    // An earlier lesson of the chapter already asked this exact Chicago question.
    expected: { kinds: ["scope", "weakCheck"], screen: 8, verdict: "fail" },
    id: "en-temperature-repeats-earlier-lesson",
    userInput: {
      ...temperature,
      chapterLessons: [
        {
          canDo: "Read a thermometer below zero",
          examples: [
            "Which is colder: −8 °C in Minneapolis or −3 °C in Chicago?",
            "It's −6 °C on a winter morning in Chicago, and the forecast says it will warm up 9 degrees. What will the thermometer show?",
          ],
          ideas: ["Below zero, a bigger number means colder.", "Warming up moves the reading up."],
          order: "before",
          title: "Negative numbers on a thermometer",
        },
        {
          canDo: "Work out a temperature after it drops",
          order: "after",
          title: "Temperature drops",
        },
      ],
    },
  },
];
