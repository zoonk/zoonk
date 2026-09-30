import { daysFrom } from "../../_utils/dates";
import { englishCourse } from "../../library/english/english-course";
import { type SeedLearner } from "../types";
import { marcosLanguageHistory } from "./marcos-language-history";

/** About five months until the move, as the onboarding mockup has it. */
const MOVE_IN_DAYS = 160;

/**
 * A language goal in Focus: English for a move to Toronto, 25 minutes a day, A2 toward B1+. He
 * finished the arrival unit and is in the middle of renting an apartment.
 */
const marcos: SeedLearner = {
  attempts: [
    {
      answer: { selectedWords: ["many"] },
      day: -1,
      isCorrect: false,
      key: "how-many-deposit",
      mistake: {
        cause: "gap",
        snapshot: {
          answer: "How many is the deposit?",
          correctAnswer: "How much is the deposit?",
          explanation: "A caução é um preço, então é how much.",
          format: "fillBlank",
          misconception: "Usou how many para preço",
          question: "How [BLANK] is the deposit?",
        },
        status: "fixed",
      },
      seconds: 18,
      skill: "ask-rent",
      step: { lesson: "how-much-is-the-rent", position: 6 },
    },
    {
      answer: { selectedOptionId: "extra" },
      day: -1,
      isCorrect: true,
      key: "utilities-extra",
      seconds: 25,
      skill: "rental-words",
      step: { lesson: "how-much-is-the-rent", position: 10 },
    },
    {
      answer: { selectedIndex: 1 },
      day: -1,
      isCorrect: false,
      item: "first-last-rent",
      key: "first-last-rent",
      mistake: {
        cause: "misread",
        snapshot: {
          answer: "Só o aluguel do primeiro mês",
          correctAnswer: "O primeiro e o último mês de aluguel, pagos adiantado",
          explanation:
            "“Last month's rent” é o aluguel do último mês, pago adiantado junto com o primeiro.",
          format: "multipleChoice",
          misconception: "Ignorou o “last month's rent”",
          question:
            "The landlord asked for first and last month's rent. O que o proprietário pediu?",
        },
        status: "open",
      },
      seconds: 31,
      skill: "rental-words",
    },
    {
      answer: { selectedIndex: 0 },
      day: 0,
      inSession: true,
      isCorrect: true,
      item: "ask-deposit-choice",
      key: "review-deposit",
      seconds: 12,
      skill: "ask-rent",
    },
  ],
  brainPower: 2180,
  email: "v2-language@zoonk.test",
  feedback: [{ kind: "lesson", lesson: "how-much-is-the-rent", vote: "up" }],
  goal: {
    course: englishCourse,
    createdDay: -28,
    dailyMinutes: 25,
    details: {
      level: "A2",
      reason: "Mudança para Toronto com a esposa",
      skillLevels: { listening: "A2", reading: "B1", speaking: "A2", writing: "A2" },
      targetLevel: "B1+",
    },
    key: "toronto",
    kind: "language",
    plan: {
      items: [
        { day: -26, kind: "lesson", lesson: "at-immigration", phase: 0, status: "done" },
        { day: -20, kind: "lesson", lesson: "finding-your-way", phase: 0, status: "done" },
        {
          day: -9,
          kind: "boss",
          phase: 0,
          status: "done",
          title: "Conversa: passando pela imigração",
        },
        { day: -1, kind: "lesson", lesson: "how-much-is-the-rent", phase: 1, status: "done" },
        { day: 0, kind: "lesson", lesson: "there-is-there-are", phase: 1, status: "todo" },
        { day: 2, kind: "lesson", lesson: "book-a-viewing", phase: 1, status: "todo" },
        { day: 5, kind: "lesson", lesson: "reading-the-lease", phase: 1, status: "todo" },
        { chapter: "bank-phone", kind: "chapter", phase: 2, status: "todo" },
        { chapter: "first-week-at-work", kind: "chapter", phase: 3, status: "todo" },
        { chapter: "doctor-pharmacy", kind: "chapter", phase: 4, status: "todo" },
        { chapter: "social-life", kind: "chapter", phase: 5, status: "todo" },
      ],
      phases: [
        { name: "Chegando: aeroporto e imigração" },
        { name: "Alugando um apartamento" },
        { name: "Banco e celular" },
        { name: "Primeira semana no trabalho" },
        { name: "Médico e farmácia" },
        { name: "Vida social" },
      ],
      skillLessons: {
        "apartment-rooms": 15,
        "ask-rent": 20,
        "book-viewing": 20,
        "describe-symptoms": 40,
        "follow-meeting": 50,
        "introduce-at-work": 40,
        "lease-terms": 20,
        "make-plans": 40,
        "open-account": 30,
        pharmacy: 30,
        "phone-plan": 25,
        "rental-words": 25,
        "small-talk": 50,
        "there-is-are": 20,
      },
    },
    prompt: "i need to speak english, moving to toronto in 6 months with my wife. i think i'm A2",
    studyTime: "07:00",
    title: "Inglês para Toronto",
  },
  history: { accuracy: 0.78, days: 28, energy: 81, minutesPerDay: 24, skipChance: 0.2 },
  key: "marcos",
  language: "pt",
  languageHistory: marcosLanguageHistory,
  memory: [
    {
      category: "goals",
      origin: "said",
      statement: "Vai se mudar para Toronto em março com a esposa",
    },
    { category: "background", origin: "said", statement: "Trabalha com TI" },
    { category: "routine", origin: "said", statement: "Estuda às 7h, antes do trabalho" },
    { category: "learning", origin: "noticed", statement: "Lê melhor do que fala" },
  ],
  milestones: [],
  mode: "focus",
  name: "Marcos Oliveira",
  session: {
    blocks: [
      {
        brainPower: 20,
        capsules: [
          {
            items: ["ask-deposit-choice"],
            lesson: "how-much-is-the-rent",
            skills: ["ask-rent", "rental-words"],
            title: "Quanto é o aluguel?",
          },
        ],
        kind: "review",
        minutes: 5,
        status: "completed",
      },
      { kind: "learn", lesson: "there-is-there-are", minutes: 8, status: "pending" },
      {
        drills: [{ items: ["first-last-rent"], mistake: "first-last-rent" }],
        kind: "practice",
        minutes: 5,
        status: "pending",
        title: "Corrigir um erro",
      },
    ],
    status: "active",
  },
  skills: [
    { memory: "solid", skill: "explain-visit" },
    { memory: "mastered", skill: "airport-directions" },
    { memory: "learning", skill: "ask-rent" },
    { memory: "learning", skill: "rental-words" },
  ],
  timeZone: "America/Sao_Paulo",
  username: "marcos_toronto",
};

/** The move stays about five months ahead of whenever the seed runs. */
export function buildMarcos({ now }: { now: Date }): SeedLearner {
  return { ...marcos, goal: { ...marcos.goal, targetDate: daysFrom(now, MOVE_IN_DAYS) } };
}
