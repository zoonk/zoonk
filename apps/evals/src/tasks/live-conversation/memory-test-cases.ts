import { type TestCase } from "@/lib/types";
import { type LiveConversationInput } from "./run-call";
import { type LiveConversationExpected } from "./scorer";
import { MARCOS, RENTING_PLAN, type Scenario, getMarcosScenario } from "./test-cases";

const TOM = "Tom, 29, an American app designer who moved to São Paulo for a new job.";

const FRIEND_SCENARIO: Scenario = {
  character: { name: "Emma", place: "Toronto", role: "amiga" },
  characterBrief:
    "You are Emma, Marcos's friend from his English class in Toronto. You call to plan Saturday. Facts: you'd like to go to St. Lawrence Market on Saturday morning; you can meet at 10am at Union Station; you have a family lunch at 1pm. Speak simply and slowly.",
  hints: ["Yes, I'm free on Saturday.", "What do you want to do?", "What time can we meet?"],
  objectives: [
    { description: "Combinar o que vocês vão fazer no sábado", label: "Choose a plan" },
    { description: "Combinar a hora e o lugar para se encontrar", label: "Agree on a time" },
  ],
  openingLine: "Hi Marcos! It's Emma. Are you free on Saturday?",
  situation: "Sua amiga Emma, da aula de inglês, liga para combinar um passeio no sábado.",
  title: "Combinar o sábado com uma amiga",
};

const BARISTA_SCENARIO: Scenario = {
  character: { name: "Juliana", place: "Café Paulista, Vila Madalena", role: "barista" },
  characterBrief:
    "Juliana, a friendly barista at a small café in Vila Madalena, São Paulo. Menu: café coado R$8, cappuccino R$12, pão de queijo R$6 or three for R$15, bolo de cenoura R$10. Card and Pix accepted; no change for cash today.",
  hints: [
    "Eu queria um cappuccino, por favor.",
    "O que é pão de queijo?",
    "Posso pagar com cartão?",
  ],
  objectives: [
    { description: "Order a drink and something to eat.", label: "Fazer o pedido" },
    { description: "Ask how much it is and pay.", label: "Pagar" },
  ],
  openingLine: "Oi, boa tarde! O que vai ser hoje?",
  situation: "You're at a café in São Paulo. Order something to drink and eat, and pay.",
  title: "Order at a café",
};

const HOST_SCENARIO: Scenario = {
  character: { name: "Carmen", place: "Coyoacán, Ciudad de México", role: "host mother" },
  characterBrief:
    "Carmen, 55, a warm host mother in Coyoacán, Mexico City. The learner will stay with her family during a four-week Spanish course that starts next Monday; you've exchanged messages but never spoken. Facts: she lives with her husband Luis and their cat Nube; dinner is at 8pm; she can pick the learner up at the airport. Speak very slowly and simply.",
  hints: ["Hola, Carmen. Estoy bien.", "Llego el domingo.", "¿A qué hora es la cena?"],
  objectives: [
    { description: "Say what day and time you arrive.", label: "Decir cuándo llegas" },
    { description: "Ask what time dinner is.", label: "Preguntar por la cena" },
  ],
  openingLine: "¡Hola! Soy Carmen. ¿Cómo estás?",
  situation:
    "Before your Spanish course in Mexico City, you call Carmen, your host mother, to say when you arrive.",
  title: "Call your host family",
};

const COWORKER_SCENARIO: Scenario = {
  character: { name: "Rafael", place: "Estúdio Pixel, São Paulo", role: "coworker" },
  characterBrief:
    "Rafael, a designer on the learner's team at Estúdio Pixel in São Paulo; they've worked together for two months. He calls because the client meeting moved from Thursday to Wednesday at 10am, on video, and he can't make it, so he needs the learner to present the new app screens. The slides are in the team folder, and he'll email the client's notes tonight.",
  hints: ["Claro, pode falar.", "Que horas é a reunião?", "Onde estão os slides?"],
  objectives: [
    { description: "Agree to present in his place.", label: "Aceitar a apresentação" },
    {
      description: "Find out the day and time and where the slides are.",
      label: "Confirmar os detalhes",
    },
  ],
  openingLine: "Oi, Tom! Tudo bem? Tem um minutinho? Preciso de uma ajuda.",
  situation: "Rafael, your coworker, calls to ask you a favor about a client meeting.",
  title: "Help a coworker",
};

/** The scene writer's `pt-en-a2-weekend-plans` output, unedited, so this call tests a written scene. */
const WRITTEN_FRIEND_SCENARIO: Scenario = {
  character: { name: "Emma", place: "Lakeview Coffee", role: "amiga" },
  characterBrief:
    "You are Emma, the learner's friend. You know each other and are chatting about weekend plans. You are warm and easygoing. Speak at A2 level, using short sentences, common words, and simple polite requests. The learner wants to invite you for coffee and suggest a day, time, and place. You cannot meet Saturday at 10:00 a.m., but you can meet Sunday at 11:00 a.m. This is the small friendly twist: if the learner suggests Saturday at 10:00 a.m., say that time does not work and offer Sunday at 11:00 a.m. If they suggest another time, explain that Sunday at 11:00 a.m. is the time you can meet this weekend. If the learner suggests Lakeview Coffee, agree to that place. It is at 1234 W Belmont Ave, Chicago, IL 60657. You are happy to get coffee there, and there is nothing special to bring. Do not choose the activity, day, time, or place for the learner before they suggest them. After the learner accepts or declines your alternative, respond naturally and wrap up the conversation warmly.",
  hints: [
    "Would you like to get coffee with me?",
    "How about Saturday at 10 a.m.?",
    "Let's meet at Lakeview Coffee.",
    "Sunday at 11 works for me.",
  ],
  objectives: [
    { description: "Convide Emma para tomar um café com você.", label: "Invite Emma for coffee" },
    {
      description: "Sugira um dia, horário e lugar para vocês se encontrarem.",
      label: "Suggest a time and place",
    },
    {
      description: "Aceite ou recuse a sugestão de Emma para domingo às 11 da manhã.",
      label: "Accept Emma's alternative",
    },
  ],
  openingLine: "Hey, it's Emma! Do you have plans this weekend?",
  situation:
    "Você está conversando com sua amiga Emma sobre o fim de semana. Convide-a para tomar um café e combinem um dia, horário e lugar.",
  title: "Convide uma amiga para um café",
};

/**
 * Calls whose character gets one thing the learner shared before (`learnerNote`, in the learner's
 * own language, as memory writes it). A friend, coworker or host mentions it; a stranger may only
 * ask; an officer has no reason to. The simulated learner knows the fact but only talks about
 * it when asked. The landlord call is the `pt-en-a2-renting` case plus a note.
 */
export const MEMORY_TEST_CASES: TestCase<LiveConversationExpected, LiveConversationInput>[] = [
  {
    expectations: `Emma, Marcos's friend from his English class, calls him (A2, Brazilian Portuguese speaker) in simple US English to plan Saturday. She knows him, so she mentions his job interview on Friday once, briefly and in simple English, then goes back to planning. She can't know whether Friday has passed, so she asks in a way that fits either (how it's going), never as if it already happened ("How was your interview?") or is still ahead ("Good luck on Friday!"). She never says how she knows, never quotes the note in Portuguese, and lets him choose the plan and agree on a time.`,
    expected: { objectivesMet: ["Choose a plan", "Agree on a time"] },
    id: "pt-en-a2-memory-friend",
    userInput: {
      call: {
        kind: "unit",
        learnerLanguage: "pt",
        learnerNote: "Tem uma entrevista de emprego numa empresa de software na sexta-feira",
        level: "A2",
        scenario: FRIEND_SCENARIO,
        targetLanguage: "en",
      },
      learner: {
        about: `${MARCOS} He has a job interview at a software company on Friday.`,
        plan: [
          "Say yes, you're free on Saturday, and ask what she wants to do.",
          "Say the market is a good idea, with an A2 mistake (like 'I like very much markets').",
          "Ask what time and where you meet.",
          "Agree to her time and place.",
        ],
      },
    },
  },
  {
    expectations: `Linda, a Toronto landlord, talks with Marcos (A2, Brazilian Portuguese speaker) for the first time, in simple US English. She runs the call exactly as without a note (availability, rent, deposit, Saturday viewing) and lets him book the viewing. She has never met him, so she never acts as if she knows about his dog: at most she asks one general question such as whether he has pets, early in the call rather than as it wraps up, and she never names a dog before he does.`,
    expected: { objectivesMet: ["Is it available?", "Ask about the deposit", "Book a viewing"] },
    id: "pt-en-a2-memory-landlord",
    userInput: {
      call: {
        kind: "unit",
        learnerLanguage: "pt",
        learnerNote: "Tem um cachorro chamado Thor",
        level: "A2",
        scenario: getMarcosScenario("renting"),
        targetLanguage: "en",
      },
      learner: { about: `${MARCOS} They have a dog named Thor.`, plan: RENTING_PLAN },
    },
  },
  {
    expectations: `Juliana, a barista in São Paulo, serves Tom (B1, US English speaker) in Brazilian Portuguese. She has never met him, so she never acts as if she knows he just moved to São Paulo: at most she asks one natural question such as whether he's new around here, in Portuguese, and then goes back to his order. She gives prices from her notes and lets him order and pay.`,
    expected: { objectivesMet: ["Fazer o pedido", "Pagar"] },
    id: "en-pt-b1-memory-barista",
    userInput: {
      call: {
        kind: "unit",
        learnerLanguage: "en",
        learnerNote: "Moved to São Paulo three weeks ago for a new job",
        level: "B1",
        scenario: BARISTA_SCENARIO,
        targetLanguage: "pt",
      },
      learner: {
        about: `${TOM} He moved three weeks ago.`,
        plan: [
          "Order a cappuccino and ask what pão de queijo is.",
          "Order three pão de queijo.",
          "Ask how much it is.",
          "Say you'll pay by card, and hand her your card.",
          "Say thanks and that it smells great.",
        ],
      },
    },
  },
  {
    expectations: `An immigration officer at Toronto Pearson talks with Marcos (A2, Brazilian Portuguese speaker) in simple US English. Marcos's football team has nothing to do with his arrival, so the officer leaves the note out entirely: no question about football or Flamengo. He asks why Marcos is in Canada, how long he'll stay and where he'll live.`,
    expected: { objectivesMet: ["Explain your visit", "Say where you'll live"] },
    id: "pt-en-a2-memory-officer",
    userInput: {
      call: {
        kind: "unit",
        learnerLanguage: "pt",
        learnerNote: "Torce para o Flamengo e joga futebol aos domingos",
        level: "A2",
        scenario: getMarcosScenario("arriving"),
        targetLanguage: "en",
      },
      learner: {
        about: `${MARCOS} He supports Flamengo and plays football on Sundays.`,
        plan: [
          "Say you come to Canada for work and have a work permit, with an A2 tense mistake (like 'I come to Canada for work').",
          "Say you'll stay for two years, maybe more.",
          "Say you will live with your wife in an apartment in Scarborough.",
        ],
      },
    },
  },
  {
    expectations: `Carmen, a host mother in Mexico City, talks with Sam (A1, US English speaker) in very short, slow, simple Spanish (about 3 to 6 words a sentence). She has exchanged messages with Sam, so she asks about his sister Lucy once, in a few simple Spanish words, then goes back to his arrival. She never says how she knows and never uses English for it. She lets Sam say when he arrives and ask about dinner.`,
    expected: { objectivesMet: ["Decir cuándo llegas", "Preguntar por la cena"] },
    id: "en-es-a1-memory-host",
    userInput: {
      call: {
        kind: "unit",
        learnerLanguage: "en",
        learnerNote: "Has a younger sister, Lucy, who is 10",
        level: "A1",
        scenario: HOST_SCENARIO,
        targetLanguage: "es",
      },
      learner: {
        about:
          "Sam, 24, from Chicago, a beginner in Spanish who starts a course in Mexico City next week. He has a younger sister, Lucy, who is 10.",
        plan: [
          "Say hello, you're fine, and that you're Sam.",
          "Say you arrive on Sunday at six in the evening.",
          "Ask what time dinner is.",
          "Say thank you and see you on Sunday.",
        ],
      },
    },
  },
  {
    expectations: `Rafael, Tom's coworker, calls him (B1, US English speaker) in Brazilian Portuguese to ask him to present at Wednesday's client meeting. They work together, so he mentions Tom's half marathon training once, briefly (asking how the training is going), but the favor stays the point of the call. He never says how he knows, gives the details from his notes when Tom asks and lets Tom agree.`,
    expected: { objectivesMet: ["Aceitar a apresentação", "Confirmar os detalhes"] },
    id: "en-pt-b1-memory-coworker",
    userInput: {
      call: {
        kind: "unit",
        learnerLanguage: "en",
        learnerNote: "Is training for a half marathon in December",
        level: "B1",
        scenario: COWORKER_SCENARIO,
        targetLanguage: "pt",
      },
      learner: {
        about: `${TOM} He's training for a half marathon in December.`,
        plan: [
          "Say sure, you have a minute, and ask what he needs.",
          "Say yes, you can present, and ask what day and time the meeting is.",
          "Ask where the slides are.",
          "Say thanks, it's all fine, and wish him a good week.",
        ],
      },
    },
  },
  {
    expectations: `Emma, a friend, talks with Júlia (A2, Brazilian Portuguese speaker) in simple US English about weekend plans, in a scene the scene writer made. She knows Júlia, so she asks about her cat Pipoca once, early in the call, briefly and in simple English, then goes back to the plan. She never says how she knows, never quotes the note in Portuguese, and lets Júlia invite her and suggest a time and place, offering Sunday at 11 when Saturday at 10 doesn't work.`,
    expected: {
      objectivesMet: [
        "Invite Emma for coffee",
        "Suggest a time and place",
        "Accept Emma's alternative",
      ],
    },
    id: "pt-en-a2-memory-written-friend",
    userInput: {
      call: {
        kind: "unit",
        learnerLanguage: "pt",
        learnerNote: "Adotou uma gata chamada Pipoca",
        level: "A2",
        scenario: WRITTEN_FRIEND_SCENARIO,
        targetLanguage: "en",
      },
      learner: {
        about:
          "Júlia, 27, a Brazilian graphic designer who has lived in Chicago for a year. She adopted a cat named Pipoca.",
        plan: [
          "Say you have no plans yet, and invite Emma for coffee, with an A2 mistake (like 'You want drink coffee with me?').",
          "Suggest Saturday at ten at Lakeview Coffee.",
          "Say Sunday at eleven is fine.",
          "Say great, and see you on Sunday.",
        ],
      },
    },
  },
];
