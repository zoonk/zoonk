// The sample learners the stage shows, one per goal and language. Every word and number mirrors what the
// running app showed for that learner (a seeded persona or a copy of one), so a post never says what
// the product doesn't. Add a learner by capturing the screens first, then copying what they show.
import { type Lang } from "../story";

type Phase = { name: string; milestone: string; startDate: string; endDate: string };

/** An exam subject as the notice lists it: its topics are the notice's, so their count is too. */
type Subject = { name: string; shortName: string; topics: number; questions: number | null };

type Lesson = { title: string; minutes: number };

export type SampleLearner = {
  lang: Lang;
  goalId: string;
  planId: string;
  goal: {
    kind: "exam" | "language";
    /** What the learner typed after the box's own "I want to". */
    text: string;
    title: string;
    displayName: string;
    targetDate: string;
    /** The learner named only a month ("in May"), so dates read as a month. */
    namedMonth: boolean;
    targetLanguage: string | null;
    targetRegion: string | null;
    languageFlag: string | null;
  };
  minutesPerDay: number;
  /** The goal's share the daily time covers by the date. */
  coverage: number;
  /** The daily time that covers everything, which the time question offers. */
  everythingMinutes: number | null;
  /** A language goal's path; an exam's plan shows its subjects instead. */
  phases: Phase[];
  subjects: Subject[];
  /** An exam option the learner picked, such as ENEM's foreign language. */
  choice: { group: string; options: string[]; picked: string } | null;
  /** The first day's lessons, in order. */
  lessons: Lesson[];
};

/** "I want to speak Spanish before I move to Madrid in June.", the onboarded Madrid learner. */
const madrid: SampleLearner = {
  lang: "en",
  goalId: "8f0c2a4e-3b1d-4c6e-9a57-2d1f0b7e6c31",
  planId: "5a7d9e21-6c4b-4f08-8e13-9b2c4d6f7a80",
  goal: {
    kind: "language",
    text: "speak Spanish before I move to Madrid in June.",
    title: "Speak Spanish before moving to Madrid",
    displayName: "Spanish",
    targetDate: "2027-06-14",
    namedMonth: false,
    targetLanguage: "es",
    targetRegion: "ES",
    languageFlag: "es",
  },
  minutesPerDay: 45,
  coverage: 0.31,
  everythingMinutes: null,
  // The captured first phase ends "in Mexican Spanish", a variety the Madrid goal doesn't ask for.
  phases: [
    {
      name: "Making a first connection",
      milestone: "Handle simple introductions and immediate everyday needs.",
      startDate: "2026-11-03",
      endDate: "2027-01-11",
    },
    {
      name: "Getting by independently",
      milestone: "Manage familiar daily situations and exchange simple personal information.",
      startDate: "2027-01-12",
      endDate: "2027-03-20",
    },
    {
      name: "Joining the conversation",
      milestone:
        "Navigate less predictable situations and sustain conversations about familiar topics.",
      startDate: "2027-03-21",
      endDate: "2027-05-18",
    },
    {
      name: "Taking part with confidence",
      milestone: "Communicate with detail and flexibility across a range of everyday situations.",
      startDate: "2027-05-19",
      endDate: "2027-06-14",
    },
  ],
  subjects: [],
  choice: null,
  lessons: [
    { title: "Spanish greetings and farewells", minutes: 3 },
    { title: "Tú and usted", minutes: 3 },
    { title: "Spanish vowel sounds", minutes: 3 },
    { title: "Requests for repetition and slower speech", minutes: 3 },
    { title: "Spelling and meaning questions", minutes: 3 },
  ],
};

/** The onboarded-sat-may persona on the daily time question. */
const sat: SampleLearner = {
  lang: "en",
  goalId: "3d1f6f0e-8a52-4d6b-9c1e-5f2a7b8c9d10",
  planId: "6b2e8f31-7d5c-4a19-9f24-0c3d5e7f8a91",
  goal: {
    kind: "exam",
    text: "pass the SAT in May",
    title: "SAT",
    displayName: "SAT",
    targetDate: "2027-05-01",
    namedMonth: true,
    targetLanguage: null,
    targetRegion: null,
    languageFlag: null,
  },
  minutesPerDay: 60,
  coverage: 0.49,
  everythingMinutes: 155,
  phases: [],
  subjects: [],
  choice: null,
  lessons: [],
};

/**
 * Ana's ENEM 2027 goal ("Quero passar no Enem em novembro e entrar em Medicina na USP."), from the
 * seeded Ana persona. Subjects and topic counts are the seeded ENEM notice's (enem-blueprint.ts).
 */
const ana: SampleLearner = {
  lang: "pt",
  goalId: "c4a1e7d2-5b3f-4e86-a9d0-1f2b3c4d5e6f",
  planId: "d5b2f8e3-6c4a-4f97-b0e1-2a3b4c5d6e7f",
  goal: {
    kind: "exam",
    text: "passar no Enem em novembro e entrar em Medicina na USP.",
    title: "ENEM 2027",
    displayName: "ENEM 2027",
    targetDate: "2027-11-14",
    namedMonth: false,
    targetLanguage: null,
    targetRegion: null,
    languageFlag: null,
  },
  minutesPerDay: 60,
  coverage: 0.41,
  everythingMinutes: 150,
  phases: [],
  subjects: [
    {
      name: "Linguagens, Códigos e suas Tecnologias",
      shortName: "Linguagens",
      topics: 8,
      questions: 45,
    },
    { name: "Língua Inglesa", shortName: "Inglês", topics: 4, questions: null },
    {
      name: "Ciências Humanas e suas Tecnologias",
      shortName: "Ciências Humanas",
      topics: 5,
      questions: 45,
    },
    {
      name: "Ciências da Natureza e suas Tecnologias",
      shortName: "Ciências da Natureza",
      topics: 23,
      questions: 45,
    },
    { name: "Matemática e suas Tecnologias", shortName: "Matemática", topics: 5, questions: 45 },
    { name: "Redação", shortName: "Redação", topics: 1, questions: null },
  ],
  choice: { group: "Língua Estrangeira", options: ["Inglês", "Espanhol"], picked: "Inglês" },
  lessons: [
    { title: "Porcentagem e descontos", minutes: 5 },
    { title: "Aumento seguido de desconto", minutes: 5 },
    { title: "Ênfase visual em anúncios", minutes: 3 },
    { title: "Mapas temáticos e legendas", minutes: 4 },
    { title: "Gráficos combinados em painéis", minutes: 3 },
  ],
};

export const LEARNERS = { ana, madrid, sat };

export type LearnerId = keyof typeof LEARNERS;

export function getLearner(id: string | null): SampleLearner {
  const learner = id && id in LEARNERS ? LEARNERS[id as LearnerId] : null;
  if (!learner) throw new Error(`No sample learner "${id}": ${Object.keys(LEARNERS).join(", ")}`);
  return learner;
}
