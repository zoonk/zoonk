import { type TestCase } from "@/lib/types";
import { type TeachingChaptersParams } from "@zoonk/ai/tasks/curriculum/teaching-chapters";
import { type TeachingChaptersExpected } from "./scorer";

type TeachingChaptersTestCase = TestCase<TeachingChaptersExpected, TeachingChaptersParams>;

function skill(key: string, name: string, description: string, taughtIn?: number[]) {
  return { description, key, name, ...(taughtIn ? { taughtIn } : {}) };
}

/** The Italian course's first beginner band on the PR preview (29 Oct 2026). */
const ITALIAN_BEGINNER = [
  {
    lessons: [
      "Vogais e sílaba tônica",
      "Sons de c e g",
      "Cumprimentos e despedidas",
      "Expressões de cortesia",
      "Pedidos de repetição e esclarecimento",
    ],
    title: "Primeiros contatos e pronúncia",
  },
  {
    lessons: [
      "Nomes e apresentações",
      "Origem e lugar onde mora",
      "Idade e ocupação",
      "Perguntas de acompanhamento",
      "Tratamento com tu e Lei",
    ],
    title: "Conhecer pessoas",
  },
  {
    lessons: [
      "Família e amizades",
      "Adjetivos possessivos",
      "Artigos e concordância na descrição",
      "Relações entre pessoas",
    ],
    title: "Pessoas próximas",
  },
  {
    lessons: [
      "Horas e partes do dia",
      "Presente dos verbos regulares",
      "Verbos reflexivos na rotina",
      "Frequência e hábitos",
      "Horários e mudanças na rotina",
    ],
    title: "Rotina e horários",
  },
  {
    lessons: [
      "Atividades de lazer",
      "Preferências com piacere",
      "Negação com non",
      "Interesses em comum",
    ],
    title: "Lazer e interesses",
  },
  {
    lessons: [
      "Convites informais",
      "Respostas a convites",
      "Alternativas de local e horário",
      "Confirmação de encontros",
    ],
    title: "Convites e encontros",
  },
  {
    lessons: [
      "Mensagens sobre planos",
      "Avisos de atraso",
      "Pedidos por mensagem",
      "Confirmações por mensagem",
    ],
    title: "Mensagens do dia a dia",
  },
  {
    lessons: [
      "Abertura de ligações",
      "Motivo da ligação",
      "Esclarecimentos por telefone",
      "Encerramento e próximos passos",
    ],
    title: "Assuntos simples por telefone",
  },
  {
    lessons: [
      "Endereço e localização da moradia",
      "Ambientes com c'è e ci sono",
      "Objetos e preposições de lugar",
      "Problemas domésticos",
      "Pedidos para a casa",
    ],
    title: "Moradia e necessidades domésticas",
  },
  {
    lessons: [
      "Lugares da cidade",
      "Direções e movimentos",
      "Pontos de referência",
      "Linhas e paradas na cidade",
      "Confirmação de trajetos",
    ],
    title: "Caminhos pela cidade",
  },
  {
    lessons: [
      "Partidas e chegadas",
      "Compra de passagens",
      "Conferência do embarque",
      "Conexões e trocas",
      "Atrasos no transporte",
    ],
    title: "Viagens curtas de transporte",
  },
  {
    lessons: [
      "Recomendações do cardápio",
      "Ingredientes e dúvidas do cardápio",
      "Pedido de comida e bebida",
      "Alterações no pedido",
      "Conta e cobrança",
      "Pagamento no restaurante",
    ],
    title: "Comida em estabelecimentos",
  },
  {
    lessons: [
      "Preços e números",
      "Características e disponibilidade",
      "Comparação de produtos",
      "Experimentar antes de comprar",
      "Trocas simples",
    ],
    title: "Compras e trocas",
  },
  {
    lessons: [
      "Datas e hóspedes",
      "Disponibilidade e reserva",
      "Condições da hospedagem",
      "Chegada e check-in",
      "Pedidos durante a estadia",
    ],
    title: "Reserva e hospedagem",
  },
  {
    lessons: [
      "Dores e partes do corpo",
      "Sintomas comuns",
      "Duração dos sintomas",
      "Ajuda na farmácia",
      "Pedido de ajuda urgente",
    ],
    title: "Sintomas e pedidos de ajuda",
  },
  {
    lessons: [
      "Marcadores de tempo recente",
      "Passato prossimo com avere",
      "Passato prossimo com essere",
      "Particípios irregulares frequentes",
      "Sequência de acontecimentos",
      "Perguntas sobre uma experiência recente",
    ],
    title: "Acontecimentos recentes",
  },
];

/** The beginner band after another learner's plan had its restaurant and lodging topics continued. */
const ITALIAN_BEGINNER_CONTINUED = [
  ...ITALIAN_BEGINNER.slice(0, 12),
  {
    lessons: [
      "Alergias e intolerâncias no pedido",
      "Pratos sem um ingrediente",
      "Prato errado ou frio",
      "Reclamação educada ao garçom",
      "Divisão da conta entre amigos",
    ],
    title: "Restrições alimentares e problemas com o pedido",
  },
  ...ITALIAN_BEGINNER.slice(12, 14),
  {
    lessons: [
      "Quarto com defeito",
      "Barulho e troca de quarto",
      "Cobranças indevidas na conta",
      "Extensão da estadia",
      "Check-out com pendências",
    ],
    title: "Problemas durante a estadia",
  },
  ...ITALIAN_BEGINNER.slice(14),
];

/** The Italian course's intermediate band on the PR preview (30 Oct 2026). */
const ITALIAN_INTERMEDIATE = [
  {
    lessons: [
      "Imperfetto como pano de fundo",
      "Imperfetto e passato prossimo na narrativa",
      "Trapassato prossimo",
      "Sequência temporal em relatos",
      "Passato remoto na leitura",
    ],
    title: "O passado em narrativas",
  },
  {
    lessons: [
      "Relatos detalhados de viagem",
      "Relatos de experiências de estudo",
      "Anedotas e imprevistos",
      "Expectativa e resultado pessoal",
      "Perguntas de acompanhamento em relatos",
      "Detalhe e ritmo na conversa",
    ],
    title: "Relatos de experiências pessoais",
  },
  {
    lessons: [
      "Pronomes de objeto combinados",
      "O pronome ci",
      "O pronome ne",
      "Pronomes com o imperativo",
      "Pronomes relativos che e cui",
      "Particípio passado e pronome de objeto",
    ],
    title: "Referências e pronomes",
  },
  {
    lessons: [
      "Indicativo e congiuntivo nas opiniões",
      "Congiuntivo presente",
      "Congiuntivo passato",
      "Congiuntivo imperfetto",
      "Congiuntivo trapassato",
      "Congiuntivo em concessões e referências indefinidas",
    ],
    title: "Opiniões e dúvidas com congiuntivo",
  },
  {
    lessons: [
      "Condições reais com se",
      "Hipóteses irreais no presente",
      "Hipóteses irreais no passado",
      "Hipóteses mistas",
      "Conselhos com condizionale",
      "Alternativas e arrependimentos",
    ],
    title: "Hipóteses e consequências",
  },
  {
    lessons: [
      "Futuro semplice em planos e previsões",
      "Futuro anteriore",
      "Futuro de conjectura",
      "Discurso indireto e mudança de perspectiva",
      "Futuro no passado",
    ],
    title: "Planos, conjecturas e discurso indireto",
  },
  {
    lessons: [
      "Opinião e justificativa",
      "Exemplos em argumentos",
      "Conectores de causa e consequência",
      "Concessão e contraponto",
      "Ressalvas e graus de certeza",
    ],
    title: "Argumentação em italiano",
  },
  {
    lessons: [
      "Tomada de turno",
      "Pedidos de esclarecimento",
      "Reformulação para confirmar sentido",
      "Discordância em conversas",
      "Paráfrase na fala espontânea",
      "Mudança e retomada de assunto",
    ],
    title: "Conversas espontâneas",
  },
  {
    lessons: [
      "Encadeamento na fala italiana",
      "Entonação e intenção",
      "Ideia central em falas longas",
      "Fontes e incerteza em áudio",
      "Variação regional na escuta",
    ],
    title: "Compreensão do italiano falado",
  },
  {
    lessons: [
      "Avisos e instruções públicas",
      "Estrutura de notícias",
      "Citações e atribuição de fontes",
      "Fatos e avaliações na leitura",
      "Vocabulário desconhecido em contexto",
    ],
    title: "Leitura de textos informativos",
  },
  {
    lessons: [
      "Solicitações formais por escrito",
      "Reclamações e pedidos de solução",
      "Parágrafos argumentativos",
      "Registro em mensagens escritas",
      "Rascunhos em italiano com IA",
      "Revisão de textos gerados por IA",
    ],
    title: "Escrita e revisão de textos",
  },
  {
    lessons: [
      "Trajetória escolar brasileira em italiano",
      "Requisitos e avaliação de cursos",
      "Experiência profissional e responsabilidades",
      "Condições e compromissos",
      "Imprevistos em estudo e trabalho",
    ],
    title: "Estudo e trabalho em italiano",
  },
];

/** The German course's first beginner band on the PR preview (29 Oct 2026). */
const GERMAN_BEGINNER = [
  {
    lessons: [
      "German sounds and letter combinations",
      "German vowel combinations",
      "German consonant combinations",
      "Greetings and forms of address",
      "Giving and asking for names",
      "Where you live",
      "Where you are from",
      "Farewells and polite responses",
    ],
    title: "First conversations",
  },
  {
    lessons: [
      "Numbers through one hundred",
      "Spelling names aloud",
      "Giving an address",
      "Phone numbers and email addresses",
      "Asking for repetition",
      "Checking what you heard",
    ],
    title: "Contact details and clarification",
  },
  {
    lessons: [
      "Family words and noun gender",
      "Mein, meine, and family relationships",
      "Questions about family",
      "Houses and apartments",
      "Rooms and es gibt",
      "Furniture and household objects",
    ],
    title: "Family and home",
  },
  {
    lessons: [
      "Asking and telling time",
      "Days and time expressions",
      "Present-tense verbs for routines",
      "Separable verbs in daily routines",
      "Questions about daily schedules",
      "Months and calendar dates",
      "Opening hours",
    ],
    title: "Daily routines and schedules",
  },
  {
    lessons: [
      "Asking where a place is",
      "Straight ahead and turning",
      "Landmarks and nearby locations",
      "Choosing a transit line",
      "Stops and departure points",
      "Buying a local transit ticket",
    ],
    title: "Directions and local transport",
  },
  {
    lessons: [
      "Café menu words",
      "Ordering with ich möchte",
      "Preferences and the bill",
      "Finding products in a store",
      "Items and quantities",
      "Prices and payment",
    ],
    title: "Cafés and everyday shopping",
  },
  {
    lessons: [
      "Room availability",
      "Dates and length of stay",
      "Reading a booking confirmation",
      "Price and cancellation terms",
      "Giving check-in details",
      "Keys, rooms, and checkout instructions",
    ],
    title: "Short stays and check-in",
  },
  {
    lessons: [
      "Hobbies with gern",
      "Questions about hobbies",
      "Making an invitation",
      "Accepting and declining invitations",
      "Agreeing where and when to meet",
      "Choosing a weekend activity",
      "Coordinating weekend availability",
    ],
    title: "Hobbies, invitations, and plans",
  },
  {
    lessons: [
      "Reading short personal messages",
      "Replying to a personal message",
      "Opening a phone call",
      "Brief responses on the phone",
      "Explaining a delay",
      "Rescheduling a meeting",
    ],
    title: "Messages, calls, and changed plans",
  },
  {
    lessons: [
      "Body parts and basic symptoms",
      "Saying where it hurts",
      "Booking an appointment",
      "Confirming an appointment",
      "How long symptoms have lasted",
      "Basic clinic instructions",
      "Medicine timing and frequency",
      "Dosage and warning instructions",
    ],
    title: "Appointments, clinics, and pharmacies",
  },
  {
    lessons: [
      "Past outings with sein",
      "Past activities with haben",
      "Sequencing a recent outing",
      "Questions about recent activities",
      "Weather in casual conversation",
      "Keeping a casual chat going",
    ],
    title: "Recent outings and casual chat",
  },
  {
    lessons: [
      "Asking about a train route",
      "Train transfers",
      "Train fares",
      "Train delays",
      "Getting help when lost or stranded",
      "Reporting a missing travel item",
    ],
    title: "Train journeys and travel problems",
  },
  {
    lessons: [
      "Describing food preferences",
      "Asking about ingredients",
      "Explaining a food restriction",
      "Describing a meal problem",
      "Requesting a restaurant solution",
    ],
    title: "Food needs and restaurant problems",
  },
  {
    lessons: [
      "Sizes and colors",
      "Comparative forms for shopping",
      "Checking product features",
      "Giving a reason for a purchase decision",
      "Reasons for a return",
      "Exchanges and refunds",
    ],
    title: "Product choices and returns",
  },
  {
    lessons: [
      "Reading an apartment listing",
      "Asking about rent",
      "Apartment location and rooms",
      "Arranging a viewing",
      "Reporting a household fault",
      "Describing a fault's effects",
      "Scheduling a repair visit",
    ],
    title: "Apartment inquiries and home repairs",
  },
  {
    lessons: [
      "Occupations and fields of study",
      "Work and study tasks",
      "Work and study schedules",
      "Email subject lines and greetings",
      "Writing an information request",
      "Replying to a routine request",
    ],
    title: "Work, studies, and routine emails",
  },
];

/** Skills later guests' graphs asked for, which the preview wrote again as new chapters. */
export const TEST_CASES: TeachingChaptersTestCase[] = [
  {
    expected: {
      calls: { chapters: [8] },
      directions: { chapters: [10] },
      lost: { chapters: [15, null] },
      restaurant: { chapters: [12] },
      routine: { chapters: [4] },
      stay: { chapters: [14] },
      symptoms: { chapters: [15] },
      weather: { chapters: [null] },
    },
    id: "pt-italian-beginner-band-repeats",
    userInput: {
      chapters: ITALIAN_BEGINNER,
      courseTitle: "Italiano",
      language: "pt",
      level: "beginner",
      skills: [
        skill(
          "stay",
          "Hospedar-se em um hotel",
          "Confirmar a reserva, fazer o check-in e perguntar pelos serviços da hospedagem.",
        ),
        skill(
          "calls",
          "Resolver um assunto breve por telefone",
          "Abrir uma ligação, dizer o motivo, pedir repetição e confirmar os dados ouvidos.",
        ),
        skill(
          "symptoms",
          "Descrever sintomas em uma consulta",
          "Dizer onde dói e há quanto tempo, e entender orientações simples de cuidado.",
        ),
        skill(
          "routine",
          "Contar a rotina e os compromissos do dia",
          "Dizer horários, frequência e compromissos de um dia comum.",
        ),
        skill(
          "restaurant",
          "Pedir uma refeição em um restaurante",
          "Escolher no cardápio, tirar dúvidas sobre ingredientes, pedir e pagar a conta.",
        ),
        skill(
          "directions",
          "Pedir e seguir indicações na cidade",
          "Perguntar como chegar a um lugar e acompanhar um percurso explicado.",
        ),
        skill(
          "weather",
          "Falar do tempo e mudar planos conforme a previsão",
          "Descrever as condições do tempo, entender uma previsão simples e ajustar atividades.",
        ),
        skill(
          "lost",
          "Pedir ajuda depois de perder um objeto ou sofrer um acidente",
          "Descrever o objeto perdido ou o acidente e dizer onde você está para receber ajuda.",
        ),
      ],
    },
  },
  {
    expected: {
      allergy: { chapters: [13] },
      calls: { chapters: [null] },
      directions: { chapters: [null] },
      restaurant: { chapters: [13] },
      stay: { chapters: [16] },
      symptoms: { chapters: [null] },
      weather: { chapters: [null] },
    },
    id: "pt-italian-beginner-band-continued",
    userInput: {
      chapters: ITALIAN_BEGINNER_CONTINUED,
      courseTitle: "Italiano",
      language: "pt",
      level: "beginner",
      skills: [
        skill(
          "restaurant",
          "Pedir uma refeição em um restaurante",
          "Escolher no cardápio, tirar dúvidas sobre ingredientes, pedir e pagar a conta.",
          [12],
        ),
        skill(
          "stay",
          "Hospedar-se em um hotel",
          "Confirmar a reserva, fazer o check-in e perguntar pelos serviços da hospedagem.",
          [15],
        ),
        skill(
          "calls",
          "Resolver um assunto breve por telefone",
          "Abrir uma ligação, dizer o motivo, pedir repetição e confirmar os dados ouvidos.",
          [8],
        ),
        skill(
          "directions",
          "Pedir e seguir indicações na cidade",
          "Perguntar como chegar a um lugar e acompanhar um percurso explicado.",
          [10],
        ),
        skill(
          "symptoms",
          "Descrever sintomas em uma consulta",
          "Dizer onde dói e há quanto tempo, e entender orientações simples de cuidado.",
          [17],
        ),
        skill(
          "allergy",
          "Explicar uma alergia ao pedir comida",
          "Dizer a que você é alérgico, perguntar pelos ingredientes e pedir um prato sem eles.",
        ),
        skill(
          "weather",
          "Falar do tempo e mudar planos conforme a previsão",
          "Descrever as condições do tempo, entender uma previsão simples e ajustar atividades.",
        ),
      ],
    },
  },
  {
    expected: {
      argue: { chapters: [7] },
      complaint: { chapters: [11] },
      doubts: { chapters: [4] },
      interview: { chapters: [12, null] },
      story: { after: [1, 2], chapters: [2, null] },
    },
    id: "pt-italian-intermediate-placed-learner",
    userInput: {
      chapters: ITALIAN_INTERMEDIATE,
      courseTitle: "Italiano",
      language: "pt",
      level: "intermediate",
      skills: [
        skill(
          "story",
          "Contar um relato pessoal com contexto e um ponto de virada",
          "Dar o contexto de uma história vivida, escolher os detalhes e levar o ouvinte até o acontecimento decisivo.",
        ),
        skill(
          "argue",
          "Defender uma opinião com argumentos",
          "Justificar uma opinião com razões e exemplos e responder a quem pensa diferente.",
        ),
        skill(
          "doubts",
          "Expressar opiniões e dúvidas com o congiuntivo",
          "Usar o congiuntivo para dar opiniões, expressar dúvidas e fazer avaliações.",
        ),
        skill(
          "complaint",
          "Escrever uma reclamação formal",
          "Escrever um e-mail formal que explica um problema e pede uma solução.",
        ),
        skill(
          "interview",
          "Participar de uma entrevista de emprego",
          "Falar da sua formação e experiência profissional e responder às perguntas do entrevistador.",
        ),
      ],
    },
  },
  {
    expected: {
      allergies: { chapters: [13] },
      intercity: { chapters: [12] },
      package: { chapters: [null] },
      past: { chapters: [11] },
      phone: { chapters: [9] },
      sounds: { chapters: [1, 2] },
      symptoms: { chapters: [10] },
      transit: { chapters: [5] },
    },
    id: "en-german-beginner-band-repeats",
    userInput: {
      chapters: GERMAN_BEGINNER,
      courseTitle: "German",
      language: "en",
      level: "beginner",
      skills: [
        skill(
          "sounds",
          "Pronounce German sounds and ask for clarification",
          "Produce key vowel and consonant sounds and ask someone to repeat or explain a word.",
        ),
        skill(
          "phone",
          "Make a short phone call clearly",
          "Identify yourself, say why you're calling, confirm the details you hear and close the call.",
        ),
        skill(
          "symptoms",
          "Describe health symptoms",
          "Say where it hurts, how you feel and when the symptoms began.",
        ),
        skill(
          "transit",
          "Use local public transport",
          "Find the right line, check its stops and transfers, and buy a ticket.",
        ),
        skill(
          "allergies",
          "Explain food allergies when ordering",
          "State an allergy or restriction, check the ingredients and order a dish without them.",
        ),
        skill(
          "past",
          "Talk about recent events",
          "Recount what you did recently with the spoken past and ask about someone else's.",
        ),
        skill(
          "intercity",
          "Book an intercity train journey",
          "Compare departures, connections and prices, then buy a ticket and check its details.",
        ),
        skill(
          "package",
          "Mail a package at the post office",
          "Ask to send a package, give the recipient's details and ask about delivery and tracking.",
        ),
      ],
    },
  },
];
