import { physicsCourse } from "../../library/physics/physics-course";
import { type SeedLearner } from "../types";

/**
 * A learner with a grown buddy: Otto the octopus, wearing the Star glasses from his first boss, after
 * two Trickster checkpoints. Lucas wants the ideas of quantum physics without the math, 15 minutes a
 * night.
 */
export const lucasBuddy: SeedLearner = {
  attempts: [
    {
      answer: { isTrue: true },
      day: 0,
      inSession: true,
      isCorrect: true,
      item: "color-wavelength",
      key: "review-color",
      seconds: 7,
      skill: "light-wave",
    },
    {
      answer: { isTrue: true },
      day: -4,
      isCorrect: false,
      item: "photon-brightness",
      key: "brighter-photons",
      mistake: {
        cause: "gap",
        snapshot: {
          answer: "Verdadeiro",
          correctAnswer: "Falso",
          explanation: "Uma luz mais forte tem mais fótons, não fótons mais fortes.",
          format: "trueFalse",
          misconception: "Acha que o brilho define a energia do fóton",
          question: "Uma luz vermelha mais forte é feita de fótons com mais energia cada um.",
        },
        status: "open",
      },
      seconds: 12,
      skill: "photon",
    },
  ],
  brainPower: 310,
  buddy: { glasses: "star", kind: "otto", name: "Otto" },
  email: "v2-buddy@zoonk.test",
  feedback: [],
  goal: {
    course: physicsCourse,
    createdDay: -18,
    dailyMinutes: 15,
    details: { level: "nada ainda", purpose: "overview" },
    key: "quantum-overview",
    kind: "learn",
    plan: {
      items: [
        { day: -18, kind: "lesson", lesson: "how-small-is-an-atom", phase: 0, status: "done" },
        { day: -16, kind: "lesson", lesson: "rules-change-when-small", phase: 0, status: "done" },
        {
          day: -13,
          kind: "boss",
          phase: 0,
          status: "done",
          title: "Desafio: Um mundo muito pequeno",
        },
        { day: -11, kind: "lesson", lesson: "light-as-wave", phase: 1, status: "done" },
        { day: -9, kind: "lesson", lesson: "light-comes-in-packets", phase: 1, status: "done" },
        { day: -7, kind: "lesson", lesson: "double-slit", phase: 1, status: "done" },
        { day: -4, kind: "boss", phase: 1, status: "done", title: "Duelo com o Trapaceiro" },
        { day: -1, kind: "lesson", lesson: "almost-empty-atom", phase: 2, status: "done" },
        { day: 0, kind: "lesson", lesson: "electron-cloud", phase: 2, status: "todo" },
        { day: 1, kind: "lesson", lesson: "confined-jittery", phase: 2, status: "todo" },
        { day: 2, kind: "lesson", lesson: "why-colors-exist", phase: 2, status: "todo" },
        { chapter: "uncertainty", kind: "chapter", phase: 3, status: "todo" },
        { chapter: "entanglement", kind: "chapter", phase: 4, status: "todo" },
        { chapter: "in-your-phone", kind: "chapter", phase: 5, status: "todo" },
      ],
      phases: [
        { name: "Um mundo muito pequeno" },
        { name: "Luz: onda ou partícula?" },
        { name: "Dentro do átomo" },
        { name: "Incerteza" },
        { name: "Emaranhamento" },
        { name: "O quântico no seu celular" },
      ],
    },
    prompt: "quero entender física quântica sem precisar fazer conta",
    studyTime: "21:00",
    title: "Entender física quântica",
  },
  history: {
    accuracy: 0.8,
    checkpoints: [
      { correct: 8, day: -13, title: "Desafio: Um mundo muito pequeno", total: 10 },
      { correct: 7, day: -4, title: "Duelo com o Trapaceiro", total: 10 },
    ],
    days: 18,
    energy: 68,
    minutesPerDay: 14,
    skipChance: 0.25,
  },
  key: "lucas",
  language: "pt",
  memory: [
    { category: "preferences", origin: "said", statement: "Prefere explicações sem contas" },
    { category: "preferences", origin: "said", statement: "Gosta de ficção científica" },
    { category: "routine", origin: "said", statement: "Estuda à noite, antes de dormir" },
  ],
  milestones: [
    { day: -13, key: "star", kind: "glasses", shown: true },
    { bossDay: -13, day: -13, key: "trapHunter", kind: "badge", shown: true },
    { bossDay: -4, day: -4, key: "trapHunter", kind: "badge", shown: true },
  ],
  name: "Lucas Pereira",
  session: {
    blocks: [
      {
        brainPower: 20,
        capsules: [
          { format: "swipe", items: ["color-wavelength"], skills: ["light-wave"], title: "Luz" },
        ],
        kind: "review",
        minutes: 3,
        status: "completed",
      },
      { kind: "learn", lesson: "electron-cloud", minutes: 6, status: "pending" },
      {
        drills: [{ items: ["photon-brightness"], mistake: "brighter-photons" }],
        kind: "practice",
        minutes: 6,
        status: "pending",
        title: "Corrigir um erro",
      },
    ],
    status: "active",
  },
  skills: [
    { memory: "mastered", skill: "atom-scale" },
    { memory: "solid", skill: "quantum-rules" },
    { memory: "solid", skill: "light-wave" },
    { memory: "fading", skill: "photon" },
    { memory: "learning", skill: "duality" },
    { memory: "learning", skill: "atom-structure" },
  ],
  timeZone: "America/Sao_Paulo",
  username: "lucas_orbita",
};
