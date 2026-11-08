import { type TestCase } from "@/lib/types";
import { type LessonSpecParams } from "@zoonk/ai/tasks/lesson-spec";
import { listPlannerTemplates } from "@zoonk/core/library/activities/writer-templates";
import { BUDGET_LESSON_SPECS } from "../lesson-writer/budget-lesson-specs";
import { MOBILITY_LESSON } from "../lesson-writer/mobility-lesson-spec";
import { SOURCED_LESSONS } from "../lesson-writer/sourced-lesson-specs";
import { BROAD_SAMPLE_CASES } from "./broad-sample-cases";
import { type LessonSpecExpected, VISUAL_TEST_CASES } from "./visual-test-cases";

const ACTIVITY_TEMPLATES: LessonSpecParams["activityTemplates"] = listPlannerTemplates();

const SHARED_EXPECTATIONS = `
  - The output is a list of lesson specs (usually one; several only when the lesson had to be split): title, description, can-do line, 1 to 3 skills and a screen plan whose screens have a kind, skill indexes (0-based into the lesson's skills), a brief for the writer, an optional visual and an activity template id on activity screens
  - Estimated minutes are computed by code from the screen kinds; don't grade the number itself
  - Don't evaluate JSON formatting
`;

const { "en-tax-deadlines": taxDeadlines, "pt-estabilidade": estabilidade } = SOURCED_LESSONS;

type ChapterLessons = NonNullable<LessonSpecParams["chapterLessons"]>;

function outlined({ after = [], before = [] }: { after?: string[]; before?: string[] }) {
  return [
    ...before.map((title) => ({ order: "before" as const, title })),
    ...after.map((title) => ({ order: "after" as const, title })),
  ] satisfies ChapterLessons;
}

function budgetLesson(key: keyof typeof BUDGET_LESSON_SPECS): LessonSpecParams {
  const spec = BUDGET_LESSON_SPECS[key];

  return {
    activityTemplates: ACTIVITY_TEMPLATES,
    chapterTitle: "O dinheiro que entra e sai de casa",
    courseTitle: "Orçamento doméstico",
    language: "pt",
    lessonCanDo: spec.canDo,
    lessonDescription: spec.description,
    lessonTitle: spec.title,
    level: "beginner",
    skills: spec.skills.map((skill) => skill.name),
  };
}

const UNANSWERABLE_GUESS = `
  - Right after the first explanation, one guess predicts something a beginner could get wrong, followed by another explanation or worked example
  - Someone who reads only the guess's question, knowing nothing the lesson teaches, can't answer it: its setup never settles the answer by itself, and the right option is never the only one that echoes the question's words
  - No option but the tempting one is right under another common reading, and a later screen says why the tempting one's reasoning doesn't give the answer
`;

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
      - Intermediate lesson on direct and inverse rule of three, a topic most learners at this level partly know; the plan still explains before its first check
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
      - MUST be in US English
      - Advanced lesson for a learner with a physics degree: what Bell tests rule out (local hidden variables with free setting choices), what they don't, and the loopholes experiments closed
      - Every formula matches the system the lesson describes. For photon polarizers, the correlation follows twice the angle between the settings, as in $E = \\cos 2(\\theta_L - \\theta_R)$ up to sign, and settings that reach $S = 2\\sqrt2$ sit 22.5° apart; $E = -\\cos(\\theta_L - \\theta_R)$ with settings 45° apart holds for spin-½ measurement directions, not polarizer angles
      - MUST NOT pair photon polarizer angles with the spin-½ correlation, which gives the wrong numbers for every setting

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-bells-test-advanced",
    userInput: {
      activityTemplates: ACTIVITY_TEMPLATES,
      chapterLessons: outlined({ before: ["Qubits"] }),
      chapterTitle: "Entanglement and quantum computing",
      courseTitle: "Quantum physics from scratch",
      language: "en",
      lessonDescription: "How experiments ruled out a hidden plan.",
      lessonTitle: "Bell's test",
      level: "advanced",
      skills: ["Explain what Bell tests showed"],
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Overview lesson for a curious adult: why the electron doesn't fall into the nucleus, told as a story with an everyday comparison (a blurred fan, a cloud) and no formulas, equations or notation
      - The hook is a scene that asks nothing: the atom's picture as a story, ending on the question the lesson answers (why doesn't the electron fall in?), with no options; checks are light and come after at least two teaching screens
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
      - MUST be in Latin American Spanish as written in Mexico (not Spain Spanish: no "vosotros", "ordenador" or euros)
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
      - The hook is a scene that asks nothing; the guess right after the first explanation has a tempting wrong answer, such as every share trading at the first price shown

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
      - Plans an activity that practices the skill: sorting goals from solutions in disguise, or a "Spot the AI's mistake" (findError) where an AI assistant's draft goal names a solution, whose brief says which step the mistake is in: an early or middle step, so later steps build on it; never the final "So…" step
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
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Written for candidates of the exam in EXAMS, finishing secondary school: checks are planned like that exam's contextualized multiple-choice questions on proteins and enzymes
      - "Mesmo em causa própria" belongs to incompatibilidade (art. 28); no brief ties it to impedimento or to art. 27, which only says incompatibilidade forbids all advocacy and impedimento part of it (a regression: an earlier plan cited it as art. 27)
      - The scene comes first and asks nothing, an explanation comes next, and the guess right after it; no check comes before that explanation
      - No "Spot the AI's mistake": an exam lesson never frames an activity as an AI assistant's answer
      - The explanation of how an enzyme works in steps (the substrate fits the active site, the reaction, the products leave and the enzyme is free again) shows them with a template to explore, such as the steps of a process in order, rather than a strip of drawings or text alone; a picture plans only what no template draws (a protein's folded shape, the active site's fit)
      - An activity, if any, is one whose interaction is the skill (ordering the enzyme's steps, sorting changes that do or don't alter a protein's shape), never decoration

      ${SHARED_EXPECTATIONS}
    `,
    expected: { avoidTemplates: ["findError"] },
    id: "pt-enzimas-exam-prep-activities",
    userInput: {
      activityTemplates: ACTIVITY_TEMPLATES,
      chapterLessons: outlined({
        after: ["Nucleotídeos, ácidos nucleicos e ATP"],
        before: ["Carboidratos e lipídios"],
      }),
      chapterTitle: "Biomoléculas e funções celulares",
      courseTitle: "Biologia",
      exams: [
        {
          name: "ENEM, Ciências da Natureza e suas Tecnologias",
          style:
            "multipleChoice (5 options): Questões de múltipla escolha contextualizadas, com 5 alternativas (A a E) e uma única resposta correta.",
        },
      ],
      language: "pt",
      lessonCanDo: "Explicar como a forma de uma enzima define a reação que ela acelera",
      lessonDescription:
        "Como a sequência de aminoácidos dá forma a uma proteína e como uma enzima encaixa a molécula que transforma.",
      lessonTitle: "Proteínas e enzimas",
      level: "intermediate",
      skills: ["Relacionar estrutura proteica e função", "Explicar a ação de uma enzima"],
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Written for candidates of the exam in EXAMS (law students and graduates): the briefs plan the rules as the Estatuto da Advocacia states them (art. 27: incompatibilidade forbids all advocacy, impedimento only part of it; arts. 28 and 30 for the cases), with the provision named only when the plan is sure of it
      - No "Spot the AI's mistake": an exam lesson never frames an activity as an AI assistant's answer
      - An activity, if any, has the learner do what the skill asks, such as sorting situations into incompatibilidade or impedimento, or walking a case through the questions that decide which one applies; checks read like that exam's questions with confusions candidates make
      - No screen names the exam, its board or its notice

      ${SHARED_EXPECTATIONS}
    `,
    expected: { avoidTemplates: ["findError"] },
    id: "pt-impedimento-oab-exam-prep-activities",
    userInput: {
      activityTemplates: ACTIVITY_TEMPLATES,
      chapterLessons: outlined({
        after: ["Cargos e funções incompatíveis"],
        before: ["Consultoria, assessoria e direção jurídicas"],
      }),
      chapterTitle: "Atividade da advocacia e suas restrições",
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
      lessonCanDo: "Distinguir incompatibilidade de impedimento no exercício da advocacia",
      lessonDescription:
        "A diferença entre a proibição total de advogar e a proibição parcial, e os casos de cada uma no Estatuto.",
      lessonTitle: "Incompatibilidade e impedimento",
      level: "intermediate",
      skills: ["Distinguir incompatibilidade de impedimento"],
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Written for candidates of the exam in EXAMS, finishing secondary school, with checks like that exam's contextualized questions that read tables and graphs
      - No "Spot the AI's mistake": an exam lesson never frames an activity as an AI assistant's answer
      - The explanations of how one quantity changes with another (directly proportional, inversely proportional, with the square) let the learner see it: a template to explore where a slider changes one quantity and the other follows on a curve, or a chart with exact values; never a picture carrying the numbers
      - An activity, if any, is one whose interaction is the skill (moving a value and saying how the other changed, reading a relation off a table or a curve)

      ${SHARED_EXPECTATIONS}
    `,
    expected: { avoidTemplates: ["categorize", "findError"] },
    id: "pt-relacoes-grandezas-exam-prep-activities",
    userInput: {
      activityTemplates: ACTIVITY_TEMPLATES,
      chapterLessons: outlined({
        after: ["Componentes e soma de vetores"],
        before: ["Inclinação e área em gráficos físicos"],
      }),
      chapterTitle: "Grandezas físicas e representações",
      courseTitle: "Física",
      exams: [
        {
          name: "ENEM, Ciências da Natureza e suas Tecnologias",
          style:
            "multipleChoice (5 options): Questões de múltipla escolha contextualizadas, com 5 alternativas (A a E) e uma única resposta correta.",
        },
      ],
      language: "pt",
      lessonCanDo: "Reconhecer relações direta, inversa e quadrática em tabelas e gráficos",
      lessonDescription:
        "Como uma grandeza muda com outra quando são diretamente proporcionais, inversamente proporcionais ou quando uma depende do quadrado da outra.",
      lessonTitle: "Relações entre grandezas em tabelas e gráficos",
      level: "intermediate",
      skills: [
        "Identificar proporcionalidade direta e inversa",
        "Reconhecer dependência com o quadrado",
      ],
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Exactly one lesson (never split) of about 3 to 5 minutes and 6 to 8 screens, whose only skill is the one given, with its name kept
      - It sums up the skill's core for candidates of the exam in EXAMS, finishing secondary school: the order of amino acids gives a protein its shape, the shape decides what it binds and does, and an enzyme's active site fits its substrate; details and rare cases are left out, and terms are explained before use
      - One worked example of the core reasoning (for example a changed amino acid changing the shape and the function, or an enzyme acting on its substrate), followed by a check where the learner does a similar one; the hook comes first, the application last, and no more than 3 teaching screens in a row
      - At most one activity, only one that fits the skill (such as putting an enzyme's steps in order), and no "Spot the AI's mistake"; pictures or templates only where the learner would otherwise have to imagine a shape or a process

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-quick-proteinas-enem",
    userInput: {
      activityTemplates: ACTIVITY_TEMPLATES,
      chapterTitle: "Biomoléculas e funções celulares",
      courseTitle: "Biologia",
      exams: [
        {
          name: "ENEM, Ciências da Natureza e suas Tecnologias",
          style:
            "multipleChoice (5 options): Questões de múltipla escolha contextualizadas, com 5 alternativas (A a E) e uma única resposta correta.",
        },
      ],
      language: "pt",
      lessonCanDo: "Relacionar estrutura proteica e função",
      lessonDescription:
        "A ordem dos aminoácidos define a forma da proteína, e a forma define o que ela reconhece e faz.",
      lessonTitle: "Aula rápida: Relacionar estrutura proteica e função",
      level: "intermediate",
      quick: true,
      skills: ["Relacionar estrutura proteica e função"],
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Exactly one lesson (never split) of about 3 to 5 minutes and 6 to 8 screens, whose only skill is the one given, with its name kept
      - It sums up the skill's core for candidates of the exam in EXAMS (law students and graduates): full, contained and limited efficacy of constitutional norms, what each means for a right's exercise, with one well-known example each from the Constitution only when the plan is sure of it; no screen explains what the Constitution is, and rare doctrinal classifications are left out
      - One worked example that classifies a constitutional provision step by step (for example art. 5º, XIII, as contained efficacy), followed by a check where the learner classifies another; the scene comes first and the guess right after the first explanation, the application last, and no more than 3 teaching screens in a row
      - At most one activity, only one that fits the skill (such as sorting provisions by their efficacy), and no "Spot the AI's mistake"; checks read like that exam's questions with confusions candidates make
      - No screen names the exam, its board or its notice

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-quick-eficacia-normas-oab",
    userInput: {
      activityTemplates: ACTIVITY_TEMPLATES,
      chapterTitle: "Fundamentos do Direito Constitucional",
      courseTitle: "Direito Constitucional",
      exams: [
        {
          name: "OAB Exame de Ordem Unificado, 1ª fase",
          style:
            "multipleChoice (4 options): Questões de múltipla escolha com 4 opções (A, B, C e D) e uma única resposta correta.",
        },
      ],
      language: "pt",
      lessonCanDo: "Classificar normas constitucionais quanto à eficácia",
      lessonDescription:
        "Normas de eficácia plena, contida e limitada: o que cada uma permite e quando depende de lei.",
      lessonTitle: "Aula rápida: Classificar normas constitucionais quanto à eficácia",
      level: "intermediate",
      quick: true,
      skills: ["Classificar normas constitucionais quanto à eficácia"],
    },
  },
  ...VISUAL_TEST_CASES,
  ...BROAD_SAMPLE_CASES,
  {
    expectations: `
      - MUST be in natural Japanese: です・ます, never あなた
      - Beginner lesson on percentages of change for shopping and prices in Japan: 割引, 税込 and 税抜 prices, and a price going up by a percentage, with amounts in 円
      - A worked example comes before a similar task with less help, and checks make the learner compute or choose the result
      - Skill names and can-do lines end in the plain potential form (計算できる, 作れる, ～できる), never as an order (～しよう, ～してください) or a bare noun

      ${SHARED_EXPECTATIONS}
    `,
    id: "ja-percent-change-beginner",
    userInput: {
      activityTemplates: ACTIVITY_TEMPLATES,
      chapterLessons: outlined({ after: ["割合をグラフで比べる"], before: ["割合と百分率"] }),
      chapterTitle: "割合",
      courseTitle: "毎日の数学",
      language: "ja",
      lessonCanDo: "割引後の値段を計算できる",
      lessonDescription: "2割引や10%増しの値段を、電卓なしで出せるようになります。",
      lessonTitle: "割引と値上げを計算する",
      level: "beginner",
      skills: ["割引後の値段を計算できる", "値上げ後の値段を計算できる"],
    },
  },
  {
    expectations: `
      - MUST be in natural Korean in 해요체
      - Beginner lesson on writing a simple SQL query with WHERE for someone who builds reports at work, with Korean business examples (amounts in 원, Korean names and cities)
      - Writing a query is a procedure, so it needs a worked example on a small table and then a similar task with less help
      - Skill names and can-do lines end in ~ㄹ 수 있어요 (계산할 수 있어요, 읽을 수 있어요), never as an order (~하세요, ~해 보세요) or a bare noun

      ${SHARED_EXPECTATIONS}
    `,
    id: "ko-sql-where-beginner",
    userInput: {
      activityTemplates: ACTIVITY_TEMPLATES,
      chapterLessons: outlined({
        after: ["여러 조건으로 행 고르기"],
        before: ["테이블과 행 이해하기"],
      }),
      chapterTitle: "데이터 고르기",
      courseTitle: "SQL 기초",
      language: "ko",
      lessonCanDo: "조건에 맞는 행만 골라낼 수 있어요",
      lessonDescription: "WHERE로 필요한 주문만 골라 보고서를 빠르게 만들어요.",
      lessonTitle: "WHERE로 행 고르기",
      level: "beginner",
      skills: ["WHERE로 조건에 맞는 행을 고를 수 있어요"],
    },
  },
  {
    expectations: `
      - MUST be in natural Turkish, addressing the learner as "sen"
      - Beginner lesson on comparing a deposit account's return with inflation in Turkey: nominal and real return, monthly interest, the stopaj tax on interest, with amounts in TL
      - A worked example comes before a similar task with less help, and the application answers a real choice the learner faces with their savings
      - Skill names and can-do lines end in the -mak/-mek infinitive with the verb last ("bütçe hazırlamak"), never as an order ("hazırlayın", "hazırla") or a bare noun

      ${SHARED_EXPECTATIONS}
    `,
    id: "tr-real-return-beginner",
    userInput: {
      activityTemplates: ACTIVITY_TEMPLATES,
      chapterLessons: outlined({ after: ["Fonları karşılaştırmak"], before: ["Enflasyon nedir?"] }),
      chapterTitle: "Birikimini korumak",
      courseTitle: "Kişisel finans",
      language: "tr",
      lessonCanDo: "Mevduat getirisini enflasyonla karşılaştırmak",
      lessonDescription: "Vadeli hesabın faizi enflasyonu geçiyor mu, birkaç adımda hesapla.",
      lessonTitle: "Faiz enflasyonu geçiyor mu?",
      level: "beginner",
      skills: ["Reel getiriyi hesaplamak"],
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese, for a total beginner in accounting
      - The hook is a scene that asks nothing: the lesson's main example (a small business with its things, what clients still owe it and what it owes) in one or two everyday sentences, ending on the question the lesson answers (how much of it really belongs to the owner?), with no options and no term the lesson explains (bens, direitos, obrigações, patrimônio líquido)
      - Explanation first, with at least two explanations or worked examples before the first check
      - One new term per screen: bens, direitos and obrigações were taught in the earlier lessons and are recalled in a few words, never defined again all on one screen together with patrimônio líquido and a caveat
      - The hard ideas the skill needs stay, each taught on its own screen before a check uses it, never left out: paying a debt with cash leaves the patrimônio líquido unchanged (the cash and the debt both go down), and the patrimônio líquido isn't the cash in the till. A case with the owner's personal belongings gets at most a one-sentence reminder of the earlier lesson's rule
      - The amounts are shown with what the app draws (a table that adds up, a before-and-after table, a formula to play with), not pictures; nothing here has to be seen, so the hook's business needs no picture, and a picture never carries numbers
      - Right after the first explanation, one guess predicts something learners really get wrong, its question never containing its answer and never asking for a calculation the screen before just did; the guess is followed by another explanation or worked example
      - The explanation where patrimônio líquido lands names it after its everyday meaning, with a comparison only if one truly maps, and the line that keeps it precise: patrimônio líquido isn't the cash in the till
      - Every check asks only what an earlier screen taught (a regression: an earlier plan's checks asked about ideas no screen had explained)

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-patrimonio-liquido-beginner",
    userInput: {
      activityTemplates: ACTIVITY_TEMPLATES,
      chapterLessons: [
        {
          canDo: "Identificar bens e direitos de uma entidade",
          ideas: [
            "Bens são recursos que a empresa controla e pode usar ou vender, como máquinas, dinheiro e marcas adquiridas.",
            "Direitos são valores ou benefícios que a empresa tem a receber, como o pagamento por uma venda entregue.",
          ],
          order: "before",
          title: "Bens e direitos",
        },
        {
          canDo: "Identificar obrigações de uma entidade",
          ideas: [
            "Uma obrigação é um compromisso que a empresa já tem com outra parte e ainda precisa cumprir, mesmo antes do vencimento.",
            "Um plano de compra, por si só, não cria uma obrigação.",
          ],
          order: "before",
          title: "Obrigações",
        },
        {
          canDo: "Distinguir o patrimônio da entidade do patrimônio pessoal",
          ideas: [
            "Na contabilidade, a empresa é considerada separadamente de seus proprietários.",
            "Os bens, direitos e dívidas da empresa não se confundem automaticamente com os itens pessoais de seus proprietários.",
          ],
          order: "before",
          title: "Separação patrimonial",
        },
        ...outlined({ after: ["Desafio: Elementos do patrimônio"] }),
      ],
      chapterTitle: "Elementos do patrimônio",
      courseTitle: "Contabilidade",
      language: "pt",
      lessonCanDo: "Calcular o patrimônio líquido a partir de bens, direitos e obrigações",
      lessonDescription:
        "O patrimônio líquido representa a diferença entre os recursos da entidade e suas obrigações.",
      lessonTitle: "Patrimônio líquido",
      level: "beginner",
      skills: ["Identificar elementos do patrimônio"],
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese, for a total beginner in biology
      - The hook is a scene that asks nothing: one real place full of life, ending on the question the lesson answers (how do the living things of a place fit together?), with no options
      - Each explanation teaches one level (population, community, ecosystem), with one new term per screen; organismo was taught in an earlier lesson and is recalled in a few words, never introduced again on the screen that introduces espécie
      - A species is defined precisely (living beings alike enough to reproduce together and have fertile offspring), never as "related living beings"
      - The levels are something to see: the screens that teach them show pictures of the same place, each with the level the screen is about highlighted, one scene per picture
      - At least two explanations come before the first check, and the checks use only levels already taught
      - One person at most, and a town only if the idea needs it
      - Right after the first explanation, one guess predicts something learners really get wrong, its question never containing its answer and never asking for a calculation the screen before just did; the guess is followed by another explanation or worked example
      - In this lesson about a place, the screens that teach a level show a picture of it, never the same picture twice in a row

      ${SHARED_EXPECTATIONS}
    `,
    expected: { pictures: "some" },
    id: "pt-niveis-ecologicos-beginner",
    userInput: {
      activityTemplates: ACTIVITY_TEMPLATES,
      chapterLessons: [
        {
          canDo: "Reconhecer características compartilhadas pelos seres vivos",
          ideas: [
            "Todo ser vivo é formado por células, unidades que compõem seu corpo e realizam atividades essenciais.",
            "Reprodução é a formação de novos seres vivos a partir de seres vivos anteriores, mas nem todo indivíduo se reproduz.",
          ],
          order: "before",
          title: "Características dos seres vivos",
        },
        {
          canDo: "Relacionar células, tecidos, órgãos e organismos",
          ideas: [
            "A célula é uma pequena unidade viva que compõe os seres vivos; um organismo é um ser vivo inteiro.",
            "Em muitos organismos multicelulares, células organizadas formam tecidos, e diferentes tecidos que trabalham juntos formam órgãos.",
          ],
          order: "before",
          title: "Organização dos organismos",
        },
        ...outlined({
          after: ["Estrutura e função nos seres vivos", "Desafio: Organização da vida"],
        }),
      ],
      chapterTitle: "Organização da vida",
      courseTitle: "Biologia",
      language: "pt",
      lessonCanDo: "Distinguir organismo, população, comunidade e ecossistema",
      lessonDescription:
        "Os níveis ecológicos conectam indivíduos da mesma espécie, comunidades e componentes não vivos.",
      lessonTitle: "Níveis de organização ecológica",
      level: "beginner",
      skills: ["Distinguir níveis de organização ecológica"],
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese, for a curious adult (overview): plain words, no formulas
      - The hook is a scene that asks nothing: one person's money coming in (a monthly salary and an occasional side job), ending on the question the lesson answers, with no options; never a guess whose question already says the answer ("pays every month... which one comes at agreed intervals?")
      - The lesson keeps its nuances on their own screens: a regular income can change in amount and still be regular, regular doesn't mean guaranteed, and how often it comes decides the kind, not the kind of work
      - Income across months is shown with what the app draws (a table or a bar chart over months), and a picture only for a scene to see; no picture of two scenes at once
      - At most two checks or activities before the application, each after the idea it uses was taught
      - Right after the first explanation, one guess predicts something learners really get wrong, its question never containing its answer and never asking for a calculation the screen before just did; the guess is followed by another explanation or worked example
      - The main idea is named after its everyday meaning, with a comparison only if one truly maps, then its precision point (a regular income isn't a guaranteed one)

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-receitas-regulares-overview",
    userInput: {
      activityTemplates: ACTIVITY_TEMPLATES,
      chapterLessons: outlined({
        after: [
          "Despesas recorrentes e ocasionais",
          "Despesas fixas e variáveis",
          "Registro de movimentações",
        ],
      }),
      chapterTitle: "Entradas e saídas de dinheiro",
      courseTitle: "Educação Financeira",
      language: "pt",
      lessonCanDo: "Distinguir receitas regulares de receitas eventuais",
      lessonDescription:
        "Salário, renda de trabalho eventual e outras entradas podem ter frequências diferentes.",
      lessonTitle: "Receitas regulares e eventuais",
      level: "overview",
      skills: ["Identificar receitas"],
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese, for a total beginner in accounting
      - The hook is a scene with nothing to pick or type, ending on the question the lesson answers, about the lesson's main example (who uses a business's accounting and what for (a bank deciding a loan, the owner deciding a price, the tax office)), with a picture only if the scene shows something the learner needs to see
      - A visual only where a beginner would otherwise have to picture something, such as amounts or steps to compare, as a table, chart or template the app draws; a plan whose teaching screens are all text is fine when nothing needs showing
      - Explanation first, with at least two explanations or worked examples before the first check, one new term per screen

      ${SHARED_EXPECTATIONS}
    `,
    expected: { pictures: "any" },
    id: "pt-usuarios-contabilidade-cold-start",
    userInput: {
      activityTemplates: ACTIVITY_TEMPLATES,
      chapterLessons: [
        {
          canDo: "Separar operações da entidade das operações dos proprietários",
          order: "after",
          title: "Entidade contábil",
        },
        {
          canDo: "Reconhecer características de informação contábil útil",
          order: "after",
          title: "Qualidade da informação contábil",
        },
        {
          canDo: "Identificar pressupostos e limites de uma demonstração",
          order: "after",
          title: "Continuidade, estimativas e materialidade",
        },
        {
          canDo: "Localizar normas brasileiras pertinentes a uma questão contábil",
          order: "after",
          title: "Normas contábeis brasileiras",
        },
        {
          canDo: "Reconhecer cuidados com sigilo e documentação contábil",
          order: "after",
          title: "Ética e responsabilidade profissional",
        },
        {
          canDo: "Tomar decisões com as habilidades deste capítulo",
          order: "after",
          title: "Desafio: Informação contábil e responsabilidade",
        },
      ],
      chapterTitle: "Informação contábil e responsabilidade",
      courseTitle: "Contabilidade geral",
      language: "pt",
      lessonCanDo: "Identificar usuários da informação contábil e suas decisões",
      lessonDescription:
        "A contabilidade produz informações para proprietários, credores, governo e outros usuários tomarem decisões.",
      lessonTitle: "Usuários e finalidade da contabilidade",
      level: "beginner",
      skills: ["Identificar usuários da informação contábil"],
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese, for a total beginner in accounting
      - The hook is a scene with nothing to pick or type, ending on the question the lesson answers, about the lesson's main example (a business kept apart from its owner (the shop's cash and the owner's home bill)), with a picture only if the scene shows something the learner needs to see
      - A visual only where a beginner would otherwise have to picture something, such as amounts or steps to compare, as a table, chart or template the app draws; a plan whose teaching screens are all text is fine when nothing needs showing
      - Explanation first, with at least two explanations or worked examples before the first check, one new term per screen

      ${SHARED_EXPECTATIONS}
    `,
    expected: { pictures: "any" },
    id: "pt-entidade-contabil-cold-start",
    userInput: {
      activityTemplates: ACTIVITY_TEMPLATES,
      chapterLessons: [
        {
          canDo: "Identificar usuários da informação contábil e suas decisões",
          order: "before",
          title: "Usuários e finalidade da contabilidade",
        },
        {
          canDo: "Reconhecer características de informação contábil útil",
          order: "after",
          title: "Qualidade da informação contábil",
        },
        {
          canDo: "Identificar pressupostos e limites de uma demonstração",
          order: "after",
          title: "Continuidade, estimativas e materialidade",
        },
        {
          canDo: "Localizar normas brasileiras pertinentes a uma questão contábil",
          order: "after",
          title: "Normas contábeis brasileiras",
        },
        {
          canDo: "Reconhecer cuidados com sigilo e documentação contábil",
          order: "after",
          title: "Ética e responsabilidade profissional",
        },
        {
          canDo: "Tomar decisões com as habilidades deste capítulo",
          order: "after",
          title: "Desafio: Informação contábil e responsabilidade",
        },
      ],
      chapterTitle: "Informação contábil e responsabilidade",
      courseTitle: "Contabilidade geral",
      language: "pt",
      lessonCanDo: "Separar operações da entidade das operações dos proprietários",
      lessonDescription:
        "A entidade é tratada separadamente de seus proprietários, mesmo quando uma pessoa controla o negócio.",
      lessonTitle: "Entidade contábil",
      level: "beginner",
      skills: ["Aplicar a autonomia patrimonial"],
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese, for a total beginner in accounting
      - The hook is a scene with nothing to pick or type, ending on the question the lesson answers, about the lesson's main example (a shop's goods on the shelf, its cash and what customers still owe it), with a picture only if the scene shows something the learner needs to see
      - A visual only where a beginner would otherwise have to picture something, such as amounts or steps to compare, as a table, chart or template the app draws; a plan whose teaching screens are all text is fine when nothing needs showing
      - Explanation first, with at least two explanations or worked examples before the first check, one new term per screen

      ${SHARED_EXPECTATIONS}
    `,
    expected: { pictures: "any" },
    id: "pt-bens-direitos-cold-start",
    userInput: {
      activityTemplates: ACTIVITY_TEMPLATES,
      chapterLessons: [
        {
          canDo: "Identificar obrigações presentes de uma entidade",
          order: "after",
          title: "Obrigações e passivos",
        },
        {
          canDo: "Calcular a participação residual dos proprietários",
          order: "after",
          title: "Patrimônio líquido",
        },
        {
          canDo: "Aplicar a equação patrimonial a valores simples",
          order: "after",
          title: "Equação patrimonial",
        },
        {
          canDo: "Tomar decisões com as habilidades deste capítulo",
          order: "after",
          title: "Desafio: Patrimônio e equação patrimonial",
        },
      ],
      chapterTitle: "Patrimônio e equação patrimonial",
      courseTitle: "Contabilidade geral",
      language: "pt",
      lessonCanDo: "Identificar bens e direitos controlados por uma entidade",
      lessonDescription:
        "Bens e direitos, como mercadorias e valores a receber, podem compor os ativos da entidade.",
      lessonTitle: "Bens, direitos e ativos",
      level: "beginner",
      skills: ["Identificar bens e direitos"],
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese, for a total beginner in accounting
      - The hook is a scene with nothing to pick or type, ending on the question the lesson answers, about the lesson's main example (a business's records side by side: what it has, what it owes and what is left for its owner), with a picture only if the scene shows something the learner needs to see
      - A visual only where a beginner would otherwise have to picture something, such as amounts or steps to compare, as a table, chart or template the app draws; a plan whose teaching screens are all text is fine when nothing needs showing
      - Explanation first, with at least two explanations or worked examples before the first check, one new term per screen

      ${SHARED_EXPECTATIONS}
    `,
    expected: { pictures: "any" },
    id: "pt-equacao-patrimonial-cold-start",
    userInput: {
      activityTemplates: ACTIVITY_TEMPLATES,
      chapterLessons: [
        {
          canDo: "Identificar bens e direitos controlados por uma entidade",
          order: "before",
          title: "Bens, direitos e ativos",
        },
        {
          canDo: "Identificar obrigações presentes de uma entidade",
          order: "before",
          title: "Obrigações e passivos",
        },
        {
          canDo: "Calcular a participação residual dos proprietários",
          order: "before",
          title: "Patrimônio líquido",
        },
        {
          canDo: "Tomar decisões com as habilidades deste capítulo",
          order: "after",
          title: "Desafio: Patrimônio e equação patrimonial",
        },
      ],
      chapterTitle: "Patrimônio e equação patrimonial",
      courseTitle: "Contabilidade geral",
      language: "pt",
      lessonCanDo: "Aplicar a equação patrimonial a valores simples",
      lessonDescription:
        "A igualdade entre ativo e a soma de passivo e patrimônio líquido permite conferir uma posição patrimonial.",
      lessonTitle: "Equação patrimonial",
      level: "beginner",
      skills: ["Aplicar a equação patrimonial"],
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese, for one learner who runs a small bakery
      - The scene opens on the learner's own stock (flour on the shelf, how much the bakery uses each week, how long a delivery takes) with a small table or chart the app draws, its numbers in the brief, and no picture: the lesson is private, so nothing the app draws is replaced by a picture
      - Where the stock's numbers need comparing, a table, a chart or a template to explore (a formula with its sliders for the reorder point) shows them, never a picture standing in for them
      - Right after the first explanation, one guess predicts something about the bakery's stock that beginners get wrong, never a calculation the screen before just did
      - Every check asks only what an earlier screen taught, and money and amounts are written in one format

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-ponto-de-pedido-private",
    userInput: {
      activityTemplates: ACTIVITY_TEMPLATES,
      chapterTitle: "Estoque da doceria",
      courseTitle: "Gestão da Doceria da Marta",
      isPrivate: true,
      language: "pt",
      lessonCanDo: "Decidir quando pedir mais farinha antes de faltar",
      lessonDescription:
        "Quanto de cada ingrediente precisa estar no estoque quando chega a hora de pedir de novo.",
      lessonTitle: "Ponto de pedido",
      level: "beginner",
      skills: ["Calcular o ponto de pedido de um ingrediente"],
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese, for a total beginner organizing the household's money
      ${UNANSWERABLE_GUESS}
      - A regression to avoid: an earlier plan asked which of two offers with the same gross pay leaves more money, one withholding R$ 300 and the other nothing, which its own setup answers

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-renda-bruta-liquida-guess",
    userInput: budgetLesson("pt-renda-bruta-liquida-beginner"),
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese, for a total beginner organizing the household's money
      ${UNANSWERABLE_GUESS}
      - A regression to avoid: an earlier plan gave a salary due on the 20th and a payment due on the 5th and asked how much she could count on by the 10th, which the question's own dates answer

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-fontes-datas-renda-guess",
    userInput: budgetLesson("pt-fontes-datas-renda-beginner"),
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese, for a total beginner organizing the household's money
      ${UNANSWERABLE_GUESS}
      - A regression to avoid: an earlier plan asked which purchase he might "not find yet" in the account statement, where only the right option said "ainda não" and both others said "já debitado"

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-registros-financeiros-guess",
    userInput: budgetLesson("pt-registros-financeiros-beginner"),
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese, for candidates of the exam in EXAMS
      ${UNANSWERABLE_GUESS}
      - The guess's brief gives its question, its options, the right one and the tempting one
      - A regression to avoid (production, 8 Nov 2026): the plan's guess asked how the high origin's advantage changed from period A (10 and 50 of 100 reach the top) to B (25 and 75), with "diminui", "permanece igual" (right) and "aumenta". By the ratio of the shares it falls (5 to 3), by the gap it grows (40 to 50 points), and only by the odds the lesson teaches it stays at 9, while no later screen said why dividing the shares doesn't give the lesson's answer. When the planned guess compares how much one group leads another, no option but the tempting one comes out right under another common measure, and a later brief says why the tempting one's measure doesn't give the lesson's answer

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-mobilidade-guess-other-measure",
    userInput: {
      activityTemplates: ACTIVITY_TEMPLATES,
      chapterLessons: MOBILITY_LESSON.chapterLessons,
      chapterTitle: MOBILITY_LESSON.chapterTitle,
      courseTitle: MOBILITY_LESSON.courseTitle,
      exams: MOBILITY_LESSON.exams,
      language: "pt",
      lessonCanDo: MOBILITY_LESSON.spec.canDo,
      lessonDescription: MOBILITY_LESSON.spec.description,
      lessonTitle: MOBILITY_LESSON.spec.title,
      level: "intermediate",
      skills: ["Distinguir tipos de mobilidade social"],
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese, for a total beginner organizing the household's money
      - The visuals mix kinds, as the idea on each screen needs: sorting expenses into categories is a template to explore or an activity (\`categorize\`), and a picture shows the story's object where seeing it helps (a receipt with items of different kinds); a plan where every visual is a table fails (a regression: an earlier plan used tables for 13 of 17 visuals across this course)
      - Two teaching screens in a row never show tables with the same columns (a regression: an earlier plan showed an item-to-category table on three teaching screens in a row)

      ${SHARED_EXPECTATIONS}
    `,
    expected: { pictures: "any" },
    id: "pt-categorias-despesas-visual-mix",
    userInput: {
      activityTemplates: ACTIVITY_TEMPLATES,
      chapterTitle: "O dinheiro que entra e sai de casa",
      courseTitle: "Orçamento doméstico",
      language: "pt",
      lessonCanDo: "Agrupar despesas em categorias úteis",
      lessonDescription:
        "Aprenda a agrupar despesas por finalidade para enxergar para onde o dinheiro vai.",
      lessonTitle: "Categorias de despesas",
      level: "beginner",
      skills: ["Classificar despesas domésticas"],
    },
  },
  {
    expectations: `
      - MUST be in US English
      - A product lesson: the hook is a task someone wants done in their Next.js app and can't yet (going to another page without a full reload, a menu that links the app's pages), never an everyday moment outside the app
      - Explanations, examples and checks happen in the app: the Link component and the file names, paths and code the docs use
      - The last screen has the learner do it now in their own project (add a link, click it) and asks what they should see when it worked, with wrong options that are what a skipped or mixed-up step would show
      - No release is named: every release the course could move to has the Link component

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-product-nextjs-link",
    userInput: {
      activityTemplates: ACTIVITY_TEMPLATES,
      chapterLessons: outlined({ after: ["Layouts"], before: ["Create your first page"] }),
      chapterTitle: "Build your first pages",
      courseTitle: "Next.js",
      language: "en",
      lessonCanDo: "Link the pages of a Next.js app",
      lessonDescription: "Move between your app's pages with the Link component.",
      lessonTitle: "Link between pages",
      level: "beginner",
      product: {
        brand: "Vercel",
        name: "Next.js",
        release: { name: "Next.js 16", releasedOn: "2025-10-21" },
      },
      skills: ["Link between pages with the Link component"],
    },
  },
  {
    expectations: `
      - MUST be in US English
      - A product lesson: the hook is a shot someone wants to take with their phone and misses, never an everyday moment unrelated to the phone
      - Camera Control is a feature only some models have: the plan says which ones (iPhone 16 and later), and says it where the feature is introduced
      - The last screen has the learner do it now on their phone (open the camera with Camera Control, adjust a setting with it) and asks what they should see on the screen
      - Steps use the names the phone itself shows

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-product-iphone-camera-control",
    userInput: {
      activityTemplates: ACTIVITY_TEMPLATES,
      chapterTitle: "Take better photos",
      courseTitle: "iPhone",
      language: "en",
      lessonCanDo: "Shoot and adjust photos with Camera Control",
      lessonDescription:
        "Open the camera, take photos and change zoom or exposure with Camera Control.",
      lessonTitle: "Camera Control",
      level: "beginner",
      product: {
        brand: "Apple",
        name: "iPhone",
        release: { name: "iPhone 17", releasedOn: "2025-09-19" },
      },
      skills: ["Use Camera Control to shoot and adjust photos"],
    },
  },
];
