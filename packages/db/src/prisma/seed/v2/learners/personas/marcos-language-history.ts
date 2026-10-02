import { type SeedLanguageHistory } from "../types";

const A2 = 1;
const A2_PLUS = 1.5;
const B1 = 2;

/** Linda, the landlord on Queen Street: the renting unit's call at A2. */
const rentingCall = {
  character: { name: "Linda", place: "Queen Street", role: "proprietária" },
  characterBrief:
    "You are Linda, a friendly landlord renting a one-bedroom apartment on Queen Street, Toronto. Rent is $2,400 a month, utilities not included, deposit is first and last month's rent. The apartment is still available. You can show it on Saturday at 10am or 2pm. Speak simply and slowly.",
  hints: [
    "Is the apartment still available?",
    "How much is the deposit?",
    "Can I see it on Saturday?",
    "Are utilities included?",
  ],
  objectives: [
    { description: "Perguntar se o apartamento ainda está livre", label: "Is it available?" },
    { description: "Marcar um horário para ver o apartamento", label: "Book a viewing" },
    { description: "Perguntar quanto é a caução", label: "Ask about the deposit" },
  ],
  openingLine: "Hi! Are you calling about the apartment on Queen Street?",
  situation:
    "Você viu um anúncio de apartamento em Toronto e liga para a proprietária para saber se ainda está disponível e marcar uma visita.",
  title: "Ligar para marcar uma visita",
};

/** The immigration officer at the airport: the arriving unit's call at A2. */
const arrivingCall = {
  character: { name: "Officer Grant", place: "Toronto Pearson", role: "agente de imigração" },
  characterBrief:
    "You are a calm immigration officer at Toronto Pearson airport. Ask why the traveler is in Canada, how long they will stay and where they will live. Be polite and brief.",
  hints: ["I'm moving here to work.", "I'll stay with my wife.", "Here is my work permit."],
  objectives: [
    { description: "Explicar por que você está no Canadá", label: "Explain your visit" },
    { description: "Dizer onde você vai morar", label: "Say where you'll live" },
  ],
  openingLine: "Good morning. What brings you to Canada?",
  situation: "Você acabou de chegar em Toronto e o agente de imigração faz algumas perguntas.",
  title: "Passar pela imigração",
};

/**
 * Marcos after four weeks: reading ahead of speaking, one unit call won (the airport), the renting
 * unit's call waiting, and a pattern with "since" in his recent mistakes.
 */
export const marcosLanguageHistory: SeedLanguageHistory = {
  conversations: [
    {
      chapter: "arriving",
      day: -9,
      feedback: {
        encouragement: "Você se fez entender do começo ao fim. Muito bom!",
        improve: {
          better: "I'm moving here to work.",
          said: "I move here for work.",
          why: "Para um plano que já está acontecendo, o inglês usa I'm moving, não I move.",
        },
        kind: "call",
        pronunciation: [
          {
            respelling: "PÉR-mit",
            tip: "A força vai no começo, e o r quase não aparece.",
            word: "permit",
          },
        ],
        wentWell: ["Here is my work permit.", "I will live in Toronto with my wife."],
      },
      kind: "checkpoint",
      level: "A2",
      minutes: 1,
      objectivesMet: ["Explain your visit", "Say where you'll live"],
      spokenSeconds: 64,
    },
  ],
  levels: [
    { score: B1, skill: "reading", start: B1 },
    { score: B1, skill: "listening", start: A2 },
    { score: A2_PLUS, skill: "speaking", start: A2 },
    { score: A2_PLUS, skill: "writing", start: A2 },
  ],
  pattern: {
    content: {
      contrast: [
        { example: "since 2020", label: "since + quando começou" },
        { example: "for 6 years", label: "for + quanto tempo" },
      ],
      drill: [
        {
          answer: "since",
          feedback: "2019 é quando começou, então é since.",
          options: ["since", "for", "from"],
          sentence: "I've worked at the bank ___ 2019.",
        },
        {
          answer: "for",
          feedback: "Três anos é quanto tempo, então é for.",
          options: ["since", "for", "during"],
          sentence: "We've lived here ___ three years.",
        },
        {
          answer: "since",
          feedback: "Monday é quando começou: since.",
          options: ["for", "since", "ago"],
          sentence: "She's been sick ___ Monday.",
        },
        {
          answer: "for",
          feedback: "Two hours é uma duração: for.",
          options: ["since", "for", "at"],
          sentence: "I've waited ___ two hours.",
        },
        {
          answer: "since",
          feedback: "We were kids marca o começo: since.",
          options: ["since", "for", "when"],
          sentence: "I've known her ___ we were kids.",
        },
      ],
      examples: [
        {
          answer: "I live here since 2020.",
          correctAnswer: "I've lived here since 2020.",
          format: "spokenAnswer",
        },
        {
          answer: "I work at the bank since 2019.",
          correctAnswer: "I've worked at the bank since 2019.",
          format: "typedAnswer",
        },
      ],
      rule: "Começou no passado e continua? Use have + particípio. O erro vem do português: “moro aqui desde 2020”.",
    },
    day: -1,
    mistakes: [],
    title: "since e for",
  },
  scenarios: [
    { chapter: "renting", content: rentingCall, level: "A2" },
    { chapter: "arriving", content: arrivingCall, level: "A2" },
  ],
  words: [
    { day: -26, text: "passport" },
    { day: -26, text: "visa" },
    { day: -20, text: "baggage" },
    { day: -20, text: "downtown" },
    { day: -1, text: "rent" },
    { day: -1, text: "landlord" },
    { day: -1, text: "deposit" },
    { day: -1, text: "lease" },
    { day: -1, text: "utilities" },
  ],
};
