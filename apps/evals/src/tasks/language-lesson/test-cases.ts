import { type TestCase } from "@/lib/types";
import { type LanguageLessonParams } from "@zoonk/ai/tasks/v2/language/language-lesson";

type LanguageLessonInput = Omit<
  LanguageLessonParams,
  "analytics" | "model" | "reasoning" | "useFallback"
>;

/**
 * One case per language pair the plan names (learner language to target
 * language), across levels and situations. Evals focus on English and
 * Portuguese; Spanish is checked in its Spain variant.
 */
export const TEST_CASES: TestCase<unknown, LanguageLessonInput>[] = [
  {
    expectations: `Brazilian Portuguese speaker learning US English, A2, renting an apartment in Toronto. Words like "the rent", "the deposit", "utilities" or "the lease"; "rent" is "aluguel", and a note should catch that Portuguese "renda" means income. Tips should target sounds Portuguese speakers struggle with (English "r" at the start of a word, "th", final consonants, vowel length). Respellings are readable by a Brazilian (no "rr" for an English "r"). "Deposit" and "utilities" aren't in the known words, but "apartment" is and must not be taught again.`,
    id: "pt-en-a2-renting",
    userInput: {
      knownWords: ["the apartment", "the bedroom", "the kitchen", "How much"],
      learnerLanguage: "pt",
      lessonCanDo: "Perguntar quanto é o aluguel e o que está incluído",
      lessonDescription: "Pergunte o valor do aluguel, da caução e das contas antes de visitar",
      lessonTitle: "Perguntando sobre o aluguel",
      level: "A2",
      targetLanguage: "en",
      unitCanDos: [
        "Ligar para marcar uma visita a um apartamento",
        "Perguntar o que está incluído no aluguel",
        "Entender um anúncio de aluguel",
      ],
      unitTitle: "Alugando um apartamento",
    },
  },
  {
    expectations: `Brazilian Portuguese speaker learning US English, B1, at the doctor. Words for describing symptoms and how long they've lasted ("a sore throat", "a fever", "for three days", "since Monday"). The tip should plausibly cover "for" versus "since" with the present perfect, a classic mistake for Portuguese speakers ("I'm sick since Monday"). Sentences can be longer than at A2 but stay natural.`,
    id: "pt-en-b1-doctor",
    userInput: {
      knownWords: ["the doctor", "I feel", "the pharmacy"],
      learnerLanguage: "pt",
      lessonCanDo: "Explicar ao médico o que você está sentindo e desde quando",
      lessonDescription: "Descreva sintomas e há quanto tempo eles começaram",
      lessonTitle: "Explicando seus sintomas",
      level: "B1",
      targetLanguage: "en",
      unitCanDos: ["Marcar uma consulta", "Explicar sintomas", "Entender as instruções do remédio"],
      unitTitle: "No médico e na farmácia",
    },
  },
  {
    expectations: `US English speaker learning Brazilian Portuguese, A1, ordering at a restaurant. Brazilian words and forms ("o cardápio", "a conta", "Eu quero...", "Por favor"), not European Portuguese ("a ementa"). Tips should target sounds English speakers get wrong (nasal "ão", the "r" in "carro" sounding like "h", open and closed vowels). Respellings use English spelling habits ("kar-DAH-pee-oo").`,
    id: "en-pt-a1-restaurant",
    userInput: {
      knownWords: ["Olá", "Obrigado"],
      learnerLanguage: "en",
      lessonCanDo: "Order a dish and ask for the bill",
      lessonDescription: "Ask for the menu, order and ask for the bill politely",
      lessonTitle: "Ordering and paying",
      level: "A1",
      targetLanguage: "pt",
      unitCanDos: ["Ask for a table", "Order food and drinks", "Ask for the bill"],
      unitTitle: "At a restaurant",
    },
  },
  {
    expectations: `US English speaker learning Spain Spanish, A2, renting a flat in Madrid. Spain vocabulary: "el piso", "el alquiler", "la fianza", "los gastos"; "vosotros" is fine but a lesson aimed at a landlord would use "usted". Latin American forms like "el departamento" or "el depósito" as the main word are wrong for this variant. Tips should target sounds English speakers get wrong (the tapped "r", pure vowels, "ll").`,
    id: "en-es-a2-renting",
    userInput: {
      knownWords: ["la casa", "¿Cuánto cuesta?"],
      learnerLanguage: "en",
      lessonCanDo: "Ask about the rent, the deposit and the bills for a flat",
      lessonDescription: "Ask what the rent is and what the deposit and bills are",
      lessonTitle: "Asking about the rent",
      level: "A2",
      targetLanguage: "es",
      unitCanDos: ["Call about a flat", "Ask what's included", "Arrange a viewing"],
      unitTitle: "Renting a flat in Madrid",
    },
  },
  {
    expectations: `Spain Spanish speaker learning US English, A2, talking about their job. Words like "I work as", "a nurse", "a shift", "full-time". Tips for Spanish speakers (the English "v" and "b", the "sh" sound, adding "e" before "s" + consonant as in "estudent"), notes for false friends ("actually" is not "actualmente"). All learner-language text in Spain Spanish.`,
    id: "es-en-a2-work",
    userInput: {
      knownWords: ["I am", "my name is"],
      learnerLanguage: "es",
      lessonCanDo: "Decir a qué te dedicas y qué horario tienes",
      lessonDescription: "Explica en qué trabajas, dónde y en qué horario",
      lessonTitle: "Hablar de tu trabajo",
      level: "A2",
      targetLanguage: "en",
      unitCanDos: [
        "Presentarte en el trabajo",
        "Hablar de tu trabajo",
        "Pedir ayuda a un compañero",
      ],
      unitTitle: "Tu primera semana en el trabajo",
    },
  },
];
