import { t } from "../../_utils/localize";
import { physicsCourse } from "../../library/physics/physics-course";
import { type SeedAttempt, type SeedLearner } from "../types";

const SMALL_WORLD_CHALLENGE = t("Challenge: A very small world", "Desafio: Um mundo muito pequeno");
const TRICKSTER_DUEL = t("Duel with the Trickster", "Duelo com o Trapaceiro");

const lessonAnswers: SeedAttempt[] = (
  [
    [-18, "atom-scale"],
    [-16, "quantum-rules"],
    [-11, "light-wave"],
    [-9, "photon"],
    [-7, "duality"],
    [-1, "atom-structure"],
  ] as const
).flatMap(([day, skill]) =>
  [1, 2].map((index): SeedAttempt => ({
    answer: { selectedIndex: 0 },
    day,
    isCorrect: true,
    key: `lesson-${skill}-${index}`,
    seconds: 25,
    skill,
  })),
);

export const lucasBuddy: SeedLearner = {
  attempts: [
    {
      answer: { isTrue: true },
      day: -4,
      isCorrect: false,
      item: "photon-brightness",
      key: "brighter-photons",
      mistake: {
        cause: "gap",
        snapshot: {
          answer: "true",
          correctAnswer: "false",
          explanation: t(
            "Brighter light has more photons, not stronger ones.",
            "Uma luz mais forte tem mais fótons, não fótons mais fortes.",
          ),
          format: "trueFalse",
          misconception: t(
            "Thinks brightness sets a photon's energy",
            "Acha que o brilho define a energia do fóton",
          ),
          question: t(
            "A brighter red light is made of red photons that each carry more energy.",
            "Uma luz vermelha mais forte é feita de fótons vermelhos com mais energia cada um.",
          ),
        },
        status: "open",
      },
      seconds: 12,
      skill: "photon",
    },
    ...lessonAnswers,
  ],
  brainPower: 310,
  buddy: { glasses: "star", kind: "otto", name: "Otto" },
  email: "v2-buddy@zoonk.test",
  goal: {
    course: physicsCourse,
    createdDay: -18,
    dailyMinutes: 15,
    details: {
      answered: ["purpose", "targetDate", "level", "buddy", "placement", "schedule"],
      level: "none",
      levelNote: "nada ainda",
      purpose: "overview",
    },
    key: "quantum-overview",
    kind: "learn",
    plan: {
      items: [
        { day: -18, kind: "lesson", lesson: "how-small-is-an-atom", phase: 0, status: "done" },
        { day: -16, kind: "lesson", lesson: "rules-change-when-small", phase: 0, status: "done" },
        { day: -13, kind: "boss", phase: 0, status: "done", title: SMALL_WORLD_CHALLENGE },
        { day: -11, kind: "lesson", lesson: "light-as-wave", phase: 1, status: "done" },
        { day: -9, kind: "lesson", lesson: "light-comes-in-packets", phase: 1, status: "done" },
        { day: -7, kind: "lesson", lesson: "double-slit", phase: 1, status: "done" },
        { day: -4, kind: "boss", phase: 1, status: "done", title: TRICKSTER_DUEL },
        { day: -1, kind: "lesson", lesson: "almost-empty-atom", phase: 2, status: "done" },
        { day: 0, kind: "lesson", lesson: "electron-cloud", phase: 2, status: "todo" },
        { day: 1, kind: "lesson", lesson: "confined-jittery", phase: 2, status: "todo" },
        { day: 2, kind: "lesson", lesson: "why-colors-exist", phase: 2, status: "todo" },
        { chapter: "uncertainty", kind: "chapter", phase: 3, status: "todo" },
        { chapter: "entanglement", kind: "chapter", phase: 4, status: "todo" },
        { chapter: "in-your-phone", kind: "chapter", phase: 5, status: "todo" },
      ],
      phases: [
        { name: t("A very small world", "Um mundo muito pequeno") },
        { name: t("Light: wave or particle?", "Luz: onda ou partícula?") },
        { name: t("Inside the atom", "Dentro do átomo") },
        { name: t("Uncertainty", "Incerteza") },
        { name: t("Entanglement", "Emaranhamento") },
        { name: t("Quantum physics in your phone", "O quântico no seu celular") },
      ],
    },
    prompt: "quero entender física quântica sem precisar fazer conta",
    studyTime: "21:00",
    title: t("Understand quantum physics", "Entender física quântica"),
  },
  history: {
    accuracy: 0.8,
    checkpoints: [
      { correct: 8, day: -13, title: SMALL_WORLD_CHALLENGE, total: 10 },
      { correct: 7, day: -4, title: TRICKSTER_DUEL, total: 10 },
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
  session: { finished: 0, started: true },
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
