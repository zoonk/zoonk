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
/** The shared "Direito Constitucional" course's intermediate band before an exam's graph was written again (dev, 9 Oct 2026). */
const CONSTITUTIONAL_LAW_INTERMEDIATE = [
  {
    lessons: [
      "Colisão entre direitos fundamentais",
      "Limites e restrições a direitos fundamentais",
      "Adequação e necessidade",
      "Proporcionalidade em sentido estrito",
      "Abuso de direito fundamental",
    ],
    title: "Colisões e restrições de direitos fundamentais",
  },
  {
    lessons: [
      "Aprovação de tratados de direitos humanos",
      "Tratados com equivalência a emenda constitucional",
      "Supralegalidade dos tratados de direitos humanos",
      "Controle de convencionalidade",
    ],
    title: "Tratados de direitos humanos no direito brasileiro",
  },
  {
    lessons: [
      "Intervenção federal e intervenção estadual",
      "Hipóteses de intervenção federal",
      "Solicitação, requisição e iniciativa da intervenção",
      "Decreto de intervenção",
      "Controle legislativo da intervenção",
    ],
    title: "Intervenção e autonomia federativa",
  },
  {
    lessons: [
      "Congresso Nacional e suas duas Casas",
      "Sessões conjuntas do Congresso Nacional",
      "Legislatura e sessões legislativas",
      "Competências do Congresso com sanção presidencial",
      "Competências exclusivas do Congresso Nacional",
      "Convocação e pedidos de informação",
      "Competências privativas da Câmara em contraste",
    ],
    title: "Funcionamento e competências do Congresso Nacional",
  },
  {
    lessons: [
      "Representação na Câmara dos Deputados",
      "Composição da Câmara dos Deputados",
      "Autorização da Câmara para processar autoridades",
      "Tomada de contas do presidente pela Câmara",
      "Organização interna da Câmara dos Deputados",
      "Competências privativas da Câmara em contraste",
    ],
    title: "Composição e competências da Câmara dos Deputados",
  },
  {
    lessons: [
      "Composição e renovação do Senado Federal",
      "Processamento e julgamento pelo Senado",
      "Aprovação de autoridades pelo Senado",
      "Competências financeiras do Senado",
      "Competências privativas do Senado em contraste",
    ],
    title: "Composição e competências do Senado Federal",
  },
  {
    lessons: [
      "Requisitos de criação da CPI",
      "Poderes de investigação da CPI",
      "Convocações e documentos na CPI",
      "Sigilos e reserva de jurisdição na CPI",
      "Relatório final e encaminhamentos da CPI",
    ],
    title: "Limites da investigação parlamentar",
  },
  {
    lessons: [
      "Interpretação conforme à Constituição",
      "Inconstitucionalidade sem redução de texto",
      "Modulação dos efeitos da decisão",
      "Eficácia contra todos e efeito vinculante",
      "Súmula vinculante",
    ],
    title: "Técnicas e efeitos das decisões constitucionais",
  },
  {
    lessons: [
      "Lei complementar e lei ordinária",
      "Cabimento e limites da medida provisória",
      "Lei delegada e limites da delegação",
      "Decreto legislativo e resolução",
      "Decreto autônomo e decreto regulamentar",
      "Emenda constitucional e normas regimentais",
      "Hierarquia, competência e reserva de matéria",
    ],
    title: "Espécies normativas e seus limites constitucionais",
  },
  {
    lessons: [
      "Constituições estaduais e poder constituinte decorrente",
      "Emendas constitucionais estaduais e simetria",
      "Lei Orgânica do Distrito Federal",
      "Lei orgânica municipal e aprovação qualificada",
      "Emendas às leis orgânicas",
      "Leis distritais e dupla competência",
      "Leis complementares estaduais, distritais e municipais",
      "Medidas provisórias estaduais e municipais",
      "Lei delegada e limites da delegação",
      "Decretos legislativos e resoluções locais",
    ],
    title: "Espécies normativas dos entes subnacionais",
  },
  {
    lessons: [
      "Direitos fundamentais das pessoas jurídicas",
      "Direitos fundamentais dos estrangeiros não residentes",
      "Eficácia dos direitos fundamentais nas relações privadas",
      "Direitos fundamentais nas associações privadas",
      "Dever estatal de proteção contra terceiros",
    ],
    title: "Titularidade e eficácia dos direitos fundamentais",
  },
  {
    lessons: [
      "Igualdade e critérios de diferenciação",
      "Ações afirmativas",
      "Cotas raciais e sociais no ensino superior",
      "Acessibilidade e adaptações razoáveis",
      "Discriminação indireta",
    ],
    title: "Igualdade material em casos concretos",
  },
  {
    lessons: [
      "Censura prévia e responsabilidade posterior",
      "Liberdade de imprensa e exercício do jornalismo",
      "Acesso à informação pública e sigilo",
      "Proteção constitucional dos dados pessoais",
      "Transparência pública e dados pessoais",
      "Conteúdo de comunicações e dados cadastrais",
    ],
    title: "Expressão, informação pública e dados pessoais",
  },
  {
    lessons: [
      "Não autoincriminação e produção de provas",
      "Prova ilícita e provas derivadas",
      "Entrada em domicílio e suas exceções",
      "Contraditório no processo administrativo",
      "Fundamentação das decisões judiciais",
    ],
    title: "Garantias fundamentais na prova e na decisão",
  },
  {
    lessons: [
      "Laicidade do Estado e colaboração religiosa",
      "Ensino religioso nas escolas públicas",
      "Símbolos religiosos em prédios públicos",
      "Assistência religiosa em instituições de internação",
      "Proteção aos cultos e regras de uso do espaço",
      "Escusa de consciência e prestação alternativa",
      "Guarda religiosa em concursos públicos",
      "Recusa de transfusão por adulto capaz",
      "Tratamento de crianças e crença dos responsáveis",
    ],
    title: "Liberdade religiosa e objeção de consciência",
  },
  {
    lessons: [
      "Princípios do artigo 37 em casos concretos",
      "Concurso público e cargos em comissão",
      "Contratação por tempo determinado",
      "Acumulação de cargos, empregos e funções",
      "Teto remuneratório e parcelas recebidas",
      "Responsabilidade civil das pessoas jurídicas de direito público",
    ],
    title: "Limites constitucionais da atuação administrativa",
  },
  {
    lessons: [
      "Cargo efetivo, emprego público e cargo em comissão",
      "Estabilidade e avaliação especial de desempenho",
      "Perda do cargo do servidor estável",
      "Reintegração, recondução e disponibilidade",
      "Regime próprio e vínculos abrangidos",
    ],
    title: "Garantias e vínculos dos servidores civis",
  },
  {
    lessons: [
      "Militares dos estados e das Forças Armadas",
      "Militar da ativa e filiação partidária",
      "Candidatura do militar da ativa",
      "Greve, sindicalização e direitos dos militares",
    ],
    title: "Regime constitucional dos militares",
  },
  {
    lessons: [
      "Sessões conjuntas do Congresso Nacional",
      "Mesa e direção das sessões conjuntas",
      "Convocação das sessões conjuntas",
      "Sessões conjuntas e sessões da Câmara ou do Senado",
    ],
    title: "Direção e convocação das sessões conjuntas",
  },
  {
    lessons: [
      "Abertura e fases da sessão conjunta",
      "Discussão e encaminhamento da votação",
      "Questão de ordem em sessão conjunta",
      "Votação e apuração em sessão conjunta",
      "Ata e publicação dos trabalhos",
    ],
    title: "Deliberação em sessão conjunta",
  },
  {
    lessons: [
      "Instituição e finalidade das comissões mistas",
      "Composição das comissões mistas",
      "Presidência e relatoria da comissão mista",
      "Parecer da comissão mista",
    ],
    title: "Formação e trabalho das comissões mistas",
  },
  {
    lessons: [
      "Veto total e veto parcial",
      "Recebimento e tramitação do veto",
      "Exame do veto e deliberação congressual",
      "Quórum de rejeição do veto",
      "Promulgação após a rejeição do veto",
    ],
    title: "Apreciação congressual do veto",
  },
  {
    lessons: [
      "Critérios para identificar funções típicas e atípicas",
      "Função administrativa do Poder Legislativo",
      "Julgamento de crimes de responsabilidade pelo Senado",
      "Fiscalização parlamentar e função jurisdicional",
      "Função normativa atípica do Poder Executivo",
      "Decisões administrativas e função jurisdicional",
      "Função administrativa do Poder Judiciário",
      "Regimentos internos dos tribunais",
      "Funções atípicas e controles recíprocos",
    ],
    title: "Funções típicas e atípicas dos Poderes",
  },
  {
    lessons: [
      "Iniciativa geral e iniciativa reservada",
      "Reserva de iniciativa do chefe do Executivo",
      "Pertinência temática das emendas parlamentares",
      "Aumento de despesa em projetos de iniciativa reservada",
      "Vício de iniciativa e sanção presidencial",
    ],
    title: "Iniciativa reservada e limites das emendas",
  },
  {
    lessons: [
      "Emendas da Casa revisora",
      "Promulgação após a rejeição do veto",
      "Urgência constitucional solicitada pelo presidente",
      "Sobrestamento da pauta na urgência constitucional",
      "Deliberação conclusiva das comissões e recurso ao Plenário",
    ],
    title: "Revisão bicameral e urgência constitucional",
  },
  {
    lessons: [
      "Prazo de vigência e prorrogação da medida provisória",
      "Sobrestamento da pauta na urgência constitucional",
      "Projeto de lei de conversão",
      "Emendas sem pertinência temática à medida provisória",
      "Decreto legislativo após perda de eficácia",
      "Relações jurídicas sem decreto legislativo",
    ],
    title: "Conversão e perda de eficácia das medidas provisórias",
  },
];

/** Terra's beginner classical mechanics band in the course-outline eval (8 Nov 2026). */
const MECHANICS_BEGINNER = [
  {
    lessons: [
      "SI units and prefixes",
      "Dimensional analysis",
      "Scalars and vectors",
      "Vector components",
      "Vector addition and subtraction",
    ],
    title: "Units and vectors",
  },
  {
    lessons: [
      "Position, displacement and distance",
      "Average velocity and speed",
      "Instantaneous velocity",
      "Acceleration in one dimension",
      "Velocity-time graphs",
      "Constant-acceleration motion",
    ],
    title: "Motion in one dimension",
  },
  {
    lessons: [
      "Position, velocity and acceleration vectors",
      "Projectile motion",
      "Projectile flight time and range",
      "Relative motion",
      "Acceleration along a curved path",
    ],
    title: "Motion in two dimensions",
  },
  {
    lessons: [
      "Newton's first law and inertial frames",
      "Free-body diagrams",
      "Newton's second law",
      "Newton's third law",
      "Newton's laws in components",
    ],
    title: "Newton's laws",
  },
  {
    lessons: [
      "Mass and weight",
      "Normal force",
      "Static and kinetic friction",
      "Hooke's law",
      "Forces on inclined planes",
      "Tension and connected objects",
      "Drag and terminal speed",
    ],
    title: "Common forces and constraints",
  },
  {
    lessons: [
      "Centripetal acceleration",
      "Speed and period in circular motion",
      "Centripetal force",
      "Vertical circular motion",
    ],
    title: "Circular motion",
  },
  {
    lessons: [
      "Work by a constant force",
      "Kinetic energy and net work",
      "Gravitational potential energy",
      "Elastic potential energy",
      "Conservation of mechanical energy",
      "Energy balance with friction",
      "Power",
    ],
    title: "Work and energy",
  },
  {
    lessons: [
      "Linear momentum",
      "Impulse and momentum change",
      "Conservation of linear momentum",
      "Perfectly inelastic collisions",
      "Elastic collisions",
      "Momentum in two dimensions",
      "Center of mass",
    ],
    title: "Momentum and collisions",
  },
  {
    lessons: [
      "Angular motion",
      "Angular and tangential motion",
      "Torque",
      "Moment of inertia",
      "Torque and angular acceleration",
      "Rotational kinetic energy",
      "Rolling without slipping",
    ],
    title: "Rigid-body rotation",
  },
  {
    lessons: [
      "Static equilibrium",
      "Forces on a supported beam",
      "Angular momentum",
      "Conservation of angular momentum",
    ],
    title: "Equilibrium and angular momentum",
  },
  {
    lessons: [
      "Newton's law of gravitation",
      "Gravitational field strength",
      "Circular orbits",
      "Gravitational potential energy at a distance",
      "Escape speed",
      "Kepler's laws",
    ],
    title: "Gravitation and orbits",
  },
  {
    lessons: [
      "Restoring force and simple harmonic motion",
      "Oscillation amplitude, period and frequency",
      "Sinusoidal motion",
      "Mass-spring period",
      "Simple pendulum period",
      "Energy in harmonic motion",
      "Damping and resonance",
    ],
    title: "Oscillations",
  },
  {
    lessons: [
      "Density and pressure",
      "Hydrostatic pressure",
      "Buoyancy",
      "Continuity in fluid flow",
      "Bernoulli's equation",
    ],
    title: "Fluid mechanics",
  },
];

/** Terra's beginner statistics band in the course-outline eval (8 Nov 2026). */
const STATISTICS_BEGINNER = [
  {
    lessons: [
      "População e unidade de análise",
      "Amostras, parâmetros e estatísticas",
      "Tipos de variáveis",
      "Qualidade dos dados",
      "Estrutura de uma tabela de dados",
      "Privacidade e dados pessoais",
    ],
    title: "Dados e perguntas estatísticas",
  },
  {
    lessons: [
      "Amostragem aleatória e por conveniência",
      "Viés de seleção e não resposta",
      "Formulação de perguntas",
      "Estudos observacionais e experimentos",
      "Confundimento e atribuição aleatória",
      "Generalização de resultados",
    ],
    title: "Amostragem e desenho de estudos",
  },
  {
    lessons: [
      "Tabelas de frequência",
      "Gráficos de barras",
      "Histogramas",
      "Escalas e distorções gráficas",
      "Frequências em planilhas",
    ],
    title: "Tabelas e gráficos",
  },
  {
    lessons: [
      "Média aritmética",
      "Mediana",
      "Moda",
      "Média ponderada",
      "Percentis e quartis",
      "Escolha de medidas de centro",
    ],
    title: "Centro e posição",
  },
  {
    lessons: [
      "Amplitude",
      "Intervalo interquartil",
      "Variância e desvio padrão",
      "Diagrama de caixa",
      "Valores atípicos",
      "Forma de uma distribuição",
    ],
    title: "Dispersão e forma",
  },
  {
    lessons: [
      "Tabelas de contingência",
      "Gráficos de dispersão",
      "Correlação de Pearson",
      "Correlação e causalidade",
      "Associação em dados agregados",
    ],
    title: "Associação entre variáveis",
  },
  {
    lessons: [
      "Espaço amostral e eventos",
      "Probabilidade em casos equiprováveis",
      "Probabilidade e frequência relativa",
      "Regra do complemento",
      "Regra da adição",
    ],
    title: "Fundamentos de probabilidade",
  },
  {
    lessons: [
      "Probabilidade condicional",
      "Regra da multiplicação",
      "Independência de eventos",
      "Árvores de probabilidade",
      "Teorema de Bayes",
      "Testes e taxas de base",
    ],
    title: "Probabilidade condicional e independência",
  },
  {
    lessons: [
      "Variáveis aleatórias",
      "Distribuições discretas",
      "Valor esperado",
      "Distribuição binomial",
      "Distribuições contínuas",
      "Distribuição normal e escore z",
    ],
    title: "Distribuições de probabilidade",
  },
  {
    lessons: [
      "Distribuições amostrais",
      "Erro padrão",
      "Tamanho amostral e precisão",
      "Teorema central do limite",
      "Erro amostral e viés",
    ],
    title: "Variação amostral",
  },
  {
    lessons: [
      "Estimativa pontual",
      "Intervalos de confiança",
      "Margem de erro",
      "Intervalo de confiança para proporção",
      "Intervalo de confiança para média",
      "Condições para intervalos",
    ],
    title: "Estimação e intervalos de confiança",
  },
  {
    lessons: [
      "Hipóteses nula e alternativa",
      "Estatística de teste",
      "Valor p",
      "Erros dos tipos I e II",
      "Poder e tamanho de efeito",
      "Significância e importância prática",
      "Testes para uma amostra",
    ],
    title: "Testes de hipóteses",
  },
  {
    lessons: [
      "Grupos independentes e dados pareados",
      "Comparação de médias",
      "Comparação de proporções",
      "Teste qui-quadrado de associação",
      "Condições para comparação de grupos",
    ],
    title: "Comparação de grupos",
  },
  {
    lessons: [
      "Coeficientes de regressão linear",
      "Ajuste por mínimos quadrados",
      "Resíduos",
      "Coeficiente de determinação",
      "Limites da regressão linear",
      "Regressão linear em planilhas",
    ],
    title: "Regressão linear simples",
  },
  {
    lessons: [
      "Comunicação de resultados",
      "Estatística em notícias",
      "Pedidos de análise para IA",
      "Verificação de análises geradas por IA",
    ],
    title: "Comunicação e verificação de análises",
  },
];

/** Terra's beginner Next.js band in the course-outline eval (8 Nov 2026). */
const NEXTJS_BEGINNER = [
  {
    lessons: [
      "Create a Next.js app",
      "Edit the home page",
      "Next.js project structure",
      "Package scripts",
    ],
    title: "Build your first page",
  },
  {
    lessons: [
      "JSX elements and expressions",
      "React components",
      "Component props",
      "Conditional rendering",
      "Rendering lists and keys",
    ],
    title: "Build pages with components",
  },
  {
    lessons: [
      "File-based routes",
      "Root and nested layouts",
      "Navigation with Link",
      "Route groups",
      "Not-found pages",
    ],
    title: "Create connected pages",
  },
  {
    lessons: [
      "Server and Client Components",
      "Client Components and events",
      "React state",
      "Data across the client boundary",
      "Accessible interactive controls",
    ],
    title: "Add interactive components",
  },
  {
    lessons: [
      "Global CSS",
      "CSS Modules",
      "Responsive layouts",
      "Images with next/image",
      "Fonts with next/font",
    ],
    title: "Style pages and add assets",
  },
  {
    lessons: [
      "Dynamic route segments",
      "Page params",
      "Missing dynamic route data",
      "Page searchParams",
      "Shareable filter URLs",
    ],
    title: "Build pages from URLs",
  },
  {
    lessons: [
      "Server-side data fetching",
      "Fetch response handling",
      "Route loading states",
      "Route error boundaries",
      "Fetch caching",
      "Server environment variables",
    ],
    title: "Display external data",
  },
  {
    lessons: [
      "Forms and Server Actions",
      "Server-side form validation",
      "Form validation feedback",
      "Pending form submissions",
      "Refresh and redirect after actions",
      "Server Action security",
    ],
    title: "Process form submissions",
  },
  {
    lessons: [
      "Database connections",
      "Database models",
      "Reading database records",
      "Creating database records",
      "Updating and deleting records",
    ],
    title: "Save app data",
  },
  {
    lessons: [
      "Authentication library setup",
      "Sign-in and sign-out",
      "Server-side sessions",
      "Protected pages",
      "Ownership checks",
    ],
    title: "Protect user data",
  },
  {
    lessons: [
      "GET route handlers",
      "POST route handlers",
      "Route handler authorization",
      "Testing endpoints with curl",
    ],
    title: "Create API endpoints",
  },
  {
    lessons: [
      "Page metadata",
      "Dynamic metadata",
      "Icons and social images",
      "Sitemaps and robots rules",
    ],
    title: "Prepare pages for search and sharing",
  },
  {
    lessons: [
      "Reading development errors",
      "Manual accessibility checks",
      "Browser tests",
      "Requesting a Next.js change from AI",
      "Reviewing AI-generated code",
    ],
    title: "Check and debug your app",
  },
  {
    lessons: [
      "Production builds",
      "Deployment environment variables",
      "Deploying a Next.js app",
      "Deployment checks",
      "Persistent storage in production",
    ],
    title: "Deploy your app",
  },
];

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
      calls: { after: [8], chapters: [null] },
      directions: { after: [10], chapters: [null] },
      restaurant: { chapters: [13] },
      stay: { chapters: [16] },
      symptoms: { after: [17], chapters: [null] },
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
  {
    expected: {
      administration: { chapters: [16, 17, 18] },
      federation: { chapters: [3] },
      nationality: { chapters: [null] },
      parliament: { chapters: [4, 5, 6] },
      principles: { chapters: [null] },
      rights: { chapters: [1, 11, 12, 13, 14, 15] },
    },
    id: "pt-exam-skills-rewritten-on-a-shared-band",
    userInput: {
      chapters: CONSTITUTIONAL_LAW_INTERMEDIATE,
      courseTitle: "Direito Constitucional",
      exam: true,
      language: "pt",
      level: "intermediate",
      skills: [
        skill(
          "rights",
          "Aplicar direitos e garantias fundamentais",
          "Aplicar direitos, garantias e limites constitucionais a situações apresentadas.",
        ),
        skill(
          "administration",
          "Julgar regras constitucionais da administração pública",
          "Julgar as disposições constitucionais sobre administração pública e servidores civis e militares.",
        ),
        skill(
          "nationality",
          "Distinguir nacionalidade e direitos políticos",
          "Distinguir regras de nacionalidade, direitos políticos, elegibilidade e organização dos partidos políticos.",
        ),
        skill(
          "federation",
          "Julgar organização federativa e intervenção",
          "Comparar as competências dos entes federativos e identificar as hipóteses e os limites da intervenção federal.",
        ),
        skill(
          "parliament",
          "Distinguir competências e prerrogativas parlamentares",
          "Distinguir competências, reuniões e comissões das Casas do Congresso e as regras constitucionais aplicáveis aos parlamentares.",
        ),
        skill(
          "principles",
          "Julgar princípios fundamentais da Constituição",
          "Distinguir a estrutura e as características da Constituição de 1988 e aplicar seus princípios fundamentais a assertivas.",
        ),
      ],
    },
  },
  {
    expected: {
      coaster: { chapters: [7] },
      float: { chapters: [13] },
      heat: { chapters: [null] },
      orbit: { chapters: [11] },
      seatbelt: { chapters: [8] },
      seesaw: { chapters: [9, 10] },
      sound: { after: [12, 13], chapters: [null] },
      swing: { chapters: [12] },
      throw: { chapters: [3] },
    },
    id: "en-mechanics-beginner-plan-skills",
    userInput: {
      chapters: MECHANICS_BEGINNER,
      courseTitle: "Classical mechanics",
      language: "en",
      level: "beginner",
      skills: [
        skill(
          "throw",
          "Predict where a thrown ball lands",
          "Work out how long a ball thrown at an angle stays in the air and how far it goes.",
        ),
        skill(
          "seatbelt",
          "Explain why seatbelts and airbags reduce injuries",
          "Relate a longer stopping time to a smaller force on the body in a crash.",
        ),
        skill(
          "coaster",
          "Find a roller coaster's speed at the bottom of a drop",
          "Trade height for speed when friction is small, and see what friction takes away.",
        ),
        skill(
          "seesaw",
          "Balance a seesaw with people of different weights",
          "Place two people so the turning effects on each side cancel out.",
        ),
        skill(
          "swing",
          "Time a playground swing",
          "Predict how long one back-and-forth swing takes and what changes it.",
        ),
        skill(
          "float",
          "Predict whether an object floats",
          "Compare an object's weight with the push of the water it moves aside.",
        ),
        skill(
          "orbit",
          "Explain how satellites stay in orbit",
          "Relate a satellite's speed and height to the pull of gravity that keeps it circling.",
        ),
        skill(
          "heat",
          "Explain how heat moves between objects",
          "Describe how heat travels by conduction, convection and radiation from hot things to cold ones.",
        ),
        skill(
          "sound",
          "Explain how sound travels",
          "Describe sound as a wave that moves through air, with pitch set by its frequency.",
        ),
      ],
    },
  },
  {
    expected: {
      "amostra-viciada": { chapters: [2] },
      "exame-positivo": { chapters: [8] },
      "grafico-enganoso": { chapters: [3] },
      "media-ponderada": { chapters: [4] },
      "orcamento-planilha": { chapters: [null] },
      "pesquisa-eleitoral": { chapters: [11] },
      "previsao-vendas": { chapters: [14] },
      sazonalidade: { chapters: [null] },
      "teste-ab": { chapters: [13, 12] },
    },
    id: "pt-statistics-beginner-plan-skills",
    userInput: {
      chapters: STATISTICS_BEGINNER,
      courseTitle: "Estatística",
      language: "pt",
      level: "beginner",
      skills: [
        skill(
          "pesquisa-eleitoral",
          "Interpretar a margem de erro de uma pesquisa eleitoral",
          "Ler o intervalo de uma pesquisa e dizer quando dois candidatos estão em empate técnico.",
        ),
        skill(
          "media-ponderada",
          "Calcular a média final com pesos",
          "Calcular a nota final quando provas e trabalhos têm pesos diferentes.",
        ),
        skill(
          "grafico-enganoso",
          "Desconfiar de um gráfico enganoso",
          "Perceber quando um eixo cortado ou uma escala esticada exagera uma diferença.",
        ),
        skill(
          "exame-positivo",
          "Entender o resultado positivo de um exame",
          "Calcular a chance de ter a doença quando o exame dá positivo, considerando quão rara ela é.",
        ),
        skill(
          "teste-ab",
          "Decidir se a diferença entre duas versões de um site é real",
          "Comparar as taxas de conversão de duas versões e decidir se a diferença pode ser acaso.",
        ),
        skill(
          "previsao-vendas",
          "Prever vendas com uma reta de tendência",
          "Ajustar uma reta aos dados de vendas e usá-la para estimar o próximo valor.",
        ),
        skill(
          "amostra-viciada",
          "Reconhecer uma enquete viciada",
          "Explicar por que uma enquete aberta na internet não representa a população.",
        ),
        skill(
          "orcamento-planilha",
          "Montar um orçamento doméstico numa planilha",
          "Organizar receitas e despesas do mês numa planilha e acompanhar o saldo.",
        ),
        skill(
          "sazonalidade",
          "Identificar a sazonalidade nas vendas",
          "Separar o padrão que se repete a cada ano da tendência numa série de vendas mensais.",
        ),
      ],
    },
  },
  {
    expected: {
      auth: { after: [10], chapters: [null] },
      components: { after: [2], chapters: [4, null] },
      data: { after: [7], chapters: [null] },
      deploy: { chapters: [14] },
      forms: { after: [8], chapters: [null] },
      routes: { chapters: [6] },
      search: { chapters: [12] },
      styles: { after: [5], chapters: [null] },
    },
    id: "en-nextjs-beginner-band-continued",
    userInput: {
      chapters: NEXTJS_BEGINNER,
      courseTitle: "Next.js",
      language: "en",
      level: "beginner",
      skills: [
        skill(
          "forms",
          "Handle form submissions",
          "Accept a form, validate it on the server and show the result.",
          [8],
        ),
        skill(
          "routes",
          "Build pages from the URL",
          "Create pages whose content depends on the address the visitor opens.",
          [3],
        ),
        skill(
          "data",
          "Show data from an external API",
          "Fetch records from another service and show them on a page, with loading and error states.",
          [7],
        ),
        skill(
          "auth",
          "Let users sign in",
          "Add sign-in and sign-out and keep pages private to signed-in users.",
          [10],
        ),
        skill(
          "styles",
          "Style pages",
          "Give pages a consistent look with CSS that adapts to the screen size.",
          [5],
        ),
        skill(
          "components",
          "Build pages from reusable components",
          "Split a page into components and pass each one the data it shows.",
          [2],
        ),
        skill(
          "deploy",
          "Put the app online",
          "Build the app for production and publish it so anyone can open it.",
        ),
        skill(
          "search",
          "Make pages show up well in search results",
          "Give each page a title, a description and a preview image for search and sharing.",
        ),
      ],
    },
  },
];
