import { type TestCase } from "@/lib/types";
import { type GenerateConversationScenarioParams } from "@zoonk/ai/tasks/v2/language/conversation-scenario";

type ConversationScenarioInput = Omit<
  GenerateConversationScenarioParams,
  "analytics" | "model" | "reasoning" | "useFallback"
>;

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
