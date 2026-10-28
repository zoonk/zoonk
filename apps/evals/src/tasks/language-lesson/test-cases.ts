import { type TestCase } from "@/lib/types";
import { type LanguageLessonParams } from "@zoonk/ai/tasks/v2/language/language-lesson";

export type LanguageLessonInput = Omit<
  LanguageLessonParams,
  "analytics" | "model" | "reasoning" | "useFallback"
>;

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
    expectations: `Brazilian Portuguese speaker learning US English, A1, finding places in a new home ("Where is the bathroom?", "the bedroom", "upstairs", "next to"). Words with "th" ("the bathroom", "the third floor") keep "th" in their respelling ("BÉTH-rum"), never "f", "d" or "t" ("BÉ-frum" teaches the mistake), and their tips say how to make the sound. Every respelling agrees with its tip. Respellings are readable by a Brazilian (no "rr" for an English "r") and add no vowel the word doesn't have.`,
    id: "pt-en-a1-th-sounds",
    userInput: {
      knownWords: ["the house", "the kitchen", "Where is"],
      learnerLanguage: "pt",
      lessonCanDo: "Perguntar e dizer onde ficam os cômodos de uma casa",
      lessonDescription: "Pergunte onde fica o banheiro e entenda a resposta",
      lessonTitle: "Onde fica o banheiro?",
      level: "A1",
      targetLanguage: "en",
      unitCanDos: ["Conhecer a casa nova", "Perguntar onde ficam as coisas"],
      unitTitle: "Uma casa nova",
    },
  },
  {
    expectations: `Brazilian Portuguese speaker learning US English, B1, in a job interview, asking the interviewer to repeat, rephrase or slow down ("Could you repeat that?", "Could you rephrase the question?", "more slowly", "Let me make sure I understood"). Respellings have exactly the word's syllables and never the vowel Brazilians add: "repeat" is "ri-PIT", "rephrase" is "ri-FREIZ", "slowly" is "SLOU-li", "question" is "CUÉS-tchan", never "i-ri-PIT", "a-ri-FREIZ" or "is-LOU-li". Words starting with an English "r" get a tip on making it. B1 sentences fit a real interview, not A1 greetings. The lesson is shared by learners of every field: the learner's own lines never give them a job or field ("my experience in sales"), only general ones ("my most recent role").`,
    id: "pt-en-b1-interview-repeat",
    userInput: {
      knownWords: ["Good morning", "Nice to meet you", "I work with data"],
      learnerLanguage: "pt",
      lessonCanDo: "Pedir para o entrevistador repetir, reformular ou falar mais devagar",
      lessonDescription: "Peça para repetir ou reformular uma pergunta sem perder a confiança",
      lessonTitle: "Pedidos de repetição e reformulação",
      level: "B1",
      targetLanguage: "en",
      unitCanDos: [
        "Apresentar sua trajetória em uma entrevista",
        "Pedir esclarecimentos durante a entrevista",
        "Falar de um projeto e seus resultados",
      ],
      unitTitle: "Entrevista de emprego em inglês",
    },
  },
  {
    expectations: `Brazilian Portuguese speaker learning US English, B1, opening a job interview by greeting and introducing themselves. At B1 the learner already says "Good morning", "My name is" and "Nice to meet you": none of those is taught as a new word. The words are what a B1 candidate still needs in the first minute ("Thanks for having me", "I've been working as", "my most recent role", "walk you through"), and the sentences sound like a real interview opening, up to about 12 words. The lesson is shared by learners of every field: the learner's own lines never give them a job or field, only general ones.`,
    id: "pt-en-b1-interview-opening",
    userInput: {
      knownWords: [],
      learnerLanguage: "pt",
      lessonCanDo: "Cumprimentar o entrevistador e se apresentar no início da entrevista",
      lessonDescription: "Comece a entrevista com uma apresentação curta e segura",
      lessonTitle: "Cumprimentos e apresentações na entrevista",
      level: "B1–B2",
      targetLanguage: "en",
      unitCanDos: [
        "Abrir a entrevista com confiança",
        "Pedir esclarecimentos durante a entrevista",
        "Falar da sua função atual",
      ],
      unitTitle: "Abertura e esclarecimentos na entrevista",
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
  {
    expectations: `An IELTS candidate reads the app in English and prepares in English, so the lesson is in English only and nothing is translated. Each word's \`translation\` is a short plain-English definition of its meaning in an academic passage, the way a learner's dictionary writes it, and never the word itself or a form of it (the lesson that failed had "need" defined as "need" and "grow" as "grow"). Sentence \`translation\` fields repeat the sentence exactly. Explanations, tips and notes never compare with "your language" or another language: tips name a sound English learners commonly get wrong, or are null; notes name a usage trap or a word often confused with it, or are null. The writing prompt gives the information to write in other words, never a sentence to copy. Sentences fit a short academic passage at A1–A2.`,
    id: "en-en-a1-ielts-frequent-words",
    userInput: {
      knownWords: [],
      learnerLanguage: "en",
      lessonCanDo: "Recognize familiar words to understand a short academic passage",
      lessonDescription: "Common words carry much of the meaning in short academic passages.",
      lessonTitle: "Frequent words in short passages",
      level: "A1–A2",
      targetLanguage: "en",
      unitCanDos: [
        "Recognize frequent English words in short passages",
        "Use nearby words to choose a familiar word’s meaning",
        "Find details stated directly in a passage",
      ],
      unitTitle: "Words in short passages",
    },
  },
  {
    expectations: `An IELTS candidate reads the app in English and learns to hear words that differ in their first consonant ("pat" and "bat", "pin" and "bin"). Nothing is translated: words get short plain-English definitions that never contain the word, and sentence \`translation\` fields repeat the sentence. The lesson is about hearing a sound, which writing can't test: a written word gives its spelling away, so practice never asks about a sound or letter in writing ("The first sound in pat is ___" with options "p", "t", "b" fails). Practice tests the contrast through meaning instead: a sentence where only one word of the pair fits ("He hit the ball with a ___": "bat", with "pat" as a wrong option). Each sentence uses one word of a pair, and its distractors include the other word of that pair, so hearing the sentence and building it tests the sound. Tips say how to make each sound, without claims about "your language".`,
    id: "en-en-a1-ielts-consonant-contrasts",
    userInput: {
      knownWords: [],
      learnerLanguage: "en",
      lessonCanDo: "Tell apart words that start with different consonants.",
      lessonDescription:
        "Initial consonant contrasts help you distinguish words such as “pat” and “bat” before the rest of a phrase unfolds.",
      lessonTitle: "Initial consonant contrasts",
      level: "A1–A2",
      targetLanguage: "en",
      unitCanDos: [
        "Distinguish consonant and vowel sounds that change a word",
        "Use endings, clusters and stress to identify spoken words",
      ],
      unitTitle: "Hearing the sounds in words",
    },
  },
];
