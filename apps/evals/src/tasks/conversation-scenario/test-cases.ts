import { type TestCase } from "@/lib/types";
import { type GenerateConversationScenarioParams } from "@zoonk/ai/tasks/language/conversation-scenario";

type ConversationScenarioInput = Omit<
  GenerateConversationScenarioParams,
  "analytics" | "model" | "reasoning" | "useFallback"
>;

const PT_RENTING_UNIT = {
  canDo: [
    "Ligar para marcar uma visita a um apartamento",
    "Perguntar o que está incluído no aluguel",
    "Entender um anúncio de aluguel",
  ],
  learnerLanguage: "pt",
  targetLanguage: "en",
  unitDescription: "Encontre um apartamento, pergunte sobre o aluguel e marque uma visita",
  unitTitle: "Alugando um apartamento",
};

export const TEST_CASES: TestCase<unknown, ConversationScenarioInput>[] = [
  {
    expectations: `Brazilian learner of US English at A2, renting an apartment. A call to a landlord or agent to ask about a flat and book a viewing, with objectives like asking the rent, asking what's included and booking a day. US name and dollars. Opening line and hints short and simple (A2). Title, situation and descriptions in Brazilian Portuguese.`,
    id: "pt-en-a2-renting",
    userInput: { ...PT_RENTING_UNIT, level: "A2" },
  },
  {
    expectations: `Brazilian learner of US English at A1, renting an apartment. A call to a landlord or agent, a stranger, to ask about a flat and book a viewing. The opening line introduces the character as the one speaking ("this is Sarah from...", "I'm Sarah") or names the place, and addresses no one by name: never "Hi, Emma" when Emma is the character, and never a name for the learner. Opening line and hints very short (A1: 3 to 6 words, present tense, the most common words). US name and dollars. Title, situation and descriptions in Brazilian Portuguese.`,
    id: "pt-en-a1-renting",
    userInput: { ...PT_RENTING_UNIT, level: "A1" },
  },
  {
    expectations: `US English speaker learning Mexican Spanish at A2, renting an apartment in Mexico City. A call to a landlord ("dueño" or "dueña") about a "departamento", with pesos, Mexican vocabulary ("renta", "depósito", "servicios", "departamento", not "piso") and "usted". Opening line and hints short (A2). Title, situation, role and every objective description in US English, never Spanish.`,
    id: "en-es-a2-renting",
    userInput: {
      canDo: ["Call about an apartment", "Ask what's included", "Arrange a viewing"],
      learnerLanguage: "en",
      level: "A2",
      targetLanguage: "es",
      unitDescription:
        "Find an apartment, ask about the rent and the deposit, and arrange a viewing",
      unitTitle: "Renting an apartment in Mexico City",
    },
  },
  {
    expectations: `US English speaker learning Brazilian Portuguese at A1, at a restaurant. A face-to-face order or a call to a restaurant, with a Brazilian name and reais. Opening line and hints very short (A1): "Eu quero...", "A conta, por favor". Brazilian words ("cardápio", not "ementa"). Title, situation, role and every objective description in US English, never Portuguese.`,
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
  {
    expectations: `Brazilian learner of US English at A2, making weekend plans. The character already knows the learner: a friend, colleague, neighbor or host family member (role in Brazilian Portuguese, such as "amiga" or "colega de trabalho"), never a relative, and the situation says who they are to the learner ("sua amiga Emma"). Together they choose what to do and agree on a day, time and place, with a small twist (the first idea doesn't work). The opening line greets the way a friend would and says who is calling, without the learner's name. Nothing names the learner or assumes facts about their life (their job, family or city). US name, places and prices. Opening line and hints short and simple (A2). Title, situation and descriptions in Brazilian Portuguese.`,
    id: "pt-en-a2-weekend-plans",
    userInput: {
      canDo: [
        "Convidar alguém para fazer algo",
        "Sugerir um dia, um horário e um lugar",
        "Aceitar ou recusar um convite",
      ],
      learnerLanguage: "pt",
      level: "A2",
      targetLanguage: "en",
      unitDescription: "Convide alguém para sair, combine o que fazer e marque dia, hora e lugar",
      unitTitle: "Planos para o fim de semana",
    },
  },
  {
    expectations: `US English speaker learning Mexican Spanish at A1, talking about family. The character already knows the learner: a friend, colleague, neighbor or host family member (role in US English), never one of the learner's relatives, and the situation says who they are to the learner ("your neighbor Lupita"). The learner says who is in their family and asks about the character's. The character's own family is in the brief; nothing assumes who is in the learner's family, and nothing names the learner. The opening line greets the way a friend would and says who is speaking. Opening line and hints very short (A1: 3 to 6 words, present tense): "Tengo dos hermanos.", "¿Tienes hijos?". Title, situation and descriptions in US English.`,
    id: "en-es-a1-family",
    userInput: {
      canDo: [
        "Say who is in your family",
        "Ask someone about their family",
        "Say people's ages and what they do",
      ],
      learnerLanguage: "en",
      level: "A1",
      targetLanguage: "es",
      unitDescription: "Talk about your family and ask about someone else's",
      unitTitle: "My family",
    },
  },
  {
    expectations: `US English speaker learning Brazilian Portuguese at B1, joining a gym in São Paulo. A service moment, so the character is a stranger who works there (a receptionist or a trainer), never a friend or neighbor. The learner asks about plans and prices, hours or classes, and books a trial class, with reais and a Brazilian name. Opening line and hints at B1 (up to about 15 words, connectors). Title, situation and descriptions in US English.`,
    id: "en-pt-b1-gym",
    userInput: {
      canDo: [
        "Ask about membership plans and prices",
        "Ask about opening hours and classes",
        "Book a trial class",
      ],
      learnerLanguage: "en",
      level: "B1",
      targetLanguage: "pt",
      unitDescription: "Find a gym, compare plans and book a trial class",
      unitTitle: "Joining a gym",
    },
  },
];
