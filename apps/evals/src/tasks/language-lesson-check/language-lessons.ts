import { type LanguageLessonContent } from "@zoonk/ai/tasks/language/language-lesson";
import { type LanguageLessonCheckInput } from "./test-cases";

const italianGreetings: LanguageLessonCheckInput = {
  lesson: {
    practice: [
      {
        answer: "Buonasera",
        distractors: ["Buongiorno", "Buonanotte"],
        feedback:
          "Às oito da noite, ao chegar, diga “buonasera”. “Buonanotte” é só para se despedir antes de dormir.",
        question: "Você entra numa loja às oito da noite. O que diz?",
        template: "[BLANK], signora!",
      },
    ],
    sentences: [
      {
        distractors: ["sera", "grazie"],
        explanation: "“Signora” vem antes do sobrenome, como “senhora” em português.",
        romanization: null,
        sentence: "Buongiorno, signora Rossi",
        speakingPrompt: "Cumprimente a senhora Rossi de manhã.",
        translation: "Bom dia, senhora Rossi",
        translationDistractors: ["noite", "obrigada"],
      },
      {
        distractors: ["giorno", "grazie"],
        explanation:
          "“Come sta?” é a forma educada de perguntar como alguém está, para quem você não conhece bem.",
        romanization: null,
        sentence: "Buonasera, come sta?",
        speakingPrompt: null,
        translation: "Boa noite, como vai?",
        translationDistractors: ["dia", "onde"],
      },
      {
        distractors: ["sera", "notte"],
        explanation: "“A domani” quer dizer “até amanhã”.",
        romanization: null,
        sentence: "Arrivederci, a domani",
        speakingPrompt: "Despeça-se de alguém dizendo “até logo, até amanhã”.",
        translation: "Até logo, até amanhã",
        translationDistractors: ["noite", "bom"],
      },
    ],
    summary: [
      "“Buongiorno” cumprimenta de manhã e até o meio da tarde.",
      "“Buonasera, come sta?” cumprimenta à noite e pergunta, com educação, como a pessoa está.",
    ],
    tip: {
      examples: [
        { sentence: "Buongiorno, signore", translation: "Bom dia, senhor" },
        { sentence: "Buonasera, signora", translation: "Boa noite, senhora" },
      ],
      text: "Em italiano, “buongiorno” serve até o meio da tarde. Depois, use “buonasera”, ao chegar ou ao sair.",
      title: "“Buongiorno” e “buonasera”",
    },
    words: [
      {
        distractors: ["buonasera", "grazie", "prego"],
        note: null,
        pronunciation: "buon-DJÔR-no",
        romanization: null,
        tip: "O “gi” soa como o “dj” de “adjetivo”.",
        translation: "bom dia",
        word: "buongiorno",
      },
      {
        distractors: ["buongiorno", "grazie", "prego"],
        note: "Use ao chegar ou ao sair, a partir do meio da tarde. Para se despedir antes de dormir, diga “buonanotte”.",
        pronunciation: "buo-na-SÊ-ra",
        romanization: null,
        tip: null,
        translation: "boa noite",
        word: "buonasera",
      },
      {
        distractors: ["Dove sta?", "Quanto costa?", "Che ore sono?"],
        note: "É a forma educada, para quem você não conhece bem.",
        pronunciation: "CÔ-me STA",
        romanization: null,
        tip: null,
        translation: "Como vai? (a quem você não conhece bem)",
        word: "Come sta?",
      },
    ],
    writing: {
      answers: ["Buonasera, come sta?", "Buonasera, signora, come sta?"],
      keyPoints: ["Usa “buonasera”", "Usa “come sta”, a forma educada"],
      prompt: "Escreva para a senhora Rossi, à noite: “Boa noite, como a senhora está?”",
    },
  },
  writer: {
    learnerLanguage: "pt",
    lessonCanDo: "Cumprimentar alguém de manhã e à noite e perguntar como a pessoa está",
    lessonDescription: "Diga bom dia e boa noite e pergunte, com educação, como a pessoa está",
    lessonTitle: "Bom dia e boa noite",
    level: "A1",
    targetLanguage: "it",
    unitCanDos: ["Cumprimentar e se despedir", "Se apresentar"],
    unitTitle: "Primeiros encontros",
  },
};

const spanishSlowly: LanguageLessonCheckInput = {
  lesson: {
    practice: [
      {
        answer: "Puede",
        distractors: ["Puedes", "Puedo"],
        feedback:
          "With a doctor you just met, use “puede”, the polite form. “Puedes” is for friends, and “puedo” means “I can”.",
        question: "You're asking a doctor you just met to repeat something. Which word fits?",
        template: "¿[BLANK] repetir, por favor?",
      },
    ],
    sentences: [
      {
        distractors: ["sé", "quiero"],
        explanation: "“Perdón” is a polite way to get someone's attention or apologize.",
        romanization: null,
        sentence: "Perdón, no entiendo",
        speakingPrompt: "Apologize and tell a shop clerk you don't understand.",
        translation: "Sorry, I don't understand",
        translationDistractors: ["know", "want"],
      },
      {
        distractors: ["rápido", "comer"],
        explanation: "“Puede” is the polite form you use with someone you don't know.",
        romanization: null,
        sentence: "¿Puede hablar más despacio, por favor?",
        speakingPrompt: null,
        translation: "Can you speak more slowly, please?",
        translationDistractors: ["fast", "eat"],
      },
      {
        distractors: ["mañana", "gracias"],
        explanation: "“Otra vez” means “again”, literally “another time”.",
        romanization: null,
        sentence: "Otra vez, por favor",
        speakingPrompt: null,
        translation: "Again, please",
        translationDistractors: ["tomorrow", "thanks"],
      },
    ],
    summary: [
      "“¿Puede hablar más despacio?” politely asks someone to slow down.",
      "“¿Puede repetir?” and “Otra vez, por favor” ask someone to say it again.",
    ],
    tip: {
      examples: [
        { sentence: "¿Puede repetir, por favor?", translation: "Can you repeat that, please?" },
        { sentence: "¿Puede hablar más despacio?", translation: "Can you speak more slowly?" },
      ],
      text: "With someone you don't know, like a clerk or a doctor, ask with “¿Puede…?” and a verb in its basic form.",
      title: "Polite requests with “puede”",
    },
    words: [
      {
        distractors: ["más rápido", "más alto", "más tarde"],
        note: null,
        pronunciation: "mahs dehs-PAH-syoh",
        romanization: null,
        tip: null,
        translation: "more slowly",
        word: "más despacio",
      },
      {
        distractors: ["¿Puede pagar?", "¿Puede esperar?", "¿Puede venir?"],
        note: "It's the polite form, for someone you don't know.",
        pronunciation: "PWEH-deh rreh-peh-TEER",
        romanization: null,
        tip: "Roll the r at the start of “repetir”.",
        translation: "Can you repeat that? (to a stranger)",
        word: "¿Puede repetir?",
      },
      {
        distractors: ["otra cosa", "por favor", "más tarde"],
        note: null,
        pronunciation: "OH-trah BEHS",
        romanization: null,
        tip: "Say the v like a soft English b.",
        translation: "again",
        word: "otra vez",
      },
    ],
    writing: {
      answers: [
        "¿Puede hablar más despacio, por favor?",
        "¿Podría hablar más despacio, por favor?",
      ],
      keyPoints: ["Uses the polite “puede” or “podría”", "Uses “más despacio”"],
      prompt: "Write to a hotel receptionist: “Can you speak more slowly, please?”",
    },
  },
  writer: {
    learnerLanguage: "en",
    lessonCanDo: "Ask someone to repeat or speak more slowly",
    lessonDescription: "Ask a stranger to slow down or say it again",
    lessonTitle: "Can you speak more slowly?",
    level: "A1",
    targetLanguage: "es",
    unitCanDos: ["Greet people", "Ask for help when you don't understand"],
    unitTitle: "First conversations",
  },
};

const englishIntroductions: LanguageLessonCheckInput = {
  lesson: {
    practice: [
      {
        answer: "from",
        distractors: ["in", "at"],
        feedback: "“From” diz de onde você é. “In” diria onde você está agora.",
        question: "Complete para dizer que você é do Brasil.",
        template: "I'm [BLANK] Brazil",
      },
    ],
    sentences: [
      {
        distractors: ["your", "his"],
        explanation: "Em inglês, “my name is” vem antes do nome, como em português.",
        romanization: null,
        sentence: "My name is Ana",
        speakingPrompt: "Diga que seu nome é Ana.",
        translation: "Meu nome é Ana",
        translationDistractors: ["seu", "dele"],
      },
      {
        distractors: ["see", "thank"],
        explanation: "“Nice to meet you” é o que se diz ao conhecer alguém.",
        romanization: null,
        sentence: "Nice to meet you, Tom",
        speakingPrompt: null,
        translation: "Prazer em te conhecer, Tom",
        translationDistractors: ["ver", "obrigado"],
      },
      {
        distractors: ["in", "to"],
        explanation: "Use “from” para dizer de onde você é.",
        romanization: null,
        sentence: "I'm from Brazil",
        speakingPrompt: "Diga que você é do Brasil.",
        translation: "Eu sou do Brasil",
        translationDistractors: ["no", "para"],
      },
    ],
    summary: [
      "“My name is Ana” diz o seu nome.",
      "“I'm from Brazil” diz de onde você é.",
      "“Nice to meet you” responde quando alguém se apresenta.",
    ],
    tip: {
      examples: [
        { sentence: "I'm from Brazil", translation: "Eu sou do Brasil" },
        { sentence: "I'm from São Paulo", translation: "Eu sou de São Paulo" },
      ],
      text: "Para dizer de onde você é, use “I'm from” e o nome do país ou da cidade.",
      title: "Dizer de onde você é",
    },
    words: [
      {
        distractors: ["your name is", "his name is", "I'm from"],
        note: null,
        pronunciation: "mai NEIM iz",
        romanization: null,
        tip: null,
        translation: "meu nome é",
        word: "my name is",
      },
      {
        distractors: ["see you later", "thank you", "excuse me"],
        note: null,
        pronunciation: "NAIS tu MIT iu",
        romanization: null,
        tip: null,
        translation: "prazer em te conhecer",
        word: "nice to meet you",
      },
      {
        distractors: ["I'm going to", "I'm at", "I'm with"],
        note: null,
        pronunciation: "AIM FRAM",
        romanization: null,
        tip: "No “r” de “from”, a língua se curva para trás sem tocar o céu da boca.",
        translation: "eu sou de",
        word: "I'm from",
      },
    ],
    writing: {
      answers: [
        "My name is Ana, and I'm from Brazil.",
        "My name is Ana. I'm from Brazil.",
        "My name is Ana and I am from Brazil.",
      ],
      keyPoints: ["Usa “my name is”", "Usa “from” antes de “Brazil”"],
      prompt: "Escreva para um colega novo: “Meu nome é Ana e eu sou do Brasil.”",
    },
  },
  writer: {
    learnerLanguage: "pt",
    lessonCanDo: "Dizer seu nome e de onde você é",
    lessonDescription: "Apresente-se: diga seu nome e de onde você é",
    lessonTitle: "Prazer, meu nome é…",
    level: "A1",
    targetLanguage: "en",
    unitCanDos: ["Cumprimentar pessoas", "Se apresentar"],
    unitTitle: "Primeiros contatos",
  },
};

const italianPastWeather: LanguageLessonCheckInput = {
  lesson: {
    practice: [
      {
        answer: "pioveva",
        distractors: ["piove", "pioverà"],
        feedback: "Para descrever o tempo de ontem, use o imperfeito: “pioveva”.",
        question: "Como estava o tempo ontem à tarde?",
        template: "Ieri pomeriggio [BLANK] e siamo rimasti a casa",
      },
    ],
    sentences: [
      {
        distractors: ["piove", "caldo"],
        explanation:
          "O imperfeito “pioveva” descreve como estava o tempo, como “chovia” em português.",
        romanization: null,
        sentence: "Ieri pioveva e faceva freddo",
        speakingPrompt: "Conte que ontem chovia e fazia frio.",
        translation: "Ontem chovia e fazia frio",
        translationDistractors: ["chove", "calor"],
      },
      {
        distractors: ["c'è", "pioverà"],
        explanation: "“C'era il sole” é o jeito comum de dizer que fazia sol.",
        romanization: null,
        sentence: "Domenica c'era il sole",
        speakingPrompt: null,
        translation: "No domingo fazia sol",
        translationDistractors: ["faz", "choverá"],
      },
      {
        distractors: ["neve", "nevica"],
        explanation: "“Nevicava” é o imperfeito de “nevicare”, nevar.",
        romanization: null,
        sentence: "Sabato nevicava in montagna",
        speakingPrompt: null,
        translation: "No sábado nevava na montanha",
        translationDistractors: ["neva", "praia"],
      },
    ],
    summary: [
      "“Pioveva” diz que chovia.",
      "“Faceva freddo” diz que fazia frio.",
      "“C'era il sole” diz que fazia sol.",
    ],
    tip: {
      examples: [
        { sentence: "Ieri faceva caldo", translation: "Ontem fazia calor" },
        { sentence: "Lunedì pioveva", translation: "Na segunda chovia" },
      ],
      text: "Para descrever como estava o tempo num dia que passou, o italiano usa o imperfeito, como o português: “pioveva”, “faceva freddo”, “c'era il sole”.",
      title: "O imperfeito para o tempo",
    },
    words: [
      {
        distractors: ["nevicava", "piove", "pioverà"],
        note: null,
        pronunciation: "pio-VÊ-va",
        romanization: null,
        tip: null,
        translation: "chovia",
        word: "pioveva",
      },
      {
        distractors: ["faceva caldo", "fa freddo", "farà freddo"],
        note: null,
        pronunciation: "fa-TCHÊ-va FRÊD-do",
        romanization: null,
        tip: "Segure o “d” duplo de “freddo” um instante a mais.",
        translation: "fazia frio",
        word: "faceva freddo",
      },
      {
        distractors: ["c'è il sole", "c'era la luna", "ci sarà il sole"],
        note: null,
        pronunciation: "TCHÉ-ra il SÔ-le",
        romanization: null,
        tip: null,
        translation: "fazia sol",
        word: "c'era il sole",
      },
    ],
    writing: {
      answers: ["Ieri faceva freddo e pioveva.", "Ieri pioveva e faceva freddo."],
      keyPoints: ["Usa o imperfeito “faceva” e “pioveva”"],
      prompt: "Escreva para uma amiga: “Ontem fazia frio e chovia.”",
    },
  },
  writer: {
    learnerLanguage: "pt",
    lessonCanDo: "Dizer como estava o tempo ontem ou na semana passada",
    lessonDescription: "Conte como estava o tempo num dia que já passou: chuva, sol, frio",
    lessonTitle: "Como estava o tempo",
    level: "A2",
    targetLanguage: "it",
    unitCanDos: ["Falar do tempo de hoje", "Contar como foi um passeio"],
    unitTitle: "O tempo e os passeios",
  },
};

export const LANGUAGE_LESSONS = {
  englishIntroductions,
  italianGreetings,
  italianPastWeather,
  spanishSlowly,
};

export function plantSlip(
  base: LanguageLessonCheckInput,
  edit: (lesson: LanguageLessonContent) => LanguageLessonContent,
): LanguageLessonCheckInput {
  return { ...base, lesson: edit(structuredClone(base.lesson)) };
}

export function patchAt<Item>(items: readonly Item[], index: number, patch: Partial<Item>): Item[] {
  return items.map((item, position) => (position === index ? { ...item, ...patch } : item));
}
