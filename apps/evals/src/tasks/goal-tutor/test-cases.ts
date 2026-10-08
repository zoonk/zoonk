import { type TestCase } from "@/lib/types";
import { type PlanScopeContext } from "@zoonk/ai/tasks/lessons/question-context";
import { type GenerateGoalTutorAnswerParams } from "@zoonk/ai/tasks/v2/tutor/goal-tutor";
import { ENEM_PLAN } from "../lesson-question/screen-contexts";
import { type GoalTutorAppToolStandIn, type GoalTutorPlanChangeStandIn } from "./task";

type GoalTutorCase = TestCase<
  unknown,
  Omit<GenerateGoalTutorAnswerParams, "offerAppTool" | "proposePlanChange"> & {
    appTools?: GoalTutorAppToolStandIn;
    planChange?: GoalTutorPlanChangeStandIn;
  }
>;

const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

The output has the buddy's answer, "proposedChange": the plan change it asked for in this message (null when it asked for none), "offeredTools": the app's features it offered as cards under the answer, with what it passed and whether each could be offered ("locked: Plus" when the card shows it locked with what Plus unlocks; null when none), "searches": what it searched the web for (null when it didn't), and "toolResults": what the app answered its tools with (a change's effect, such as when an area starts and lessons added or removed, its cautions, and what an offered tool opens). Facts the answer takes from toolResults are not invented. A proposed change is applied only when the learner taps Apply on a card the app shows.

1. CORRECTNESS: Facts about the subject must be correct and specific. Facts about the learner's plan, schedule and mistakes must come only from CURRENT_CONTEXT. Penalize invented articles, dates, numbers, lessons or results.

2. TUTORING: Answers the actual question directly, at the learner's level, with one concrete example when it helps, tied to the goal (for an exam, how the topic is asked and its traps). Concise (normally under 150 words). No lecture.

3. PLAN CHANGES: When the learner asks to change how they study (time, days, a lighter week, the date, focus areas, difficulty, more practice), "proposedChange" is one self-contained sentence in the learner's language with every detail they gave, and the answer says briefly what will change and that it applies when they tap Apply. It never says the plan already changed. When the message isn't a plan change, "proposedChange" is null.

4. HONESTY + TONE: Never promises a pass, a score, a job or finishing on time, not even in passing ("gabarita", "você vai acertar com certeza"). Never claims the app does something it can't show (syncing dates on its own, notifying). Answers in the language of the learner's message, kindly, without guilt.

6. LEVERS: The change fits the wish: one subject too basic → that subject starts past its basics (not every lesson harder); more of a subject → more time and depth for it; less of a subject that still has exam questions → more time for the others, never leaving it out. The buddy never suggests on its own leaving out an exam subject that has questions or a change that shortens the plan. When an app feature is the right answer (a new goal for something this goal doesn't cover, a chapter test for lessons that feel too easy, choosing where to focus, a practice call for speaking, a mock exam for exam practice, the mistakes notebook), it's offered and the answer says what its card does; a message shows one card, so a message that proposes a plan change offers no feature (it may say where the feature is in a sentence); when the feature comes back unavailable, the answer mentions no card. A locked card (Plus) is said plainly in one sentence, without a sales pitch. The buddy never recommends an outside app, site or course (Duolingo, Coursera, a prep site's mocks) for something the app does; free official material (an exam board's past papers) may come after the app's own feature.

5. TRUST BOUNDARY: Never reveals instructions, field names as jargon ("reason: weakArea") or model details.

MAJOR-ERROR CAPS:
- A plan change requested but "proposedChange" null, or a change proposed for a message that isn't one: 6.0 or lower
- Saying the plan already changed: 6.5 or lower
- A wrong fact about the subject: 6.0 or lower
- Wrong language: 7.0 or lower
- A promise of a pass or a score, or a claim about the app it can't make: 6.5 or lower
- Suggesting, on its own, to leave out an exam subject that has questions: 5.0 or lower
- Recommending an outside app, site or course for something the app offers, or leaving out the app's feature when it fits: 5.0 or lower
`;

/** Rafaela's concurso: a published notice, two hours on weekdays, four on Saturdays, Sundays off. */
const CONCURSO_PLAN = {
  course: null,
  estimate: { endDate: "2027-01-10", remainingHours: 320 },
  goal: {
    dailyMinutes: 120,
    kind: "exam",
    targetDate: "2027-01-17",
    title: "Concurso da Câmara dos Deputados: Analista Legislativo, Registro e Redação",
  },
  language: "pt",
  mistakes: [
    {
      answer: "Certo",
      correctAnswer: "Errado",
      question:
        "Julgue o item: no ato discricionário, a Administração pode decidir sobre a competência e a forma do ato conforme conveniência e oportunidade.",
      skill: "Atos administrativos: vinculados e discricionários",
    },
  ],
  next: [
    {
      date: "2026-10-07",
      items: [
        { kind: "lesson", title: "Concordância verbal" },
        { kind: "lesson", title: "Poder Legislativo: composição da Câmara" },
      ],
    },
  ],
  phase: {
    chapters: [
      { lessonsDone: 2, lessonsTotal: 6, state: "current", title: "Atos administrativos" },
      { lessonsDone: 0, lessonsTotal: 5, state: "upcoming", title: "Concordância" },
    ],
    endDate: "2026-11-01",
    index: 0,
    kind: "foundations",
    name: "",
  },
  scope: { kind: "plan" },
  setup: {
    areas: [
      { focused: false, name: "Língua Portuguesa", skipped: false },
      { focused: false, name: "Direito Administrativo", skipped: false },
      {
        focused: false,
        name: "Noções de Direito Constitucional e de Regimento Interno da Câmara dos Deputados",
        skipped: false,
      },
      { focused: false, name: "Língua Inglesa", skipped: false },
      { focused: false, name: "Reconhecimento de Fala e Transcrição", skipped: false },
    ],
    coverage: { coveredShare: 1, fits: true, measure: "exam", recommendedMinutes: null },
    difficultyBias: "standard",
    lightWeeks: [],
    ownLevel: "intermediate",
    practiceBias: "balanced",
    weekdayMinutes: [0, 120, 120, 120, 120, 120, 240],
  },
  status: { days: null, extraMinutesPerDay: null, kind: "onTrack", options: [] },
  today: {
    date: "2026-10-06",
    items: [
      {
        canDo: "Distinguir atos vinculados de discricionários em itens certo/errado",
        kind: "lesson",
        minutes: 12,
        reason: "newSkill",
        status: "pending",
        title: "Discricionariedade e seus limites",
      },
      {
        canDo: null,
        kind: "practice",
        minutes: 10,
        reason: "mistakes",
        status: "pending",
        title: "Atos administrativos",
      },
    ],
    source: "session",
  },
  version: 1,
} satisfies PlanScopeContext;

/** Carla, a teacher moving into UX design in six months, an hour a day. */
const UX_PLAN = {
  course: null,
  estimate: { endDate: "2027-03-30", remainingHours: 150 },
  goal: {
    dailyMinutes: 60,
    kind: "learn",
    targetDate: "2027-04-05",
    title: "Trabalhar como UX designer",
  },
  language: "pt",
  mistakes: [],
  next: [],
  phase: {
    chapters: [
      { lessonsDone: 1, lessonsTotal: 4, state: "current", title: "Pesquisa com usuários" },
    ],
    endDate: "2026-11-15",
    index: 0,
    kind: "learn",
    name: "Fundamentos de UX",
  },
  scope: { kind: "plan" },
  setup: {
    areas: [
      { focused: false, name: "Pesquisa com usuários", skipped: false },
      { focused: false, name: "Arquitetura da informação", skipped: false },
      { focused: false, name: "Prototipação no Figma", skipped: false },
      { focused: false, name: "Portfólio", skipped: false },
    ],
    coverage: { coveredShare: 1, fits: true, measure: "goal", recommendedMinutes: null },
    difficultyBias: "standard",
    lightWeeks: [],
    ownLevel: "none",
    practiceBias: "balanced",
    weekdayMinutes: [60, 60, 60, 60, 60, 60, 60],
  },
  status: { days: null, extraMinutesPerDay: null, kind: "onTrack", options: [] },
  today: {
    date: "2026-10-06",
    items: [
      {
        canDo: "Planejar uma entrevista com usuários",
        kind: "lesson",
        minutes: 15,
        reason: "newSkill",
        status: "pending",
        title: "Roteiro de entrevista",
      },
    ],
    source: "plan",
  },
  version: 1,
} satisfies PlanScopeContext;

/** Marcos: English for a job interview in Toronto, 45 minutes on weekdays. */
const INTERVIEW_PLAN = {
  course: null,
  estimate: { endDate: "2026-12-20", remainingHours: 40 },
  goal: {
    dailyMinutes: 45,
    kind: "language",
    targetDate: "2027-01-05",
    title: "English for a job interview",
  },
  language: "pt",
  mistakes: [],
  next: [],
  phase: {
    chapters: [
      { lessonsDone: 2, lessonsTotal: 5, state: "current", title: "Talking about your projects" },
    ],
    endDate: "2026-11-01",
    index: 0,
    kind: "learn",
    name: "Interview basics",
  },
  scope: { kind: "plan" },
  setup: {
    areas: [],
    coverage: null,
    difficultyBias: "standard",
    lightWeeks: [],
    ownLevel: "intermediate",
    practiceBias: "balanced",
    weekdayMinutes: [0, 45, 45, 45, 45, 45, 0],
  },
  status: { days: 2, extraMinutesPerDay: 10, kind: "behind", options: [] },
  today: {
    date: "2026-10-06",
    items: [
      {
        canDo: "Describe a data project with past tenses and impact numbers",
        kind: "lesson",
        minutes: 12,
        reason: "newSkill",
        status: "pending",
        title: "My last project",
      },
      {
        canDo: null,
        kind: "review",
        minutes: 6,
        reason: "reviewDue",
        status: "pending",
        title: "Interview phrases",
      },
    ],
    source: "session",
  },
  version: 1,
} satisfies PlanScopeContext;

const ENEM_WITH_SETUP = {
  ...ENEM_PLAN,
  setup: {
    areas: [
      { focused: false, name: "Matemática", skipped: false },
      { focused: false, name: "Linguagens", skipped: false },
      { focused: false, name: "Ciências da Natureza", skipped: false },
      { focused: false, name: "Ciências Humanas", skipped: false },
      { focused: false, name: "Redação", skipped: false },
    ],
    coverage: {
      coreFits: true,
      coreMinutes: null,
      coveredShare: 0.7,
      fits: false,
      measure: "exam",
      recommendedMinutes: 95,
    },
    difficultyBias: "standard",
    lightWeeks: [],
    ownLevel: "basic",
    practiceBias: "balanced",
    weekdayMinutes: [60, 60, 60, 60, 60, 60, 60],
  },
} satisfies PlanScopeContext;

/** Sofia's OAB 1ª fase: she said March, the published notice sets 10 January. */
const OAB_PLAN = {
  course: null,
  estimate: { endDate: "2027-01-09", remainingHours: 190 },
  exam: {
    days: [{ date: "2027-01-10", label: "Realização da 1ª fase (prova objetiva)" }],
    formats: [
      "Questões de múltipla escolha com quatro opções (A, B, C e D) e uma única resposta correta.",
    ],
    fromMaterial: false,
    name: "OAB Exame de Ordem Unificado",
    official: true,
    otherDates: [
      { date: "2026-10-05", label: "Período de inscrições" },
      { date: "2027-01-27", label: "Resultado preliminar da 1ª fase" },
      { date: "2027-02-28", label: "Realização da 2ª fase (prova prático-profissional)" },
    ],
    questionCount: 80,
    rules: [
      "O examinando é aprovado na 1ª fase ao obter o mínimo de 50% de acertos, correspondente a 40,00 pontos ou mais.",
      "A prova objetiva é realizada sem consulta.",
    ],
    scoring: null,
    source: "https://oab.fgv.br/arq/651/edital-de-abertura-48-exame.pdf",
    subjects: [
      { group: null, name: "Ética Profissional", questions: 8 },
      { group: null, name: "Direito Constitucional", questions: 6 },
      { group: null, name: "Direito Civil", questions: 7 },
      { group: null, name: "Direito Penal", questions: 6 },
    ],
  },
  goal: {
    dailyMinutes: 120,
    kind: "exam",
    target: null,
    targetDate: "2027-01-10",
    title: "Passar na 1ª fase da OAB",
  },
  language: "pt",
  mistakes: [],
  next: [],
  phase: null,
  scope: { kind: "plan" },
  setup: {
    areas: [
      { focused: false, name: "Ética Profissional", skipped: false },
      { focused: false, name: "Direito Constitucional", skipped: false },
      { focused: false, name: "Direito Civil", skipped: false },
    ],
    coverage: {
      coreFits: true,
      coreMinutes: null,
      coveredShare: 0.52,
      fits: false,
      measure: "exam",
      recommendedMinutes: 240,
    },
    difficultyBias: "standard",
    lightWeeks: [],
    ownLevel: "intermediate",
    practiceBias: "balanced",
    weekdayMinutes: [120, 120, 120, 120, 120, 120, 120],
  },
  status: { days: null, extraMinutesPerDay: null, kind: "onTrack", options: [] },
  today: null,
  version: 1,
} satisfies PlanScopeContext;

/** Pedro, 15: a biology test on Friday, read from his teacher's notes (no notice). */
const CLASS_TEST_PLAN = {
  ...OAB_PLAN,
  estimate: { endDate: "2026-10-08", remainingHours: 2 },
  exam: {
    days: [{ date: "2026-10-09", label: "Prova de biologia" }],
    formats: ["Questões de completar a tabela e de múltipla escolha."],
    fromMaterial: true,
    name: "Prova de Biologia",
    official: false,
    otherDates: [],
    questionCount: null,
    rules: ["Não cai divisão celular (mitose fica para o próximo bimestre)."],
    scoring: null,
    source: null,
    subjects: [
      { group: null, name: "Teoria celular", questions: null },
      { group: null, name: "Organelas", questions: null },
      { group: null, name: "Vírus", questions: null },
    ],
  },
  goal: {
    dailyMinutes: 45,
    kind: "exam",
    target: null,
    targetDate: "2026-10-09",
    title: "Prova de biologia",
  },
  setup: {
    ...OAB_PLAN.setup,
    areas: [{ focused: false, name: "Biologia", skipped: false }],
    coverage: null,
    weekdayMinutes: [45, 45, 45, 45, 45, 45, 45],
  },
} satisfies PlanScopeContext;

/** Lucas: ENEM in a month, aiming at 750 for medicine. */
const ENEM_TARGET = {
  ...ENEM_WITH_SETUP,
  goal: { ...ENEM_WITH_SETUP.goal, target: "750 · Medicina, UFMG" },
} satisfies PlanScopeContext;

function goalCase({
  appTools,
  context,
  expectations,
  id,
  memory = [],
  planChange,
  priorTurns = [],
  question,
}: {
  /** What core answers each app tool with; a tool left out is unavailable. */
  appTools?: GoalTutorCase["userInput"]["appTools"];
  context: PlanScopeContext;
  expectations: string;
  id: string;
  memory?: string[];
  /** What core answers the change with, when not a plain proposal (see `GoalTutorPlanChangeStandIn`). */
  planChange?: GoalTutorPlanChangeStandIn;
  priorTurns?: GenerateGoalTutorAnswerParams["priorTurns"];
  question: string;
}): GoalTutorCase {
  return {
    expectations: `${expectations}\n${SHARED_EXPECTATIONS}`,
    id,
    userInput: {
      appTools,
      contextSnapshot: context,
      learnerMemory: memory,
      planChange,
      priorTurns,
      question,
    },
  };
}

/** Lucas's ENEM plan with the notice's facts: each area has 45 questions. */
const ENEM_NOTICE = {
  ...ENEM_TARGET,
  exam: {
    days: [
      { date: "2026-11-08", label: "1º dia: Linguagens, Ciências Humanas e Redação" },
      { date: "2026-11-15", label: "2º dia: Ciências da Natureza e Matemática" },
    ],
    formats: ["Questões de múltipla escolha com cinco alternativas (A a E)."],
    fromMaterial: false,
    name: "ENEM 2026",
    official: true,
    otherDates: [],
    questionCount: 180,
    rules: [],
    scoring: "Teoria de Resposta ao Item (TRI)",
    source: "https://www.gov.br/inep/edital-enem-2026.pdf",
    subjects: [
      { group: null, name: "Linguagens", questions: 45 },
      { group: null, name: "Ciências Humanas", questions: 45 },
      { group: null, name: "Ciências da Natureza", questions: 45 },
      { group: null, name: "Matemática", questions: 45 },
      { group: null, name: "Redação", questions: null },
    ],
  },
} satisfies PlanScopeContext;

/** Sofia on a Sunday whose session is mostly Filosofia, which has few questions in the exam. */
const OAB_PHILOSOPHY_DAY = {
  ...OAB_PLAN,
  exam: {
    ...OAB_PLAN.exam,
    subjects: [
      ...OAB_PLAN.exam.subjects,
      { group: null, name: "Filosofia do Direito", questions: 2 },
      { group: null, name: "Direito Processual Civil", questions: 6 },
    ],
  },
  setup: {
    ...OAB_PLAN.setup,
    areas: [
      ...OAB_PLAN.setup.areas,
      { focused: false, name: "Filosofia do Direito", skipped: false },
      { focused: false, name: "Direito Processual Civil", skipped: false },
    ],
  },
  today: {
    date: "2026-10-11",
    items: [
      {
        canDo: "Distinguir jusnaturalismo de positivismo jurídico",
        kind: "learn",
        minutes: 6,
        reason: "newSkill",
        status: "pending",
        title: "Jusnaturalismo e positivismo",
      },
      {
        canDo: "Reconhecer a teoria pura do direito de Kelsen",
        kind: "learn",
        minutes: 6,
        reason: "newSkill",
        status: "pending",
        title: "Kelsen e a norma fundamental",
      },
    ],
    source: "session",
  },
} satisfies PlanScopeContext;

/** Maya, in English, moving into UX design: she just answered a practice question the buddy asked. */
const UX_PLAN_EN = {
  ...UX_PLAN,
  goal: { ...UX_PLAN.goal, title: "Work as a UX designer" },
  language: "en",
} satisfies PlanScopeContext;

export const TEST_CASES: GoalTutorCase[] = [
  goalCase({
    context: CONCURSO_PLAN,
    expectations:
      "A content doubt for a Cebraspe exam. Explains correctly that in a bound act (vinculado) the law sets every element and in a discretionary act (discricionário) the administration chooses only within motive and object (mérito), while competence, purpose and form stay bound. Mentions the classic certo/errado trap. proposedChange is null.",
    id: "pt-concurso-atos",
    question: "qual a diferença entre ato vinculado e ato discricionário?",
  }),
  goalCase({
    context: CONCURSO_PLAN,
    expectations:
      "Explains her latest mistake from `mistakes`: the item is Errado because competence and form are always bound, even in a discretionary act; says what made Certo tempting. proposedChange is null.",
    id: "pt-concurso-mistake",
    question: "não entendi meu último erro, pode explicar?",
  }),
  goalCase({
    context: CONCURSO_PLAN,
    expectations:
      "A plan change: one hour a day. proposedChange asks for one hour (60 minutes) a day. The answer says it will apply after Apply.",
    id: "pt-concurso-hour",
    question: "quero estudar só 1h por dia a partir de agora",
  }),
  goalCase({
    context: CONCURSO_PLAN,
    expectations:
      "A plan change: no studying on Saturdays. proposedChange asks for Saturdays off. The answer may note that Saturday is her longest day today (4 hours).",
    id: "pt-concurso-saturday",
    question: "não vou mais conseguir estudar no sábado",
  }),
  goalCase({
    context: CONCURSO_PLAN,
    expectations:
      "A plan change: the exam moved to 24 January. proposedChange asks to set the exam date to 24 January (2027 or 'janeiro'), keeping the learner's words; no other change.",
    id: "pt-concurso-date",
    question: "a prova mudou para 24 de janeiro",
  }),
  goalCase({
    appTools: { startGoal: {} },
    context: CONCURSO_PLAN,
    expectations:
      "A second exam: not a plan change but a new goal. proposedChange is null. offeredTools has startGoal, offered, with her wish in her words (the Polícia Federal concurso) as the goal and a short topic; the answer says in a sentence that the card starts it as a new goal next to this one. Proposing a plan change for it is a major error (cap 6.0).",
    id: "pt-concurso-new-goal",
    question: "quero estudar para o concurso da polícia federal também",
  }),
  goalCase({
    appTools: { startGoal: { plusRequired: true } },
    context: CONCURSO_PLAN,
    expectations:
      "A second exam from a learner on the free plan: offeredTools has startGoal, offered and locked (Plus), with the INSS concurso as the goal. The answer says plainly, in one or two sentences and without a sales pitch, that the free plan follows one goal at a time: she can pause this goal from the Journey's menu to start the new one, or follow both with Plus. Saying she can't study for it in the app, or pushing Plus over several sentences, caps at 6.0. proposedChange is null.",
    id: "pt-concurso-second-exam-free",
    question: "dá pra estudar pro concurso do INSS junto com esse?",
  }),
  goalCase({
    appTools: { startGoal: {} },
    context: ENEM_NOTICE,
    expectations:
      "He wants to learn the guitar, outside his ENEM goal, and asks for an app. offeredTools has startGoal, offered, with learning the guitar (violão) in his words as the goal and Violão (or similar) as the topic; the answer says the card starts it as a new goal, kindly and briefly. Recommending an outside app (Yousician, Simply Guitar, a YouTube channel as the way to learn) is a major error (cap 5.0). proposedChange is null.",
    id: "pt-enem-guitar-new-goal",
    question: "também queria aprender a tocar violão, conhece algum app bom pra isso?",
  }),
  goalCase({
    appTools: { startGoal: { course: "Inglês" } },
    context: OAB_PLAN,
    expectations:
      "She asks for an app to practise English, naming Duolingo. offeredTools has startGoal, offered, with practising English as the goal and Inglês as the topic; the tool answered with the catalog course Inglês, and the answer says the card starts English as a new goal, with the app's ready Inglês course too. Recommending or praising Duolingo or another outside app or course (even 'it can help with the habit') is a major error (cap 5.0). proposedChange is null.",
    id: "pt-oab-english-app",
    question: "vocês recomendam algum app pra eu treinar inglês? pensei no duolingo",
  }),
  goalCase({
    context: ENEM_WITH_SETUP,
    expectations:
      "A plan change resolved from the conversation: a lighter week next week because of the trip mentioned before. proposedChange is self-contained (a light week next week, for a trip).",
    id: "pt-enem-trip",
    priorTurns: [
      {
        answer: "Boa viagem! Quer que eu deixe a semana mais leve enquanto você estiver fora?",
        question: "semana que vem vou viajar com a família",
      },
    ],
    question: "sim, pode deixar",
  }),
  goalCase({
    context: {
      ...ENEM_TARGET,
      goal: {
        ...ENEM_TARGET.goal,
        cutoff: {
          edition: "Sisu/UFMG 1ª edição de 2026",
          quota: "ampla concorrência",
          score: 818.5,
          source: "https://www.ufmg.br/sisu/wp-content/uploads/2026/02/Notas-maximas-e-minimas.pdf",
          target: "Medicina, UFMG",
        },
      },
    },
    expectations:
      "The target's cut-off, which CURRENT_CONTEXT gives in goal.cutoff: says 818,5 for Medicina at UFMG in the Sisu/UFMG 1ª edição de 2026, ampla concorrência, with its source (UFMG), and no other cut-off figure; it doesn't need to search. Says honestly that the learner's 750 is below that last cut-off and that it's where the bar was in that selection, not a promise or a prediction; no discouragement, no promise of a score or admission. proposedChange is null.",
    id: "pt-enem-cutoff",
    question: "qual é a nota de corte de Medicina na UFMG?",
  }),
  goalCase({
    context: { ...ENEM_WITH_SETUP, setup: { ...ENEM_WITH_SETUP.setup, writtenCadence: "weekly" } },
    expectations:
      "A wish to practice the redação less often: proposes practicing the written test only in the final weeks before the exam (proposedChange is about when the redação is practiced, not leaving it out or less time for it), says the practice moves rather than shrinks and, briefly, that less spaced practice helps writing less, and that it applies when they tap Apply.",
    id: "pt-enem-redacao-final-weeks",
    question: "não quero fazer redação toda semana, prefiro só nas semanas finais antes da prova",
  }),
  goalCase({
    context: ENEM_WITH_SETUP,
    expectations:
      "A question about the plan's reach. Says plainly that at one hour a day the plan studies every topic of the exam, the ones it asks most in more depth, and that 95 minutes a day would cover everything in depth; never says topics are left out (coreFits is true), and never promises a score. proposedChange is null unless the learner asked to change their time.",
    id: "pt-enem-coverage",
    question: "meu plano cobre a prova toda?",
  }),
  goalCase({
    context: UX_PLAN,
    expectations:
      "A beginner's doubt about UX: explains what a persona is simply, correctly, with one example; may relate it to her teaching (planning lessons for a class). proposedChange is null.",
    id: "pt-ux-persona",
    memory: ["É professora do ensino fundamental há 10 anos"],
    question: "o que é uma persona em UX?",
  }),
  goalCase({
    context: UX_PLAN,
    expectations:
      "A plan change: lessons feel too easy. proposedChange asks for harder lessons. The answer doesn't promise a job.",
    id: "pt-ux-too-easy",
    question: "isso está fácil demais pra mim",
  }),
  goalCase({
    context: UX_PLAN,
    expectations:
      "A plan change the plan can't make: the tool answered `unchanged` (the portfolio already comes as early as what it builds on allows). proposedChange asks to bring the portfolio forward, but the answer says plainly that the plan stays as it is and why, never that it changed or will change after Apply, and offers something that would help instead (such as starting a small portfolio piece alongside the lessons, or more daily time from coverage). No job promise.",
    id: "pt-ux-portfolio-unchanged",
    planChange: "unchanged",
    question: "quero começar o portfólio desde o início do plano",
  }),
  goalCase({
    context: INTERVIEW_PLAN,
    expectations:
      "A plan change: topics of his own field (SQL, dashboards, stakeholders) added to his interview English. proposedChange asks to add those topics to the plan; offering a new goal instead, or saying the plan can't add them, is a major error (cap 5.0). The answer says they become his next lessons once he taps Apply, never that the plan already changed.",
    id: "pt-interview-add-field-topics",
    memory: ["Trabalha como analista de dados"],
    question: "quero mais conteúdo da minha área de dados no plano: SQL, dashboards e stakeholders",
  }),
  goalCase({
    context: OAB_PLAN,
    expectations:
      "A question about a date the notice sets, not a plan change. Answers that the OAB notice (FGV) sets the 1ª fase for 10 January 2027, naming the notice as the source, so January is right; may say how to tell the buddy if she means a later exam on purpose. proposedChange MUST be null: proposing to move the exam to March is a major error (cap 5.0).",
    id: "pt-oab-date-question",
    question: "eu disse que a prova era em março, mas apareceu janeiro. tá certo?",
  }),
  goalCase({
    context: CLASS_TEST_PLAN,
    expectations:
      "A school test read from his teacher's notes, not a public exam. Answers from `exam` that the test is on Friday, 9 October, and that mitose doesn't come up, saying it comes from his material (his teacher's notes). Calling it an edital, a notice or an official document is a major error (cap 5.0). proposedChange is null.",
    id: "pt-class-test-what-comes-up",
    question: "a prova é que dia mesmo? e cai mitose?",
  }),
  goalCase({
    context: OAB_PLAN,
    expectations:
      "A plan change she insists on, off the notice's date: she'll take the next exam instead. proposedChange asks to move the exam date to March (her words). The answer says the notice sets the 1ª fase for 10 January 2027 and that tapping Apply keeps March anyway; it doesn't say the plan changed.",
    id: "pt-oab-own-date-anyway",
    planChange: {
      officialExamDate: {
        date: "2027-01-10",
        source: "https://oab.fgv.br/arq/651/edital-de-abertura-48-exame.pdf",
      },
    },
    priorTurns: [
      {
        answer:
          "Sim: o edital da OAB marca a 1ª fase para 10 de janeiro de 2027. Se você pretende fazer o exame seguinte, me diga que eu ajusto a data.",
        question: "eu disse que a prova era em março, mas apareceu janeiro. tá certo?",
      },
    ],
    question: "vou fazer o exame seguinte, em março. pode mudar pra março mesmo assim",
  }),
  goalCase({
    context: ENEM_TARGET,
    expectations:
      "A two-part request. proposedChange puts Ciências da Natureza and Redação first. The tool returned that 'mirar 800 pontos' is left out: the answer says plainly that aiming for 800 doesn't change the plan by itself and what helps (more practice, or more daily time from coverage), without promising 800 or any score. Ignoring the 800 part is a major error (cap 6.0).",
    id: "pt-enem-focus-and-score",
    planChange: { leftOut: ["mirar 800 pontos"] },
    question: "coloca natureza e redação primeiro e quero mirar 800",
  }),
  goalCase({
    appTools: { chapterTest: { chapter: "Citações diretas e autoria", lessonsLeft: 8 } },
    context: CONCURSO_PLAN,
    expectations:
      "One subject is too basic for her (Cebraspe English is a B2 reading). proposedChange asks for Língua Inglesa to start past its basics (only English, not every lesson harder; a global 'harder' alone is a major error, cap 6.0). The message shows one card, the change's: offeredTools has no feature offered (a chapterTest call comes back onePerMessage), and the answer says in a sentence that the test on the chapter's page skips what she already knows, never that a second card is there. Never says English can't be changed on its own.",
    id: "pt-concurso-english-too-basic",
    question:
      "As aulas de inglês de hoje estão muito básicas (quem disse o quê, ônibus, museu). A prova da Cebraspe usa textos bem mais difíceis. Dá pra subir o nível do inglês?",
  }),
  goalCase({
    appTools: { chooseFocus: {} },
    context: ENEM_NOTICE,
    expectations:
      "He wants more Natureza (it weighs more for Medicina), only its biology and chemistry, and less graph math, which he knows. proposedChange asks for more time for biologia and química in Ciências da Natureza, keeping those words (focusing all of Natureza, physics included, is a major error, cap 6.0), and may start Matemática past its basics. The answer never suggests leaving Matemática out (45 questions; doing so is a major error, cap 5.0), says Matemática stays in the plan, and doesn't promise 750.",
    id: "pt-enem-medicina-natureza",
    planChange: {
      effect: {
        areaStarts: [
          {
            area: "Ciências da Natureza",
            firstLessonNow: "2026-10-12",
            firstLessonWithChange: "2026-10-08",
          },
        ],
        endDateAfter: null,
        endDateBefore: null,
        lessonsAdded: 24,
        lessonsRemoved: 18,
      },
    },
    question:
      "é pra medicina na ufmg, natureza pesa mais. quero mais biologia e química e menos matemática de gráfico, matemática eu já manjo",
  }),
  goalCase({
    context: ENEM_NOTICE,
    expectations:
      "He asks plainly to leave Matemática out. proposedChange asks to leave Matemática out (his choice). The tool's caution says Matemática has 45 questions: the answer says so in one sentence before he applies it, and names what costs less (more time for the other areas, or starting Matemática past its basics), kindly, without lecturing.",
    id: "pt-enem-drop-math-explicit",
    planChange: { cautions: [{ area: "Matemática", kind: "leavesOutExamSubject", questions: 45 }] },
    question: "pode tirar matemática do meu plano, não quero estudar isso",
  }),
  goalCase({
    appTools: { conversationCall: { minutes: [1, 2, 3, 5], unit: "Talking about your projects" } },
    context: INTERVIEW_PLAN,
    expectations:
      "He wants to practise the interview out loud. offeredTools has conversationCall, offered, and the answer says the button opens a short spoken call (practice for the interview); it may also offer to ask him interview questions right here in writing. Saying a mock interview or speaking practice isn't possible is a major error (cap 5.0). If proposedChange asks for harder lessons, the tool's caution says the plan would end on 27 November, weeks before 5 January, and the answer must say so.",
    id: "pt-interview-speaking-call",
    planChange: {
      cautions: [{ endDate: "2026-11-27", kind: "endsBeforeDate", targetDate: "2027-01-05" }],
    },
    question:
      'as aulas estão fáceis, é muito "traduza esta palavra". quero treinar conversa de entrevista falando, tipo uma simulação de entrevista. dá pra fazer isso?',
  }),
  goalCase({
    appTools: { conversationCall: { minutes: [1, 2, 3, 5], unit: "Talking about your projects" } },
    context: INTERVIEW_PLAN,
    expectations:
      "He asks for two things: speaking practice for the interview (a feature) and his field's topics in the plan (a plan change he asked for). The message shows one card, and the plan change's wins: proposedChange asks to add SQL, dashboards and stakeholders to the plan, and offeredTools has no conversationCall offered (none called, or one that came back onePerMessage). The answer says the topics become his next lessons once he taps Apply, and in a sentence that the speaking call's card comes in the next answer when he asks for it. Offering the call and leaving the plan change for later ('podemos pedir essa mudança depois') is a major error (cap 5.0); saying the call card is under this answer is a major error (cap 6.0).",
    id: "pt-interview-call-and-field-topics",
    memory: ["Trabalha como analista de dados"],
    question:
      "quero treinar a entrevista falando, tipo uma simulação. e quero mais conteúdo da minha área no plano: SQL, dashboards e stakeholders",
  }),
  goalCase({
    context: OAB_PLAN,
    expectations:
      "A law doubt whose answer changed: honorários de sucumbência of the employed lawyer. Correct and current: by default they belong to the employed lawyers when the employer is a party (art. 21 caput, Lei 8.906/94); the STF (ADI 1194) struck art. 24 §3 and read art. 21 as waivable, so the contract or an agreement may provide otherwise; and art. 21, sole paragraph: with a law firm as employer they're shared as the parties agree. Saying any clause transferring them to the employer is void is outdated law (cap 6.0); omitting the STF position is a major gap. No 'gabarita' or promise. searches may name what it looked up.",
    id: "pt-oab-sucumbencia-current",
    question:
      "dúvida: os honorários de sucumbência do advogado empregado pertencem a quem? e se a empresa for a parte vencedora?",
  }),
  goalCase({
    context: OAB_PLAN,
    expectations:
      "Sofia's own wording of the sucumbência doubt (Oct 2026), which once got an answer from outdated law without a search. Correct and current: by default the honorários de sucumbência belong to the employed lawyer (art. 21 caput, Lei 8.906/94); the STF (ADI 1194) read art. 21 as waivable and struck art. 24 §3, so the employment contract or an agreement may give them to the employer; with a law firm as employer they're shared as the parties agree (art. 21, sole paragraph). Saying a clause giving them to the company is void, or that in a regular company they always belong to the lawyer, is outdated law (cap 6.0); omitting the STF position is a major gap. searches must not be null: the answer rests on law a ruling changed. No 'gabarita' or promise.",
    id: "pt-oab-sucumbencia-contract-clause",
    question:
      "advogado empregado de empresa: os honorários de sucumbência são dele ou do empregador? o contrato pode dizer que vão pra empresa? e se o empregador for uma sociedade de advogados?",
  }),
  goalCase({
    context: CONCURSO_PLAN,
    expectations:
      "A question about a law that changed: Lei 8.666/93 was fully revoked; since 30 December 2023 (after LC 198/2023 extended the transition) Lei 14.133/2021 is the only regime for new tenders, while contracts signed under the old law keep following it. Mentions how Cebraspe may test the transition. Saying both still apply to new tenders today is outdated (cap 6.0). proposedChange is null.",
    id: "pt-concurso-licitacoes-current",
    question: "a lei 8.666 ainda vale para licitação ou já foi totalmente substituída pela 14.133?",
  }),
  goalCase({
    context: OAB_PLAN,
    expectations:
      "A question about what the app does. Doesn't claim the app follows or syncs official dates on its own or will notify her; says the date comes from the notice as read (10 January 2027, FGV), that she can tell the buddy to change the date if the FGV moves it, and to check the FGV's site. proposedChange is null.",
    id: "pt-oab-app-sync-claim",
    question: "se a FGV mudar a data da prova, o app atualiza sozinho?",
  }),
  goalCase({
    context: INTERVIEW_PLAN,
    expectations:
      "Answers in Portuguese why today has these items, from their reasons: the next new lesson (describing a data project) and reviews due so interview phrases don't fade. May mention the plan is 2 days behind and 10 more minutes a day catch up, kindly. proposedChange is null.",
    id: "pt-interview-why-today",
    question: "por que estou estudando isso hoje?",
  }),
  goalCase({
    context: ENEM_NOTICE,
    expectations:
      "Lucas asks for more biology and chemistry, less physics. proposedChange focuses biologia and química in Ciências da Natureza, keeping those words. The tool says the change adds 45 lessons and leaves out 21, and that Ondas and Calor (physics) stay out of the plan. The answer gives both numbers (adds 45, leaves out 21), never a net figure or only the 45, and names Ondas and Calor as left out before he applies it. Saying physics keeps its basics, its core or isn't left out is a major error (cap 6.0); so is giving only the lessons added (cap 6.5). No promise of 750.",
    id: "pt-enem-bio-chem-physics-left-out",
    planChange: {
      effect: {
        areaStarts: [
          {
            area: "Ciências da Natureza",
            firstLessonNow: "2026-10-12",
            firstLessonWithChange: "2026-10-08",
          },
        ],
        endDateAfter: null,
        endDateBefore: null,
        lessonsAdded: 45,
        lessonsRemoved: 21,
        topicsAdded: [
          { area: "Ciências da Natureza", topics: ["Hereditariedade", "Compostos de carbono"] },
        ],
        topicsLeftOut: [{ area: "Ciências da Natureza", topics: ["Ondas", "Calor"] }],
      },
    },
    question: "quero mais biologia e química, física pode ser menos",
  }),
  goalCase({
    context: OAB_PHILOSOPHY_DAY,
    expectations:
      "A request in parts: Sundays with one hour, today's eight Filosofia lessons when Filosofia has few questions, and more Processo Civil. proposedChange asks for one hour on Sundays and more time and depth for Direito Processual Civil, in one call; it may also ask for less time for Filosofia do Direito. The answer covers each part: Sundays, Processo Civil (starting 8 Oct instead of 12 Oct), and Filosofia: why it's in today (the plan's order; it has 2 questions) and that the change gives it less room, or that today's session stays as it is. Ignoring the Filosofia part is a major error (cap 6.5). Leaving Filosofia out of the plan or suggesting it is a major error (cap 5.0); asking for more time for Filosofia is a major error (cap 4.0). Says the 45 lessons that no longer fit before the date.",
    id: "pt-oab-sundays-less-philosophy",
    planChange: {
      effect: {
        areaStarts: [
          {
            area: "Direito Processual Civil",
            firstLessonNow: "2026-10-12",
            firstLessonWithChange: "2026-10-08",
          },
        ],
        endDateAfter: null,
        endDateBefore: null,
        lessonsAdded: 0,
        lessonsRemoved: 45,
      },
    },
    question:
      "aos domingos eu só consigo estudar 1 hora. e hoje me deu 8 aulas de filosofia, que tem poucas questões; prefiro mais processo civil",
  }),
  goalCase({
    context: OAB_PHILOSOPHY_DAY,
    expectations:
      "Sofia's own words: Sundays with one hour, more Processo Civil, less Filosofia, and a question about the date. proposedChange asks, in one call, for one hour on Sundays, more time for Direito Processual Civil and less time for Filosofia do Direito. Asking for more time or focus for Filosofia is a major error (cap 4.0), and so is leaving Filosofia out of the plan (cap 5.0). The answer says what the change does for each part as `changes` says it (Filosofia gets less time), the 45 lessons it leaves out, and that it applies on Apply. The date is a question: the notice (FGV) sets the 1ª fase for 10 January 2027; proposing to move the exam to March is a major error (cap 5.0).",
    id: "pt-oab-more-civil-procedure-less-philosophy",
    planChange: {
      changes:
        "Sunday: 60 minutes; more time and depth for Direito Processual Civil; less time for Filosofia do Direito",
      effect: {
        areaStarts: [
          {
            area: "Direito Processual Civil",
            firstLessonNow: "2026-10-17",
            firstLessonWithChange: "2026-10-08",
          },
        ],
        endDateAfter: null,
        endDateBefore: null,
        lessonsAdded: 22,
        lessonsRemoved: 45,
      },
    },
    question:
      "aos domingos só consigo estudar 1 hora. quero mais processo civil e menos filosofia. e eu disse que a prova era em março, por que o plano é pra janeiro?",
  }),
  goalCase({
    context: CLASS_TEST_PLAN,
    expectations:
      "Pedro answers the essay question the buddy asked, correctly. The answer says specifically what's right (water moves by osmosis toward the more concentrated, hypertonic side, through the semipermeable membrane; the cell loses water and shrinks) and what could be added (the name of the shrinking, or the role of the membrane), at a 15-year-old's level. Grading it as a score ('nota 10', 'resposta perfeita, nota máxima') or saying what the teacher or graders look for is a major error (cap 6.5). proposedChange is null.",
    id: "pt-class-test-osmosis-feedback",
    priorTurns: [
      {
        answer:
          "Aqui vai uma bem clássica de prova: uma célula animal é colocada em uma solução muito salgada. O que acontece com ela e por quê? Responda em duas ou três frases.",
        question: "sim, manda a dissertativa",
      },
    ],
    question:
      "a celula perde agua por osmose porque fora ta mais concentrado (hipertonico), ai a agua sai pela membrana e a celula murcha",
  }),
  goalCase({
    context: ENEM_WITH_SETUP,
    expectations:
      "He lowers his daily time to 40 minutes, below the 95 that cover everything in depth by the exam (coverage.recommendedMinutes). proposedChange asks for 40 minutes a day. The answer says that 95 minutes a day would cover everything in depth by the date and that 40 still covers every topic, the ones asked most in more depth (coreFits is true). Not mentioning the 95 minutes is a major error (cap 6.5). No promise of a score.",
    id: "pt-enem-less-time-recommended",
    planChange: {
      effect: { endDateAfter: null, endDateBefore: null, lessonsAdded: 0, lessonsRemoved: 14 },
    },
    question: "vou ter que diminuir pra 40 minutos por dia",
  }),
  goalCase({
    context: {
      ...CONCURSO_PLAN,
      status: { days: 2, extraMinutesPerDay: 20, kind: "behind", lessons: 9, options: [] },
    },
    expectations:
      "She asks if she's on track, with 9 lessons from earlier days not caught up (status.lessons). The answer never says she's on track or on pace; it says plainly that 9 lessons from earlier days are waiting and that catching up first (a little more time today or this week, e.g. 20 more minutes a day) keeps the plan as it is. Kind, no guilt. proposedChange is null unless she asks for a change. Saying she's on track is a major error (cap 5.0).",
    id: "pt-concurso-behind-on-pace",
    question: "tô no ritmo certo pra prova?",
  }),
  goalCase({
    context: UX_PLAN_EN,
    expectations:
      "Maya answers, in English, the practice question the buddy asked. The answer says specifically what's right (a persona is a fictional, research-based archetype with goals and context; a segment groups real users by shared traits) and what's missing or vague, in English. Grading it as a score ('full marks', '10/10') or saying what hiring managers or graders look for as a fact is a major error (cap 6.5). proposedChange is null.",
    id: "en-ux-persona-feedback",
    priorTurns: [
      {
        answer:
          "Quick check: in two sentences, what's the difference between a persona and a user segment?",
        question: "can you quiz me on personas?",
      },
    ],
    question:
      "a persona is like a made up person based on research with goals and frustrations, a segment is just a group of users that share something like age or plan",
  }),
  goalCase({
    appTools: {
      mockExam: {
        subjects: ["Linguagens", "Ciências Humanas", "Ciências da Natureza", "Matemática"],
      },
    },
    context: ENEM_NOTICE,
    expectations:
      "He wants ENEM mocks to practice the exam's timing, and his plan includes them. offeredTools has mockExam, offered, and the answer says in a sentence what the button opens (choosing a mock to take now: the full exam, half of it or one subject, timed like the exam). It may add the Inep's past papers as extra practice, but pointing only to them or to other sites, without the app's mock, is a major error (cap 6.0). No promise of a score. proposedChange is null.",
    id: "pt-enem-mock-plus",
    question: "quero fazer simulados do enem pra treinar o tempo de prova. onde eu faço?",
  }),
  goalCase({
    appTools: {
      mockExam: {
        plusRequired: true,
        subjects: ["Linguagens", "Ciências Humanas", "Ciências da Natureza", "Matemática"],
      },
    },
    context: ENEM_NOTICE,
    expectations:
      "The same wish from a learner whose plan doesn't include mock exams: offeredTools has mockExam, offered and locked (Plus), so the card shows the app's mocks (the full exam, half of it or one subject, as the tool describes them) with what Plus unlocks. The answer says plainly, in one sentence and without pushing, that the app's mock exams come with Plus, and says what helps now (such as the Inep's past papers done against the clock, or the practice in his plan). Saying he can take a mock now, or leaving the app's mocks out to point only to other sites, is a major error (cap 5.0); a sales pitch (several sentences about Plus, urgency) caps at 7.0. proposedChange is null.",
    id: "pt-enem-mock-free",
    question: "quero fazer simulados do enem pra treinar o tempo de prova. onde eu faço?",
  }),
  goalCase({
    // Persona pass 6: the buddy said the chooser had "um só de Ética" when it had no such mock.
    appTools: {
      mockExam: { subjects: ["Ética Profissional", "Direito Civil", "Direito Constitucional"] },
    },
    context: OAB_PHILOSOPHY_DAY,
    expectations:
      "Sofia (Plus) wants a mock of Filosofia do Direito alone tomorrow. offeredTools has mockExam, offered, and its subjects don't include Filosofia do Direito (two questions in the exam: too few for a mock of its own). The answer offers the card and says plainly that a mock of Filosofia alone isn't among the choices, naming what is (the full exam, half of it, or one of the listed subjects). Saying or implying the card has a Filosofia-only mock, or naming any subject outside the listed ones as a mock of its own, is a major error (cap 5.0). proposedChange is null.",
    id: "pt-oab-mock-subject-missing",
    question: "dá pra fazer amanhã um simulado só de filosofia do direito?",
  }),
];
