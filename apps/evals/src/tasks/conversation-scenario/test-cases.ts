import { type TestCase } from "@/lib/types";
import { type GenerateConversationScenarioParams } from "@zoonk/ai/tasks/v2/language/conversation-scenario";

type ConversationScenarioInput = Omit<
  GenerateConversationScenarioParams,
  "analytics" | "model" | "reasoning" | "useFallback"
>;

/**
 * Units from the language courses the plan names, across levels and pairs,
 * plus the IELTS and TOEFL speaking mocks core builds from the same task.
 * The first three are the ones a small validation run samples.
 */
export const TEST_CASES: TestCase<unknown, ConversationScenarioInput>[] = [
  {
    expectations: `Brazilian learner of US English at A2, renting an apartment. A call to a landlord or agent to ask about a flat and book a viewing, with objectives like asking the rent, asking what's included and booking a day. US name and dollars. Opening line and hints short and simple (A2). Title, situation and descriptions in Brazilian Portuguese.`,
    id: "pt-en-a2-renting",
    userInput: {
      canDo: [
        "Ligar para marcar uma visita a um apartamento",
        "Perguntar o que está incluído no aluguel",
        "Entender um anúncio de aluguel",
      ],
      learnerLanguage: "pt",
      level: "A2",
      targetLanguage: "en",
      unitDescription: "Encontre um apartamento, pergunte sobre o aluguel e marque uma visita",
      unitTitle: "Alugando um apartamento",
    },
  },
  {
    expectations: `IELTS Speaking practice mock for a Brazilian candidate at B1. The character is the examiner (role "examinador" or "examinadora"), the objectives are the three parts in order with labels like "Part 1: About you", "Part 2: Cue card", "Part 3: Discussion", and the brief has the Part 1 questions, the full Part 2 cue card (topic and four bullet prompts) and Part 3 questions linked to the cue card topic, run in about 5 minutes. The opening line is the examiner's greeting and first question. Title and situation call it a practice mock in Brazilian Portuguese, never an official test. Hints are phrases to keep talking.`,
    id: "pt-en-b1-ielts-speaking",
    userInput: {
      canDo: [
        "Responder perguntas sobre você, sua rotina e seus interesses",
        "Falar por cerca de um minuto sobre o tema de um cartão",
        "Discutir ideias mais gerais ligadas ao tema do cartão",
      ],
      learnerLanguage: "pt",
      level: "B1",
      targetLanguage: "en",
      unitDescription:
        "Um simulado curto das três partes do exame em cerca de 5 minutos: Parte 1 com perguntas sobre você, Parte 2 com um cartão para falar por cerca de um minuto e Parte 3 com uma discussão sobre o tema.",
      unitTitle: "IELTS Speaking test",
    },
  },
  {
    expectations: `TOEFL iBT Speaking practice mock for a Brazilian candidate at A2, with the unit core sends. The character is the examiner (role "examinador" or "examinadora"), the objectives are "Listen and Repeat" then "Take an Interview", and the brief has a campus or academic setting with seven original sentences that start at about 5 words and grow to 14 to 20 with dependent or relative clauses, then a one-sentence interview introduction and four questions going from a brief fact about the candidate to describing an experience, an opinion on a broader issue and a prediction, each said once with about 45 seconds per answer. The opening line greets, gives the Listen and Repeat directions and the setting, and ends with the first sentence. Title and situation, in Brazilian Portuguese, call it a practice mock shorter than the real section, never an official test. Hints help interview answers (a reason, an example, a prediction) at A2 and never ask the examiner to repeat.`,
    id: "pt-en-a2-toefl-speaking",
    userInput: {
      canDo: [
        "Listen and Repeat: repeat seven sentences exactly as you hear them, in a campus or academic setting, each longer and more complex than the last",
        "Take an Interview: answer four interview questions, from facts about yourself to opinions, explanations and predictions, for up to about 45 seconds each",
      ],
      learnerLanguage: "pt",
      level: "A2",
      targetLanguage: "en",
      unitDescription:
        "A short mock of the TOEFL iBT Speaking section: its two tasks compressed into about five minutes instead of about eight, with an examiner who says each sentence and question once.",
      unitTitle: "TOEFL iBT Speaking section",
    },
  },
  {
    expectations: `US English speaker learning Spain Spanish at A2, renting a flat in Madrid. A call to a landlord ("casero" or "propietaria") about a "piso", with euros, Spain vocabulary ("fianza", "gastos", "piso", not "departamento") and "usted" or natural Spain register. Opening line and hints short (A2). Title, situation and descriptions in US English.`,
    id: "en-es-a2-renting",
    userInput: {
      canDo: ["Call about a flat", "Ask what's included", "Arrange a viewing"],
      learnerLanguage: "en",
      level: "A2",
      targetLanguage: "es",
      unitDescription: "Find a flat, ask about the rent and the deposit, and arrange a viewing",
      unitTitle: "Renting a flat in Madrid",
    },
  },
  {
    expectations: `US English speaker learning Brazilian Portuguese at A1, at a restaurant. A face-to-face order or a call to a restaurant, with a Brazilian name and reais. Opening line and hints very short (A1): "Eu quero...", "A conta, por favor". Brazilian words ("cardápio", not "ementa"). Title, situation and descriptions in US English.`,
    id: "en-pt-a1-restaurant",
    userInput: {
      canDo: ["Ask for a table", "Order food and drinks", "Ask for the bill"],
      learnerLanguage: "en",
      level: "A1",
      targetLanguage: "pt",
      unitDescription: "Ask for a table, order and pay at a restaurant",
      unitTitle: "At a restaurant",
    },
  },
  {
    expectations: `Brazilian learner of US English at B1, at the doctor. A call to a clinic receptionist to book an appointment and explain symptoms and since when, with a small twist (the first time is taken). Opening line and hints at B1 (up to about 15 words, connectors). Title, situation and descriptions in Brazilian Portuguese.`,
    id: "pt-en-b1-doctor",
    userInput: {
      canDo: [
        "Marcar uma consulta",
        "Explicar sintomas e desde quando",
        "Entender as instruções do remédio",
      ],
      learnerLanguage: "pt",
      level: "B1",
      targetLanguage: "en",
      unitDescription: "Marque uma consulta, explique o que está sentindo e entenda as instruções",
      unitTitle: "No médico e na farmácia",
    },
  },
];
