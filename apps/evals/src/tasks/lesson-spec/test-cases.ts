import { type TestCase } from "@/lib/types";
import { type LessonSpecParams } from "@zoonk/ai/tasks/v2/lesson-spec";
import { activityTemplates } from "@zoonk/core/library/activities/templates";
import { SOURCED_LESSONS } from "../lesson-writer/sourced-lesson-specs";
import { type LessonSpecExpected, VISUAL_TEST_CASES } from "./visual-test-cases";

/** What workflows pass: every template in the catalog. */
const ACTIVITY_TEMPLATES: LessonSpecParams["activityTemplates"] = activityTemplates.map(
  (template) => ({ description: template.description, id: template.id }),
);

const SHARED_EXPECTATIONS = `
  - The output is a list of lesson specs (usually one; several only when the lesson had to be split): title, description, can-do line, support mode, 1 to 3 skills and a screen plan whose screens have a kind, skill indexes (0-based into the lesson's skills), a brief for the writer, an optional visual and an activity template id on activity screens
  - Estimated minutes are computed by code from the screen kinds; don't grade the number itself
  - Don't evaluate JSON formatting
`;

const { "en-tax-deadlines": taxDeadlines, "pt-estabilidade": estabilidade } = SOURCED_LESSONS;

type ChapterLessons = NonNullable<LessonSpecParams["chapterLessons"]>;

/** The chapter's other lessons known only by their outline titles, before and after this one. */
function outlined({ after = [], before = [] }: { after?: string[]; before?: string[] }) {
  return [
    ...before.map((title) => ({ order: "before" as const, title })),
    ...after.map((title) => ({ order: "after" as const, title })),
  ] satisfies ChapterLessons;
}

/** Lessons of goals built from official sources come first, so a small run checks them. */
export const TEST_CASES: TestCase<LessonSpecExpected, LessonSpecParams>[] = [
  {
    expectations: `
      - MUST be in US English, with US examples (dollars, US names and cities)
      - Every date in the plan matches SOURCES: the 2025 federal return is due April 15, 2026; Form 4868 extends filing to October 15, 2026; paying is still due April 15, 2026
      - A check plans the trap of believing the extension also delays payment
      - The plan stays on deadlines and extensions; it doesn't turn into a lesson on penalties or deductions beyond a sentence

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-tax-deadlines-sourced",
    userInput: {
      activityTemplates: ACTIVITY_TEMPLATES,
      chapterLessons: outlined({ before: ["Tax brackets", "Deductions and credits"] }),
      chapterTitle: taxDeadlines.chapterTitle,
      courseTitle: taxDeadlines.courseTitle,
      language: "en",
      lessonCanDo: taxDeadlines.spec.canDo,
      lessonDescription: taxDeadlines.spec.description,
      lessonTitle: taxDeadlines.spec.title,
      level: "beginner",
      skills: taxDeadlines.spec.skills.map((skill) => skill.name),
      sources: taxDeadlines.sources,
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese, with Brazilian examples (names, cities, a prefeitura or órgão federal)
      - The stability rule matches SOURCES (Constituição, art. 41): three years of effective service plus approval in the special performance evaluation by a commission; never 24 months or 2 years
      - For misconduct or poor performance, the ways a stable servant loses the post are the three in the article (final court decision, administrative process with a defense, periodic evaluation); the plan never claims they are the only ways in every case
      - A check plans the trap of thinking time alone gives stability

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-estabilidade-sourced",
    userInput: {
      activityTemplates: ACTIVITY_TEMPLATES,
      chapterLessons: outlined({
        after: ["Regime disciplinar"],
        before: ["Cargos, empregos e funções públicas"],
      }),
      chapterTitle: estabilidade.chapterTitle,
      courseTitle: estabilidade.courseTitle,
      language: "pt",
      lessonCanDo: estabilidade.spec.canDo,
      lessonDescription: estabilidade.spec.description,
      lessonTitle: estabilidade.spec.title,
      level: "beginner",
      skills: estabilidade.spec.skills.map((skill) => skill.name),
      sources: estabilidade.sources,
    },
  },
  {
    expectations: `
      - MUST be in US English
      - Beginner lesson on percent change: explanation first; a hook such as a price that rises 50% then falls 50% and doesn't return to the start
      - Calculating a percent change is a procedure, so it needs a worked example with real numbers followed by a similar check with less help
      - Checks should include the classic trap of dividing by the new value instead of the original
      - The application uses a realistic case (a rent increase, a salary raise, a sale price)
      - Discounts, markups and percentage points belong to the other lessons and get at most a sentence

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-percent-change-beginner",
    userInput: {
      activityTemplates: ACTIVITY_TEMPLATES,
      chapterLessons: outlined({
        after: ["Discounts and markups", "Percentage points"],
        before: ["Percent of a quantity"],
      }),
      chapterTitle: "Fractions and percentages",
      courseTitle: "Mathematics",
      language: "en",
      lessonCanDo: "Calculate how much a price changed in percent",
      lessonDescription:
        "Work out how much a price or a salary went up or down in percent, and why a 50% drop needs a 100% rise to recover.",
      lessonTitle: "Percent change",
      level: "beginner",
      skills: ["Calculate a percent change"],
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Intermediate lesson on direct and inverse rule of three, a topic most learners at this level partly know, so question first is a good fit
      - Must teach how to tell direct from inverse proportion before setting up the rule of three, with a worked example of each (inverse ones are the common trap)
      - Compound rule of three may be split into its own lesson or kept only if the lesson still fits; either is fine if the plan is coherent
      - Applications should look like real problems (workers and days, recipes, fuel and distance)

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-regra-de-tres-intermediate",
    userInput: {
      activityTemplates: ACTIVITY_TEMPLATES,
      chapterLessons: outlined({
        after: ["Porcentagem"],
        before: ["Razão e escala", "Grandezas proporcionais"],
      }),
      chapterTitle: "Razão e proporção",
      courseTitle: "Matemática",
      language: "pt",
      lessonCanDo: "Resolver problemas com grandezas direta e inversamente proporcionais",
      lessonDescription:
        "Monte e resolva regras de três simples e compostas, reconhecendo quando as grandezas são direta ou inversamente proporcionais.",
      lessonTitle: "Regra de três simples e composta",
      level: "intermediate",
      skills: [
        "Identificar grandezas direta e inversamente proporcionais",
        "Resolver regra de três simples",
        "Resolver regra de três composta",
      ],
    },
  },
  {
    expectations: `
      - MUST be in US English
      - Advanced lesson: deriving the energy levels of a particle in a one-dimensional infinite well from the time-independent Schrödinger equation (boundary conditions, sine solutions, quantized wave numbers, E_n proportional to n squared over L squared)
      - The derivation is one idea that may not split; up to 6 minutes is allowed for one skill at the advanced level
      - Notation is expected here but should follow a picture of standing waves on a string; a worked derivation with a check after the boundary conditions
      - An activity such as a slider graph (energy against n or L) or a visual of the first standing waves fits
      - The time-dependent equation, tunneling and the harmonic oscillator belong to other lessons

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-particle-in-a-box-advanced",
    userInput: {
      activityTemplates: ACTIVITY_TEMPLATES,
      chapterLessons: outlined({
        after: ["Quantum tunneling", "The quantum harmonic oscillator"],
        before: ["The time-independent Schrödinger equation"],
      }),
      chapterTitle: "The Schrödinger equation",
      courseTitle: "Quantum mechanics",
      language: "en",
      lessonCanDo: "Derive the energy levels of a particle in a box",
      lessonDescription:
        "Solve the time-independent Schrödinger equation for a particle trapped in a one-dimensional box and see why its energy comes in steps.",
      lessonTitle: "Particle in a box",
      level: "advanced",
      skills: ["Derive the energy levels of a particle in a box"],
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Overview lesson for a curious adult: why the electron doesn't fall into the nucleus, told as a story with an everyday comparison (a blurred fan, a cloud) and no formulas, equations or notation
      - A guess-first hook fits ("the electron orbits like the Earth around the Sun?"); checks are light and fun
      - No worked examples are needed for an overview idea; a visual of the cloud versus the old orbit picture helps
      - Orbitals in detail, quantum numbers and the uncertainty principle's math belong elsewhere

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-eletron-nucleo-overview",
    userInput: {
      activityTemplates: ACTIVITY_TEMPLATES,
      chapterLessons: outlined({
        after: ["O princípio da incerteza"],
        before: ["A luz em pacotes", "Onda ou partícula?"],
      }),
      chapterTitle: "O átomo por dentro",
      courseTitle: "Física quântica",
      language: "pt",
      lessonCanDo: "Explicar por que o elétron não cai no núcleo",
      lessonDescription:
        "Descubra por que o elétron não despenca no núcleo e por que isso faz os átomos, e você, existirem.",
      lessonTitle: "Por que o elétron não cai no núcleo",
      level: "overview",
      skills: ["Explicar por que o elétron não cai no núcleo"],
    },
  },
  {
    expectations: `
      - MUST be in Spain Spanish (not Latin American Spanish)
      - Beginner lesson on pivot tables in a spreadsheet for someone who builds sales reports at work
      - Building a pivot table is a procedure, so it needs a worked example on a small sales table (rows, columns, values, summary function) and then a similar task with less help
      - Checks should make the learner choose rows, columns and the summary (sum vs count vs average) for a question
      - The application answers a real work question (sales by region and month); an activity like categorize or chart reading may fit, but a decorative one does not

      ${SHARED_EXPECTATIONS}
    `,
    id: "es-tablas-dinamicas-beginner",
    userInput: {
      activityTemplates: ACTIVITY_TEMPLATES,
      chapterLessons: outlined({
        after: ["Gráficos a partir de tablas"],
        before: ["Ordenar y filtrar datos", "Funciones SUMAR.SI y CONTAR.SI"],
      }),
      chapterTitle: "Resumir datos",
      courseTitle: "Análisis de datos con hojas de cálculo",
      language: "es",
      lessonCanDo: "Resumir una tabla de ventas con una tabla dinámica",
      lessonDescription:
        "Convierte cientos de filas de ventas en un resumen por región y mes con una tabla dinámica.",
      lessonTitle: "Tablas dinámicas",
      level: "beginner",
      skills: ["Crear una tabla dinámica", "Elegir la función de resumen de una tabla dinámica"],
    },
  },
  {
    expectations: `
      - MUST be in US English
      - The input bundles six skills, so the output MUST be split into several lessons, each with 1 to 3 closely linked skills, in teaching order
      - Natural boundaries: measures of center (mean, median, mode, and which to use when there are outliers) apart from measures of spread (range, interquartile range, variance and standard deviation); standard deviation is hard and needs a worked example
      - Each lesson needs its own canonical title, a scoped description, a concrete can-do line, a hook and one application

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-describing-data-oversized",
    userInput: {
      activityTemplates: ACTIVITY_TEMPLATES,
      chapterLessons: outlined({ after: ["Box plots"], before: ["Types of data", "Histograms"] }),
      chapterTitle: "Describing data",
      courseTitle: "Statistics",
      language: "en",
      lessonCanDo: "Summarize a data set with the right numbers",
      lessonDescription:
        "Mean, median, mode, range, interquartile range, variance and standard deviation, and when to use each.",
      lessonTitle: "Summarizing a data set",
      level: "beginner",
      skills: [
        "Calculate the mean",
        "Find the median",
        "Find the mode",
        "Calculate the range",
        "Calculate the interquartile range",
        "Calculate the standard deviation",
      ],
    },
  },
  {
    expectations: `
      - MUST be in US English, overview level: plain words and stories, no formulas
      - The earlier lessons already taught what sets a trade price, liquidity and the spread: each gets at most a short reminder, never its own explanation screen, and the hook is about this lesson's idea, not a recap
      - The plan uses its own case and numbers: not the $20 then $21 trade, the $19 sale, the $20.10 and $20.00 price tags or the busy and empty market stalls the earlier lessons used
      - Each check asks something new (a new case, a harder one or a common mistake), never the same question with other numbers, and the application is a new situation that takes one more step, not the explanation's example again
      - The hook has a tempting wrong answer, such as every share trading at the first price shown

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-price-impact-chapter-siblings",
    userInput: {
      activityTemplates: ACTIVITY_TEMPLATES,
      chapterLessons: [
        {
          canDo: "Explain why a stock's next trade may have a different price",
          examples: [
            "One share trades for $20; later, a buyer offers $21 and a seller accepts, so the next trade is at $21.",
            "A stock traded for $20 a minute ago, then for $21. Ask learners to guess what might have changed.",
            "The last trade was $20. Buyers now want to pay only $19, and a seller accepts. Ask for the next trade price.",
          ],
          ideas: [
            "A stock's next trade price changes when buyers and sellers change the prices they'll agree on.",
          ],
          order: "before",
          title: "Why stock prices change",
        },
        {
          canDo: "Recognize when a stock may be hard to trade",
          examples: [
            "Stock A has several people ready to buy and sell today; Stock B has one ready seller and no ready buyer.",
            "Compare selling at a busy market stall with selling at an empty one.",
          ],
          ideas: [
            "Market liquidity is how easy it is to trade a stock when willing buyers and sellers are available.",
          ],
          order: "before",
          title: "Market liquidity",
        },
        {
          canDo: "Spot a trading cost in the buy-sell price gap",
          examples: [
            "A share costs $20.10 to buy but sells for $20.00, leaving a 10-cent spread.",
            "Two price tags for the same stock: buy for $20.10 and sell for $20.00. If you buy and sell right away, do you get back what you paid?",
          ],
          ideas: ["The gap between the buying and selling price is a cost of trading right away."],
          order: "before",
          title: "Buying and selling price spreads",
        },
        {
          canDo: "Imagine how this chapter's ideas play out",
          order: "after",
          title: "What if? Prices and trading costs",
        },
      ],
      chapterTitle: "Prices and trading costs",
      courseTitle: "How the stock market works",
      language: "en",
      lessonCanDo: "Explain why a large order may trade at several prices",
      lessonDescription:
        "See how a large buy or sell order can use up the shares offered at one price and reach a less favorable one.",
      lessonTitle: "Large orders and price impact",
      level: "overview",
      skills: ["Explain the price impact of an order"],
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese, for beginners
      - The earlier lesson already taught a single increase or discount with its factor (× 1,10 or × 0,75): it gets at most a short reminder, and the new idea is chaining factors, such as why +10% then −10% doesn't return to the start
      - The plan uses its own cases and numbers: not the R$ 80 camiseta with 25% off, the R$ 2.000 salário with a 10% raise or "20% de R$ 150" from the earlier lessons
      - A worked example of two changes in a row, followed by a similar check with less help; the checks include the trap of adding the percentages, and each check asks something new
      - Juros simples belongs to the next lesson

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-descontos-sucessivos-chapter-siblings",
    userInput: {
      activityTemplates: ACTIVITY_TEMPLATES,
      chapterLessons: [
        {
          canDo: "Calcular a porcentagem de um valor",
          examples: [
            "Quanto é 20% de R$ 150?",
            "Numa turma de 40 alunos, 25% usam óculos. Quantos são?",
          ],
          ideas: ["Para achar 20% de um valor, multiplique o valor por 0,20."],
          order: "before",
          title: "Porcentagem de um valor",
        },
        {
          canDo: "Aplicar um aumento ou um desconto percentual",
          examples: [
            "Uma camiseta de R$ 80 com 25% de desconto passa a custar R$ 60.",
            "Um salário de R$ 2.000 com aumento de 10% vai para R$ 2.200.",
            "Qual é o fator de um aumento de 15%?",
          ],
          ideas: [
            "Um aumento de 10% multiplica o valor por 1,10.",
            "Um desconto de 25% multiplica o valor por 0,75.",
          ],
          order: "before",
          title: "Aumento e desconto percentual",
        },
        {
          canDo: "Calcular juros simples de um empréstimo",
          order: "after",
          title: "Juros simples",
        },
      ],
      chapterTitle: "Porcentagem",
      courseTitle: "Matemática",
      language: "pt",
      lessonCanDo: "Calcular o efeito de aumentos e descontos seguidos",
      lessonDescription:
        "Entenda por que um aumento de 10% seguido de um desconto de 10% não volta ao preço inicial e calcule variações acumuladas.",
      lessonTitle: "Aumentos e descontos sucessivos",
      level: "beginner",
      skills: ["Calcular aumentos e descontos sucessivos"],
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - The lesson is shared by learners preparing for different concursos and exams: no screen names a particular exam, examining board, notice or notice item ("Câmara dos Deputados", "Cebraspe", "subitem", "edital"); checks may follow a concurso's style without naming one
      - Examples and situations are real uses of written Portuguese for adults at work (an email, an official letter, a report, a news text), never a padaria, a feira or a child's scene
      - People and towns come from CAST, each used once
      - Teaches subject–verb agreement in the cases concurso items test (a postponed subject, collective nouns, "haver" meaning "existir"), with a check where the learner judges a sentence right or wrong

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-concordancia-shared-intermediate",
    userInput: {
      activityTemplates: ACTIVITY_TEMPLATES,
      chapterLessons: outlined({
        after: ["Concordância nominal"],
        before: ["Sujeito e predicado"],
      }),
      chapterTitle: "Concordância",
      courseTitle: "Língua Portuguesa",
      language: "pt",
      lessonCanDo: "Julgar a concordância verbal em frases com sujeito posposto",
      lessonDescription:
        "Reconheça quando o verbo concorda com um sujeito que vem depois dele, com nomes coletivos e com o verbo haver no sentido de existir.",
      lessonTitle: "Concordância verbal em casos difíceis",
      level: "intermediate",
      skills: ["Julgar a concordância verbal", "Aplicar a concordância do verbo haver"],
    },
  },
  {
    expectations: `
      - MUST be in US English
      - A UX lesson for people who work or will work in product teams: its situations happen in a product team, an app or a website and its users, never at a bakery, a market or a bus stop
      - Plans one "Spot the AI's mistake" activity (findError) whose brief says which step the mistake is in: an early or middle step, so later steps build on it; never the final "So…" step
      - Checks ask something new each time; no check repeats an earlier one with other names

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-ux-goals-shared-findError",
    userInput: {
      activityTemplates: ACTIVITY_TEMPLATES,
      chapterLessons: outlined({
        after: ["Product metrics tied to tasks"],
        before: ["People, tasks and context"],
      }),
      chapterTitle: "UX goals and outcomes",
      courseTitle: "UX Design",
      language: "en",
      lessonCanDo: "Write a UX goal that names the change without naming a solution",
      lessonDescription:
        "State what should change in people's experience before choosing a design, and tell a goal from a solution in disguise.",
      lessonTitle: "Writing UX goals",
      level: "beginner",
      skills: ["Write a UX goal without a solution", "Tell a UX goal from a proposed solution"],
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Written for candidates of the exam in EXAMS (law students and graduates): no screen explains what the OAB, the Constitution, a lawyer or the Estatuto is; the briefs plan the finalidades as the statute states them, telling the institutional ones (defend the Constitution, the legal order, human rights, social justice, the good application of laws and the quick administration of justice) from the corporate ones (representation, defense, selection and discipline of lawyers, exclusively)
      - Briefs name the provision each rule comes from (art. 44, I and II, of Lei 8.906/1994, the Estatuto da Advocacia e da OAB) and nothing contradicts it
      - Checks and the application are planned like that exam's multiple-choice questions on the topic: a case or a statement about the OAB's finalidades and wrong answers that are confusions candidates make (an institutional finalidade taken as corporate, an exclusive one shared with other bodies, the OAB as an ordinary professional council), never an option no candidate would pick
      - No screen names the exam, its board or its notice (no "OAB 1ª fase", "FGV", "Exame de Ordem", "edital"); the OAB itself may be named, since the course is about it

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-finalidades-oab-exam-prep",
    userInput: {
      activityTemplates: ACTIVITY_TEMPLATES,
      chapterLessons: outlined({ after: ["Órgãos da OAB", "Natureza jurídica da OAB"] }),
      chapterTitle: "Estrutura e competências da OAB",
      courseTitle:
        "Estatuto da Advocacia e da OAB, Regulamento Geral e Código de Ética e Disciplina da OAB",
      exams: [
        {
          name: "OAB Exame de Ordem Unificado, 1ª fase",
          style:
            "multipleChoice (4 options): Questões de múltipla escolha com 4 opções (A, B, C e D) e uma única resposta correta.",
        },
      ],
      language: "pt",
      lessonCanDo: "Distinguir as finalidades institucionais das corporativas da OAB",
      lessonDescription:
        "As finalidades que o Estatuto dá à OAB, na defesa da ordem jurídica e na representação dos advogados.",
      lessonTitle: "Finalidades da OAB",
      level: "beginner",
      skills: ["Identificar as finalidades da OAB"],
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese (instructions, briefs and explanations), with the English texts the learner reads in English
      - Written for candidates of the exam in EXAMS, who read English texts at B1 to B2: the briefs plan short authentic-style excerpts (a news report, an institutional statement, an opinion piece, a report on public policy) of several sentences, never one-line everyday sentences ("The bus is full," said Camila) or a padaria, a bus or a museum
      - The checks ask what such an exam asks about attribution: whose claim a statement is (the author's or a quoted source's), whether the author endorses or only reports it, reporting verbs that signal stance (claim, argue, acknowledge, deny), and at least one check judges a statement about the text as right or wrong
      - Tempting wrong answers are real reading mistakes (taking a quoted claim as the author's view, missing a hedge), never options no candidate would pick
      - No screen names the exam, its board or its notice (no "Câmara dos Deputados", "Cebraspe", "edital")

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-citacoes-ingles-exam-prep",
    userInput: {
      activityTemplates: ACTIVITY_TEMPLATES,
      chapterLessons: outlined({ after: ["Afirmação atribuída e relato do autor"] }),
      chapterTitle: "Atribuição de informações em textos ingleses",
      courseTitle: "Língua inglesa",
      exams: [
        {
          name: "Concurso Câmara dos Deputados, Analista Legislativo - Registro e Redação",
          style:
            "trueFalse: Itens julgados CERTO ou ERRADO. essay: Duas questões discursivas sobre conhecimentos específicos, com até 20 linhas cada.",
        },
      ],
      language: "pt",
      lessonCanDo: "Identificar quem disse uma frase citada em inglês",
      lessonDescription:
        "Como as aspas e os verbos de fala mostram quem disse cada frase de um texto em inglês.",
      lessonTitle: "Citações diretas e autoria",
      level: "intermediate",
      skills: ["Identificar quem disse uma citação direta"],
    },
  },
  ...VISUAL_TEST_CASES,
];
