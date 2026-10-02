import { physicsCourse } from "../../library/physics/physics-course";
import { type SeedLearner } from "../types";

/**
 * A guest: an anonymous user who arrived from the public lesson page on why the electron doesn't
 * fall in, answered its first question, finished the lesson and typed a goal. "Save your plan"
 * asks them for an account next.
 */
export const guest: SeedLearner = {
  attempts: [
    {
      answer: { selectedOptionId: "chances" },
      day: 0,
      inSession: true,
      isCorrect: true,
      key: "cloud-chances",
      seconds: 17,
      skill: "electron-cloud",
      step: { lesson: "electron-cloud", position: 3 },
    },
    {
      answer: { selectedOptionId: "fast" },
      day: 0,
      inSession: true,
      isCorrect: false,
      key: "cloud-spins-fast",
      mistake: {
        cause: "trap",
        snapshot: {
          answer: "It spins too fast to be caught",
          correctAnswer: "It's already in the lowest energy state there is",
          explanation:
            "That's the planet picture again. The electron doesn't circle the nucleus, so speed isn't what keeps it out.",
          format: "check",
          misconception: "Holds the planet picture of the atom",
          question:
            "Why can't the electron in a hydrogen atom lose more energy and fall into the nucleus?",
        },
        status: "open",
      },
      seconds: 26,
      skill: "ground-state",
      step: { lesson: "electron-cloud", position: 6 },
    },
  ],
  brainPower: 60,
  email: "v2-guest@zoonk.test",
  feedback: [],
  goal: {
    course: physicsCourse,
    createdDay: 0,
    dailyMinutes: 10,
    details: { purpose: "overview" },
    key: "quantum-basics",
    kind: "learn",
    plan: {
      items: [
        { day: 0, kind: "lesson", lesson: "electron-cloud", phase: 0, status: "done" },
        { day: 1, kind: "lesson", lesson: "how-small-is-an-atom", phase: 0, status: "todo" },
        { day: 2, kind: "lesson", lesson: "almost-empty-atom", phase: 0, status: "todo" },
        { day: 3, kind: "lesson", lesson: "why-colors-exist", phase: 0, status: "todo" },
        { chapter: "light-wave-or-particle", kind: "chapter", phase: 1, status: "todo" },
        { chapter: "uncertainty", kind: "chapter", phase: 1, status: "todo" },
        { chapter: "entanglement", kind: "chapter", phase: 2, status: "todo" },
        { chapter: "in-your-phone", kind: "chapter", phase: 2, status: "todo" },
      ],
      phases: [
        { name: "Inside the atom" },
        { name: "Light and uncertainty" },
        { name: "Entanglement and your phone" },
      ],
    },
    prompt: "understand quantum physics",
    studyTime: "20:00",
    title: "Understand quantum physics",
  },
  history: { accuracy: 0.67, days: 0, energy: 10, minutesPerDay: 6, skipChance: 0 },
  isAnonymous: true,
  key: "guest",
  language: "en",
  memory: [],
  milestones: [],
  mode: "focus",
  name: "Guest",
  session: {
    blocks: [
      { brainPower: 60, kind: "learn", lesson: "electron-cloud", minutes: 6, status: "completed" },
    ],
    status: "completed",
  },
  skills: [
    { memory: "learning", skill: "electron-cloud" },
    { memory: "learning", skill: "ground-state" },
  ],
  timeZone: "America/Los_Angeles",
  username: null,
};
