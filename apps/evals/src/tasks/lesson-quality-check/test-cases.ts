import { type TestCase } from "@/lib/types";
import { type WrittenLesson, type WrittenScreen } from "@zoonk/ai/tasks/lesson-writer/schema";
import { type CheckLessonQualityParams } from "@zoonk/ai/tasks/quality/lesson-check";
import { ALPHABET_LESSONS, ALPHABET_SLIPS, type AlphabetCheckInput } from "./alphabet-lessons";
import { BASE_LESSONS } from "./base-lessons";
import { EXAM_PREP_BASE_LESSON } from "./exam-prep-lessons";
import { MOBILITY_BASE_LESSON } from "./mobility-lesson";
import { SOURCED_BASE_LESSONS } from "./sourced-lessons";

type BaseLesson = (typeof BASE_LESSONS)[keyof typeof BASE_LESSONS];

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

export type LessonQualityCheckExpected =
  | { verdict: "pass" }
  | { screen: number | null; verdict: "fail" };

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

const MOBILITY_EXAMPLE_RULE =
  "Aqui, abrir mais vagas no topo aumentou as subidas sem tirar o peso da origem.";

function mobilityExampleScreen(opening: string): WrittenScreen {
  return {
    exampleLineIdea:
      "uma notícia sobre mais jovens de famílias pobres entrando na universidade ou no serviço público",
    explore: null,
    image: null,
    kind: "explanation",
    text: `${opening} Dividir as fatias que chegam ao topo daria 5 e depois 3, mas aqui essa queda vem só das vagas a mais no topo. Nas odds, a vantagem seguiu em nove vezes. ${MOBILITY_EXAMPLE_RULE}`,
    title: "Mais subidas, mesma vantagem",
    visual: null,
  };
}

const mobilityRuleCheck = MOBILITY_BASE_LESSON.lesson.screens[8] as Extract<
  WrittenScreen,
  { kind: "check" }
>;

const mobilityResolvedScreens = plant(
  plant(
    plant(MOBILITY_BASE_LESSON, 3, {
      image: null,
      kind: "hookGuess",
      options: [
        { isCorrect: false, text: "Diminui" },
        { isCorrect: true, text: "Permanece igual" },
      ],
      question:
        "No estudo fictício, no período A, 10 de 100 filhos de origem baixa e 50 de 100 de origem alta chegaram ao topo. No B, foram 25 e 75. Como mudou a vantagem da origem alta?",
      reveal:
        "Pela medida que as próximas telas usam, a vantagem da origem alta permanece igual nos dois períodos.",
      visual: null,
    }),
    8,
    mobilityExampleScreen(
      "De A para B, os filhos de origem baixa que chegaram ao topo passaram de 10 para 25.",
    ),
  ),
  9,
  { ...mobilityRuleCheck, basis: { quote: MOBILITY_EXAMPLE_RULE, screen: 8 } },
);

/** The real guess with its reading resolved, and the example's rule kept to the example, so nothing in it is wrong. */
const mobilityGuessResolved: LessonQualityCheckInput = {
  ...mobilityResolvedScreens,
  lesson: {
    ...mobilityResolvedScreens.lesson,
    summary: {
      ...mobilityResolvedScreens.lesson.summary,
      ideas: mobilityResolvedScreens.lesson.summary.ideas.map((idea) =>
        idea.label === "Mais subidas, mesma vantagem"
          ? {
              ...idea,
              text: "Abrir mais vagas no topo pode aumentar as subidas sem tirar o peso da origem, como de A para B, quando a vantagem da origem alta seguiu em nove vezes.",
            }
          : idea,
      ),
    },
  },
};

export const TEST_CASES: TestCase<
  LessonQualityCheckExpected,
  AlphabetCheckInput | LessonQualityCheckInput
>[] = [
  {
    expected: { verdict: "pass" },
    id: "pt-ru-alphabet-clean",
    userInput: ALPHABET_LESSONS.cyrillic,
  },
  {
    expected: { screen: 8, verdict: "fail" },
    id: "pt-ru-alphabet-silent-h",
    userInput: ALPHABET_SLIPS.silentH,
  },
  {
    expected: { screen: 7, verdict: "fail" },
    id: "en-ko-alphabet-book-vowel",
    userInput: ALPHABET_SLIPS.bookVowel,
  },
  { expected: { verdict: "pass" }, id: "en-tax-deadlines-sourced-clean", userInput: taxDeadlines },
  {
    expected: { verdict: "pass" },
    id: "pt-finalidades-oab-exam-prep-clean",
    userInput: EXAM_PREP_BASE_LESSON,
  },
  {
    expected: { verdict: "pass" },
    id: "pt-finalidades-oab-exam-prep-absurd-option",
    userInput: plant(EXAM_PREP_BASE_LESSON, 5, {
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
  {
    expected: { screen: 3, verdict: "fail" },
    id: "pt-mobilidade-guess-unresolved",
    userInput: MOBILITY_BASE_LESSON,
  },
  {
    expected: { verdict: "pass" },
    id: "pt-mobilidade-guess-resolved",
    userInput: mobilityGuessResolved,
  },
  {
    expected: { screen: 8, verdict: "fail" },
    id: "pt-mobilidade-absolute-claim-contradicts-figures",
    userInput: plant(
      mobilityGuessResolved,
      8,
      mobilityExampleScreen(
        "De A para B, a mobilidade absoluta cresceu: os filhos de origem baixa que chegaram ao topo passaram de 10 para 25.",
      ),
    ),
  },
  { expected: { verdict: "pass" }, id: "pt-estabilidade-sourced-clean", userInput: estabilidade },
  {
    expected: { screen: 4, verdict: "fail" },
    id: "en-tax-deadlines-contradicts-source",
    userInput: plant(taxDeadlines, 4, {
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
    expected: { screen: 2, verdict: "fail" },
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
  { expected: { verdict: "pass" }, id: "en-doorways-picture-options-clean", userInput: doorways },
  {
    expected: { verdict: "pass" },
    id: "en-temperature-numbered-picture-clean",
    userInput: plant(temperature, 9, {
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
    expected: { screen: 4, verdict: "fail" },
    id: "en-temperature-wrong-math",
    userInput: plant(temperature, 4, {
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
    expected: { verdict: "pass" },
    id: "en-temperature-filler",
    userInput: plant(temperature, 6, {
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
    expected: { verdict: "pass" },
    id: "en-temperature-decorative-activity",
    userInput: plant(temperature, 7, {
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
    expected: { verdict: "pass" },
    id: "pt-regra-jargon",
    userInput: plant(regra, 2, {
      exampleLineIdea: null,
      explore: null,
      image: null,
      kind: "explanation",
      text: String.raw`Grandezas inversamente proporcionais têm produto constante: $x \cdot y = k$, em que $k$ é a constante de proporcionalidade. Já nas diretamente proporcionais, a razão $y/x$ é invariante. Identifique a relação funcional antes de montar a proporção.`,
      title: "Proporcionalidade",
      visual: null,
    }),
  },
  {
    expected: { verdict: "pass" },
    id: "pt-regra-framed-around-one-exam",
    userInput: plant(regra, 5, {
      ...(screenOf(regra, 5) as Extract<WrittenScreen, { kind: "check" }>),
      context:
        "Neste simulado para a prova da Câmara dos Deputados, uma equipe organiza a triagem de pedidos. Todos trabalham no mesmo ritmo. Compare cada mudança separadamente.",
    }),
  },
  {
    expected: { screen: 7, verdict: "fail" },
    id: "pt-regra-minutes-per-hour-varies",
    userInput: plant(regra, 7, {
      ...(screenOf(regra, 7) as Extract<WrittenScreen, { kind: "mathCheck" }>),
      context:
        "{impressoras} impressoras fazem {etiquetas} etiquetas em {horas} horas, no mesmo ritmo. Uma hora tem {minutos} minutos.",
      correctReason:
        "Com {impressoras} impressoras fixas, o tempo cresce na mesma razão que a produção, e cada hora vale {minutos} minutos.",
      math: {
        answer: 300,
        commonMistakes: [
          {
            expression: "horas*meta/etiquetas",
            misconception: "Esqueceu de converter",
            reason: "Você achou o prazo em horas, mas a pergunta pede minutos.",
          },
          {
            expression: "horas*etiquetas/meta*minutos",
            misconception: "Razão invertida",
            reason: "Com as impressoras fixas, produzir mais etiquetas leva mais tempo, não menos.",
          },
        ],
        solution: "horas*meta/etiquetas*minutos",
        steps: [
          {
            expression: "horas*meta/etiquetas",
            text: "Multiplique {horas} pela razão entre {meta} e {etiquetas}: {result} horas.",
          },
          { expression: "horas*meta/etiquetas*minutos", text: "Em minutos, são {result}." },
        ],
        tolerance: { kind: "absolute", value: 0 },
        unit: "minutos",
        variables: [
          { max: 5, min: 2, name: "impressoras", step: 1, unit: null, value: 2 },
          { max: 160, min: 40, name: "etiquetas", step: 40, unit: "etiquetas", value: 80 },
          { max: 5, min: 1, name: "horas", step: 1, unit: "horas", value: 2 },
          { max: 400, min: 200, name: "meta", step: 40, unit: "etiquetas", value: 200 },
          { max: 90, min: 30, name: "minutos", step: 15, unit: "minutos", value: 60 },
        ],
      },
      question:
        "Mantendo as mesmas impressoras, quantos minutos elas levam para fazer {meta} etiquetas?",
    }),
  },
  {
    expected: { screen: 5, verdict: "fail" },
    id: "pt-regra-case-before-shown",
    userInput: plant(regra, 5, {
      ...(screenOf(regra, 5) as Extract<WrittenScreen, { kind: "check" }>),
      context: "Volte ao pedido da Lorena e compare as duas mudanças que a gráfica conferiu nele.",
    }),
  },
  {
    expected: { screen: 5, verdict: "fail" },
    id: "pt-regra-real-brand-failure",
    userInput: plant(regra, 5, {
      ...(screenOf(regra, 5) as Extract<WrittenScreen, { kind: "check" }>),
      context:
        "A gráfica que imprime as etiquetas do Mercado Livre errou o prazo de um pedido grande porque o sistema do Mercado Livre caiu. Todos trabalham no mesmo ritmo.",
    }),
  },
  {
    expected: { screen: 5, verdict: "fail" },
    id: "pt-regra-wrong-answer-key",
    userInput: plant(regra, 5, {
      ...(screenOf(regra, 5) as Extract<WrittenScreen, { kind: "check" }>),
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
    expected: { verdict: "pass" },
    id: "pt-eletron-formula-in-overview",
    userInput: plant(eletron, 6, {
      exampleLineIdea: null,
      explore: null,
      image: null,
      kind: "explanation",
      text: String.raw`Num modelo simplificado do átomo de hidrogênio, o estado de menor energia minimiza $E = \frac{\hbar^2}{2 m r^2} - \frac{e^2}{4 \pi \varepsilon_0 r}$. Derivando em $r$ e igualando a zero, você obtém o raio de Bohr, $a_0 \approx 0{,}53$ Å.`,
      title: "O arranjo mais estável",
      visual: null,
    }),
  },
  {
    expected: { screen: 6, verdict: "fail" },
    id: "pt-regra-worked-example-trap",
    userInput: plant(regra, 6, {
      image: null,
      kind: "workedExample",
      problem:
        "Quatro trabalhadores terminam um muro em 6 dias. No mesmo ritmo, quantos dias 8 trabalhadores levam para terminar o mesmo muro?",
      result: "Oito trabalhadores terminam o muro em 12 dias.",
      steps: [
        { math: null, text: "Mantenha a obra fixa: é o mesmo muro." },
        {
          math: String.raw`\frac{8}{4}`,
          text: "A equipe dobrou, então use a razão entre as equipes.",
        },
        {
          math: String.raw`6\times\frac{8}{4}=12`,
          text: "Multiplique o prazo inicial por essa razão.",
        },
      ],
      title: "Mais gente, menos dias",
      visual: null,
    }),
  },
  {
    expected: { screen: 9, verdict: "fail" },
    id: "en-temperature-mismatched-reason",
    userInput: plant(temperature, 9, {
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
    expected: { verdict: "pass" },
    id: "en-temperature-data-disagrees-with-options",
    userInput: plant(temperature, 9, {
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
    expected: { screen: null, verdict: "fail" },
    id: "pt-regra-wrong-summary",
    userInput: {
      ...regra,
      lesson: {
        ...(regra.lesson as WrittenLesson),
        summary: {
          ideas: [
            {
              label: "Trabalho ou capacidade fixa",
              text: "Com o trabalho fixo, mais trabalhadores ou máquinas reduzem o tempo; com a capacidade fixa, mais trabalho aumenta o tempo.",
            },
            {
              label: "Regra de três simples",
              text: "Na regra de três simples, você ajusta o prazo pela razão da única grandeza que mudou.",
            },
            {
              label: "Regra de três composta",
              text: "Na regra de três composta, todas as razões entram na mesma ordem, sem inverter nenhuma.",
            },
          ],
          shape: "hub",
        },
      },
    },
  },
  {
    expected: { screen: null, verdict: "fail" },
    id: "pt-regra-over-broad-summary",
    userInput: {
      ...regra,
      lesson: {
        ...(regra.lesson as WrittenLesson),
        summary: {
          ideas: [
            {
              label: "Grandezas proporcionais",
              text: "Duas grandezas são diretamente proporcionais sempre que aumentam ou diminuem juntas, e inversamente proporcionais sempre que uma aumenta enquanto a outra diminui.",
            },
            {
              label: "Regra de três simples",
              text: "Na regra de três simples, você ajusta o prazo pela razão da única grandeza que mudou.",
            },
            {
              label: "Regra de três composta",
              text: "Na regra de três composta, você ajusta o prazo por cada mudança: razão direta para a quantidade de trabalho e razão inversa para a capacidade de produção.",
            },
          ],
          shape: "hub",
        },
      },
    },
  },
  {
    expected: { screen: 9, verdict: "fail" },
    id: "en-temperature-two-right-options",
    userInput: plant(temperature, 9, {
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
    expected: { screen: 5, verdict: "fail" },
    id: "pt-eletron-wrong-reason-on-right-option",
    userInput: plant(eletron, 5, {
      ...(screenOf(eletron, 5) as Extract<WrittenScreen, { kind: "check" }>),
      options: (screenOf(eletron, 5) as Extract<WrittenScreen, { kind: "check" }>).options.map(
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
    expected: { verdict: "pass" },
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
