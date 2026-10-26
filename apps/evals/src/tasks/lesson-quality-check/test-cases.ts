import { type TestCase } from "@/lib/types";
import { type WrittenLesson, type WrittenScreen } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import {
  type CheckLessonQualityParams,
  type LessonQualityIssueKind,
} from "@zoonk/ai/tasks/v2/quality/lesson-check";
import { BASE_LESSONS } from "./base-lessons";
import { EXAM_PREP_BASE_LESSON } from "./exam-prep-lessons";
import { SOURCED_BASE_LESSONS } from "./sourced-lessons";

type BaseLesson = (typeof BASE_LESSONS)[keyof typeof BASE_LESSONS];

/** A lesson as the reviewer reads it; lessons of goals built from sources add their passages. */
export type LessonQualityCheckInput = Pick<
  CheckLessonQualityParams,
  | "chapterLessons"
  | "chapterTitle"
  | "courseTitle"
  | "exams"
  | "language"
  | "level"
  | "sources"
  | "spec"
  | "shortAnswers"
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

const { doorways, eletron, regra, temperature } = BASE_LESSONS;
const { estabilidade, taxDeadlines } = SOURCED_BASE_LESSONS;

/** The sourced cases come first, so a small `--limit` run checks that sources settle facts. */
export const TEST_CASES: TestCase<LessonQualityCheckExpected, LessonQualityCheckInput>[] = [
  { expected: { verdict: "pass" }, id: "en-tax-deadlines-sourced-clean", userInput: taxDeadlines },
  {
    // Written for law candidates: the OAB and the Constitution need no explanation for them.
    expected: { verdict: "pass" },
    id: "pt-finalidades-oab-exam-prep-clean",
    userInput: EXAM_PREP_BASE_LESSON,
  },
  {
    // An option no law candidate would pick, the kind a layperson's lesson had.
    expected: { kinds: ["weakCheck", "level"], screen: 2, verdict: "fail" },
    id: "pt-finalidades-oab-exam-prep-absurd-option",
    userInput: plant(EXAM_PREP_BASE_LESSON, 2, {
      basis: null,
      context:
        "Raimundo vê que um recurso demora a ser julgado. Ele sugere que a OAB passe a decidi-lo no lugar dos juízes.",
      image: null,
      kind: "check",
      options: [
        {
          isCorrect: true,
          picture: null,
          reason:
            "Você distingue cobrar providências de decidir um caso: a demora pode motivar uma cobrança da OAB, não transferir a ela o papel dos juízes.",
          text: "A OAB pode cobrar melhorias na Justiça, mas não assumir o julgamento do recurso.",
        },
        {
          isCorrect: false,
          picture: null,
          reason: "Advogados não são juízes, e Raimundo não é advogado.",
          text: "A OAB pode julgar o recurso, porque toda pessoa que espera um processo é advogada.",
        },
        {
          isCorrect: false,
          picture: null,
          reason: "A OAB não decide recursos: seu papel é outro.",
          text: "A OAB deve fechar o tribunal até o recurso ser julgado.",
        },
      ],
      question: "Como você avalia a proposta de Raimundo?",
      visual: null,
    }),
  },
  { expected: { verdict: "pass" }, id: "pt-estabilidade-sourced-clean", userInput: estabilidade },
  {
    // The IRS page says an extension moves filing only; the lesson says it moves paying too.
    expected: { kinds: ["incorrect"], screen: 3, verdict: "fail" },
    id: "en-tax-deadlines-contradicts-source",
    userInput: plant(taxDeadlines, 3, {
      exampleLineIdea: null,
      explore: null,
      image: null,
      kind: "explanation",
      text: "If your forms aren't ready, send **Form 4868** by April 15 and both deadlines move 6 months: you can file and pay until October 15, 2026, at no extra cost.",
      title: "Six more months for everything",
      visual: null,
    }),
  },
  {
    // Article 41 says three years; many remember the 24 months of the old statute.
    expected: { kinds: ["incorrect"], screen: 2, verdict: "fail" },
    id: "pt-estabilidade-contradicts-source",
    userInput: plant(estabilidade, 2, {
      exampleLineIdea: null,
      explore: null,
      image: null,
      kind: "explanation",
      text: "**Estabilidade** é a garantia de não ser mandado embora por decisão de um chefe. Quem entra por concurso ganha essa garantia depois de **dois anos** (24 meses) trabalhando no cargo, e só se for aprovado numa avaliação do seu trabalho feita por uma comissão.",
      title: "Dois anos e uma avaliação",
      visual: null,
    }),
  },
  {
    expected: { verdict: "pass" },
    id: "en-temperature-clean",
    userInput: { ...temperature, lesson: temperature.lesson },
  },
  {
    // Each doorway is a picture; its name shows only once the learner answers.
    expected: { verdict: "pass" },
    id: "en-doorways-picture-options-clean",
    userInput: doorways,
  },
  {
    // The app draws the numbers on the thermometer in `parts` order, so "3" marks 3 °C.
    expected: { verdict: "pass" },
    id: "en-temperature-numbered-picture-clean",
    userInput: plant(temperature, 8, {
      basis: null,
      context:
        "It's −6 °C on a winter morning in Chicago, and the forecast says it will warm up 9 degrees.",
      image: {
        alt: "A thermometer from −10 °C to 10 °C with three numbered marks.",
        parts: ["−6 °C mark", "zero mark", "3 °C mark"],
        prompt: "A thermometer from −10 °C to 10 °C.",
      },
      kind: "check",
      options: [
        {
          isCorrect: true,
          picture: null,
          reason: "Six degrees reach zero and three more go above it, to 3 °C.",
          text: "3",
        },
        {
          isCorrect: false,
          picture: null,
          reason: "That's where the morning starts, before the 9 degree rise.",
          text: "1",
        },
        {
          isCorrect: false,
          picture: null,
          reason: "Zero is only 6 degrees up: the rise goes 3 more past it.",
          text: "2",
        },
      ],
      question: "Which number on the thermometer marks where it ends up?",
      visual: null,
    }),
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
      visual: null,
    }),
  },
  {
    expected: { kinds: ["filler", "scope"], screen: 5, verdict: "fail" },
    id: "en-temperature-filler",
    userInput: plant(temperature, 5, {
      exampleLineIdea: null,
      explore: null,
      image: null,
      kind: "explanation",
      text: "Thermometers have a long history. Galileo built an early one around 1593, and Daniel Fahrenheit made the mercury thermometer popular in 1714. Today they're everywhere, from kitchens to hospitals.",
      title: "A short history of thermometers",
      visual: null,
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
      explore: null,
      image: null,
      kind: "explanation",
      text: "Grandezas inversamente proporcionais têm produto constante: $x \\cdot y = k$, em que $k$ é a constante de proporcionalidade. Já nas diretamente proporcionais, a razão $y/x$ é invariante. Identifique a relação funcional antes de montar a proporção.",
      title: "Proporcionalidade",
      visual: null,
    }),
  },
  {
    // A shared lesson framed around one exam's notice, which learners of other exams also study.
    expected: { kinds: ["scope"], screen: 2, verdict: "fail" },
    id: "pt-regra-framed-around-one-exam",
    userInput: plant(regra, 2, {
      ...(screenOf(regra, 2) as Extract<WrittenScreen, { kind: "check" }>),
      context:
        "Na prova da Cebraspe para analista da Câmara dos Deputados, conforme o subitem 13.5 do edital, recursos vão para sac@cebraspe.org.br. Um setor da Câmara organiza a triagem desses recursos.",
    }),
  },
  {
    // A check about a case no screen showed yet ("Lorena's order" first appears later, if ever).
    expected: { kinds: ["unclear"], screen: 2, verdict: "fail" },
    id: "pt-regra-case-before-shown",
    userInput: plant(regra, 2, {
      ...(screenOf(regra, 2) as Extract<WrittenScreen, { kind: "check" }>),
      context: "Volte ao pedido da Lorena e compare as duas mudanças que a gráfica conferiu nele.",
    }),
  },
  {
    // A made-up failure pinned on a real company.
    expected: { kinds: ["incorrect", "scope"], screen: 2, verdict: "fail" },
    id: "pt-regra-real-brand-failure",
    userInput: plant(regra, 2, {
      ...(screenOf(regra, 2) as Extract<WrittenScreen, { kind: "check" }>),
      context:
        "A gráfica que imprime as etiquetas do Mercado Livre errou o prazo de um pedido grande porque o sistema do Mercado Livre caiu. Todos trabalham no mesmo ritmo.",
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
          picture: null,
          reason:
            "É tentador pensar que a equipe maior acelera, mas o prazo depende só do tamanho do pedido.",
          text: "Cai pela metade; depois dobra.",
        },
        {
          isCorrect: true,
          picture: null,
          reason: "Qualquer aumento, de equipe ou de pedido, aumenta o prazo na mesma proporção.",
          text: "Dobra nos dois casos.",
        },
        {
          isCorrect: false,
          picture: null,
          reason:
            "Uma equipe maior reduz o prazo, mas um pedido maior aumenta o tempo quando você mantém a equipe.",
          text: "Cai pela metade nos dois casos.",
        },
        {
          isCorrect: false,
          picture: null,
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
      explore: null,
      image: null,
      kind: "explanation",
      text: "O arranjo mais estável minimiza a energia total $E = \\frac{\\hbar^2}{2 m r^2} - \\frac{e^2}{4 \\pi \\varepsilon_0 r}$. Derivando em $r$ e igualando a zero, você obtém o raio de Bohr, $a_0 \\approx 0{,}53$ Å.",
      title: "O arranjo mais estável",
      visual: null,
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
      visual: null,
    }),
  },
  {
    expected: { kinds: ["incorrect"], screen: 8, verdict: "fail" },
    id: "en-temperature-mismatched-reason",
    userInput: plant(temperature, 8, {
      basis: null,
      context:
        "It's −6 °C on a winter morning in Chicago, and the forecast says it will warm up 9 degrees.",
      image: null,
      kind: "check",
      options: [
        {
          isCorrect: true,
          picture: null,
          reason: "Six degrees reach zero and three more go above it.",
          text: "3 °C",
        },
        {
          isCorrect: false,
          picture: null,
          reason: "That's what you get by moving down 9 degrees instead of up.",
          text: "−3 °C",
        },
        {
          isCorrect: false,
          picture: null,
          reason: "You added the numbers without their signs: the start is below zero.",
          text: "15 °C",
        },
      ],
      question: "What will the thermometer show?",
      visual: null,
    }),
  },
  {
    // The table lists five stations and the options offer four, as a lesson on sensors did (Oct 2026).
    expected: { kinds: ["unclear", "incorrect"], screen: 8, verdict: "fail" },
    id: "en-temperature-data-disagrees-with-options",
    userInput: plant(temperature, 8, {
      basis: null,
      context:
        "Five weather stations logged the dawn temperature and the rise forecast for the day:\n\n| Station | Dawn | Rise |\n|---|---:|---:|\n| A | −6 °C | 9 degrees |\n| B | −4 °C | 3 degrees |\n| C | −2 °C | 1 degree |\n| D | −5 °C | 3 degrees |\n| E | −8 °C | 2 degrees |",
      image: null,
      kind: "check",
      options: [
        {
          isCorrect: true,
          picture: null,
          reason: "Six degrees take A to zero and three more go above it: 3 °C.",
          text: "Station A",
        },
        {
          isCorrect: false,
          picture: null,
          reason: "Three degrees take B from −4 °C to −1 °C, still below zero.",
          text: "Station B",
        },
        {
          isCorrect: false,
          picture: null,
          reason: "One degree takes C from −2 °C to −1 °C, still below zero.",
          text: "Station C",
        },
        {
          isCorrect: false,
          picture: null,
          reason: "Three degrees take D from −5 °C to −2 °C, still below zero.",
          text: "Station D",
        },
      ],
      question: "Which station ends the day above zero?",
      visual: null,
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
    // A summary that turns "they change together" into a definition of proportion, as a cheaper
    // writer's did (Oct 2026): ages and heights grow together without being proportional.
    expected: { kinds: ["incorrect"], screen: null, verdict: "fail" },
    id: "pt-regra-over-broad-summary",
    userInput: {
      ...regra,
      lesson: {
        ...(regra.lesson as WrittenLesson),
        summary: [
          "Duas grandezas são diretamente proporcionais sempre que aumentam ou diminuem juntas, e inversamente proporcionais sempre que uma aumenta enquanto a outra diminui.",
          "Na regra de três simples, você ajusta o prazo pela razão da única grandeza que mudou.",
          "Na regra de três composta, você ajusta o prazo por cada mudança: razão direta para a quantidade de trabalho e razão inversa para a capacidade de produção.",
        ],
      },
    },
  },
  {
    // Two options name the same mistake, so the one marked wrong is right too (Oct 2026).
    expected: { kinds: ["incorrect"], screen: 8, verdict: "fail" },
    id: "en-temperature-two-right-options",
    userInput: plant(temperature, 8, {
      basis: null,
      context:
        "It's −3 °C in Denver, and the forecast says it will warm up 5 degrees. Maya says the thermometer will read 8 °C.",
      image: null,
      kind: "check",
      options: [
        {
          isCorrect: true,
          picture: null,
          reason:
            "From −3 °C, three degrees reach zero and two more reach 2 °C; 8 °C comes from starting at 3 instead.",
          text: "She added 5 to 3 instead of to −3.",
        },
        {
          isCorrect: false,
          picture: null,
          reason:
            "The minus sign isn't what went wrong: Maya counted the rise in the wrong direction.",
          text: "She left out the minus sign on −3 °C.",
        },
        {
          isCorrect: false,
          picture: null,
          reason: "Counting 5 degrees down from −3 °C gives −8 °C, not 8 °C.",
          text: "She counted the 5 degrees down instead of up.",
        },
      ],
      question: "What did Maya do wrong?",
      visual: null,
    }),
  },
  {
    // The right option with a reason that teaches something false, as a cheaper writer's did (Oct 2026).
    expected: { kinds: ["incorrect"], screen: 4, verdict: "fail" },
    id: "pt-eletron-wrong-reason-on-right-option",
    userInput: plant(eletron, 4, {
      ...(screenOf(eletron, 4) as Extract<WrittenScreen, { kind: "check" }>),
      options: (screenOf(eletron, 4) as Extract<WrittenScreen, { kind: "check" }>).options.map(
        (option) =>
          option.isCorrect
            ? {
                ...option,
                reason:
                  "Isso mesmo: bem perto do núcleo a atração fica mais fraca, então nada puxa o elétron para mais perto.",
              }
            : option,
      ),
    }),
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
