import { type TestCase } from "@/lib/types";
import { type ExamOutline } from "@zoonk/ai/tasks/v2/curriculum/exam-outline";
import { type SkillGraphParams } from "@zoonk/ai/tasks/v2/curriculum/skill-graph";
import { CAMARA_BLUEPRINT } from "./camara-blueprint";

const SHARED_EXPECTATIONS = `
  - The output is the planner's map of the goal: courses, phases (title, milestone and estimated hours) and skills (key, name, description, course, level, phase, prerequisites, estimated lessons, exam weight)
  - Skill names are actions starting with a verb, named generically so other courses could reuse them
  - Estimated hours are study time (3-minute lessons plus practice and reviews); judge whether the total is honest for the goal, not whether it matches an exact number
  - Exam weights are 1 to 5 for exam goals and null otherwise
  - Don't evaluate JSON formatting
`;

const ENEM_BLUEPRINT: ExamOutline = {
  name: "ENEM (Exame Nacional do Ensino Médio), two Sundays",
  notes: [
    "Format: 5 options per question, no penalty for wrong answers. 5h30 on day 1, 5h on day 2.",
    "Scoring: item response theory (TRI). Getting hard questions right while missing easy ones counts as inconsistent and lowers the score.",
    "Rule: Essay: dissertative-argumentative text on a social issue, graded 0 to 1000 in five competencies of 200 points each: C1 formal written Portuguese; C2 understanding the prompt and building a dissertative-argumentative text with knowledge from several areas; C3 selecting and organizing arguments; C4 cohesion; C5 an intervention proposal that respects human rights.",
  ],
  subjects: [
    {
      group: "Dia 1",
      name: "Linguagens, Códigos e suas Tecnologias",
      questions: 45,
      topics: [
        "Interpretação de textos e gêneros textuais",
        "Funções da linguagem e variação linguística",
        "Movimentos literários",
        "Artes",
        "Educação física e tecnologias da comunicação",
        "Leitura em língua estrangeira (inglês ou espanhol)",
      ],
      weight: null,
    },
    {
      group: "Dia 1",
      name: "Ciências Humanas e suas Tecnologias",
      questions: 45,
      topics: [
        "Brasil colônia, império e república",
        "Cidadania, movimentos sociais e direitos",
        "Meio ambiente e geografia do Brasil",
        "História antiga e medieval",
        "Clássicos da filosofia e da sociologia",
        "Urbanização e questões agrárias",
      ],
      weight: null,
    },
    {
      group: "Dia 1",
      name: "Redação",
      questions: null,
      topics: ["Texto dissertativo-argumentativo sobre um problema social"],
      weight: null,
    },
    {
      group: "Dia 2",
      name: "Ciências da Natureza e suas Tecnologias",
      questions: 45,
      topics: [
        "Ecologia e meio ambiente",
        "Fisiologia humana e saúde",
        "Genética",
        "Eletricidade e energia",
        "Mecânica",
        "Química orgânica",
        "Estequiometria e soluções",
        "Eletroquímica",
      ],
      weight: null,
    },
    {
      group: "Dia 2",
      name: "Matemática e suas Tecnologias",
      questions: 45,
      topics: [
        "Estatística e leitura de gráficos e tabelas",
        "Porcentagem e proporção",
        "Geometria plana e espacial",
        "Funções",
        "Probabilidade e contagem",
        "Matemática financeira",
      ],
      weight: null,
    },
  ],
  topicFrequency: [
    {
      level: "high",
      subject: "Matemática e suas Tecnologias",
      topic: "Estatística e leitura de gráficos e tabelas",
    },
    { level: "high", subject: "Matemática e suas Tecnologias", topic: "Porcentagem e proporção" },
    {
      level: "medium",
      subject: "Matemática e suas Tecnologias",
      topic: "Geometria plana e espacial",
    },
    { level: "low", subject: "Matemática e suas Tecnologias", topic: "Matemática financeira" },
    {
      level: "high",
      subject: "Ciências da Natureza e suas Tecnologias",
      topic: "Ecologia e meio ambiente",
    },
    { level: "low", subject: "Ciências da Natureza e suas Tecnologias", topic: "Eletroquímica" },
    {
      level: "high",
      subject: "Ciências Humanas e suas Tecnologias",
      topic: "Brasil colônia, império e república",
    },
    {
      level: "high",
      subject: "Ciências Humanas e suas Tecnologias",
      topic: "Cidadania, movimentos sociais e direitos",
    },
    {
      level: "low",
      subject: "Ciências Humanas e suas Tecnologias",
      topic: "História antiga e medieval",
    },
    {
      level: "high",
      subject: "Linguagens, Códigos e suas Tecnologias",
      topic: "Interpretação de textos e gêneros textuais",
    },
    { level: "low", subject: "Linguagens, Códigos e suas Tecnologias", topic: "Artes" },
  ],
};

const POLICIA_FEDERAL_BLUEPRINT: ExamOutline = {
  name: "Concurso da Polícia Federal, cargo Agente de Polícia Federal (banca Cebraspe)",
  notes: [
    "Format: objective test of 120 true-or-false items plus an essay, 4h30.",
    "Scoring: each right item is worth 1 point and each wrong item takes 1 point away; a blank item is worth 0.",
    "Rule: Essay: a dissertative text on a current topic. Later phases: physical tests (pull-ups, long jump, swimming, timed run).",
  ],
  subjects: [
    {
      group: "Bloco I (60 itens)",
      name: "Língua Portuguesa",
      questions: null,
      topics: [
        "Compreensão e interpretação de textos",
        "Tipologia e gêneros textuais",
        "Coesão textual",
        "Sintaxe da oração e do período",
        "Pontuação",
        "Concordância, regência e crase",
        "Colocação dos pronomes átonos",
        "Reescrita de frases e parágrafos do texto",
      ],
      weight: null,
    },
    {
      group: "Bloco I (60 itens)",
      name: "Noções de Direito Administrativo",
      questions: null,
      topics: [
        "Administração pública",
        "Atos administrativos",
        "Agentes públicos",
        "Poderes administrativos",
        "Responsabilidade civil do Estado",
      ],
      weight: null,
    },
    {
      group: "Bloco I (60 itens)",
      name: "Noções de Direito Constitucional",
      questions: null,
      topics: ["Direitos e garantias fundamentais", "Organização do Estado", "Segurança pública"],
      weight: null,
    },
    {
      group: "Bloco I (60 itens)",
      name: "Noções de Direito Penal e Processual Penal",
      questions: null,
      topics: [
        "Crimes contra a administração pública",
        "Inquérito policial",
        "Prisão e liberdade provisória",
      ],
      weight: null,
    },
    {
      group: "Bloco I (60 itens)",
      name: "Legislação Especial",
      questions: null,
      topics: [
        "Lei de Drogas",
        "Estatuto do Desarmamento",
        "Organizações criminosas",
        "Abuso de autoridade",
        "Crimes hediondos",
      ],
      weight: null,
    },
    {
      group: "Bloco II (36 itens)",
      name: "Estatística",
      questions: null,
      topics: ["Estatística descritiva", "Probabilidade", "Inferência"],
      weight: null,
    },
    {
      group: "Bloco II (36 itens)",
      name: "Raciocínio Lógico",
      questions: null,
      topics: ["Proposições e equivalências", "Argumentos", "Conjuntos", "Contagem"],
      weight: null,
    },
    {
      group: "Bloco II (36 itens)",
      name: "Informática",
      questions: null,
      topics: [
        "Hardware e sistemas operacionais",
        "Redes e internet",
        "Segurança da informação",
        "Computação em nuvem",
        "Bancos de dados e SQL",
        "Análise de dados",
      ],
      weight: null,
    },
    {
      group: "Bloco III (24 itens)",
      name: "Contabilidade Geral",
      questions: null,
      topics: ["Patrimônio", "Registros contábeis", "Demonstrações contábeis"],
      weight: null,
    },
  ],
  topicFrequency: [
    { level: "high", subject: "Língua Portuguesa", topic: "Compreensão e interpretação de textos" },
    {
      level: "high",
      subject: "Língua Portuguesa",
      topic: "Reescrita de frases e parágrafos do texto",
    },
    { level: "medium", subject: "Informática", topic: "Segurança da informação" },
    { level: "low", subject: "Contabilidade Geral", topic: "Demonstrações contábeis" },
  ],
};

export const TEST_CASES: TestCase<never, SkillGraphParams>[] = [
  {
    expectations: `
      - MUST be in US English
      - Huge goal: the graph must span several canonical courses, such as mathematics (algebra, trigonometry, calculus, differential equations, complex numbers, probability), linear algebra, classical mechanics, waves and oscillations, electromagnetism, and quantum mechanics
      - Quantum mechanics must reach the core: the wave function, the Schrödinger equation, operators and observables, uncertainty, the hydrogen atom, angular momentum and spin, perturbation theory or approximation methods, and entanglement or quantum information
      - Starting from forgotten high school math, the path begins with the math physics uses; calculus and linear algebra come before the quantum formalism
      - The honest size is hundreds of hours (roughly 300 to 600); phases like "math", "calculus and linear algebra", "classical physics", "quantum mechanics", "advanced topics" are sensible
      - Chapter-sized skills are expected, not hundreds of lesson-sized trivia skills

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-quantum-physics-from-zero",
    userInput: {
      context:
        "I finished high school years ago and forgot most of the math. I can study about 45 minutes a day.",
      goal: "Master quantum physics from scratch",
      goalKind: "learn",
      language: "en",
      ownLevel: "none",
      purpose: "deep",
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Exam goal with a blueprint: all four areas (Linguagens, Humanas, Natureza, Matemática) and the essay must be covered, including the five essay competencies (C1 to C5)
      - Exam weights must follow the blueprint's frequency: statistics and chart reading, percentages and proportions, ecology, Brazilian history and citizenship, and text interpretation should weigh more than rarely tested topics
      - Exam strategy the exam scores belongs here, such as keeping answers consistent under item response theory (easy questions first) and managing time
      - Topics outside the ENEM syllabus don't belong
      - The graph maps the whole exam even though the learner has little time; prioritization is the planner's job, but weights must make it possible
      - Starting point: the learner is finishing secondary school, so Portuguese, mathematics and science skills sit at the depth ENEM asks (mostly the intermediate band or above). Elementary content, such as naming word classes, reading everyday notices, invitations or recipes, or drilling basic arithmetic, doesn't belong

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-enem-2026",
    userInput: {
      context:
        "Tenho 17 anos, quero Enfermagem numa federal. Estudo à noite e faltam uns 46 dias pra prova. Sou melhor em humanas, tenho dificuldade em matemática.",
      examBlueprint: ENEM_BLUEPRINT,
      goal: "Passar no ENEM 2026",
      goalKind: "exam",
      language: "pt",
      ownLevel: "basic",
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Public-service exam: every block of the blueprint is covered (Portuguese, administrative, constitutional, criminal and procedural law, special legislation, statistics, logic, informática, accounting, the essay) with weights that follow the blueprint's frequency, and the physical tests at least as preparation
      - Exam strategy the exam scores belongs here: with a wrong item cancelling a right one, deciding when to leave an item blank
      - Starting point: an adult graduate with a basic level of the exam's content. Portuguese starts at the depth the exam asks (comprehension, cohesion, syntax, punctuation, agreement, regency and crase, rewriting) in the intermediate band or above. Elementary content, such as naming nouns, articles and numerals, reading notices, invitations or recipes, or drilling basic arithmetic, doesn't belong
      - Law, accounting and informática may start in the beginner band, since they're new to most candidates

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-cebraspe-policia-federal",
    userInput: {
      context:
        "Tenho 29 anos, sou formado em administração e trabalho durante o dia. Quero ser agente da Polícia Federal e estudo à noite, depois do trabalho.",
      examBlueprint: POLICIA_FEDERAL_BLUEPRINT,
      goal: "Passar no concurso da Polícia Federal para agente",
      goalKind: "exam",
      language: "pt",
      ownLevel: "basic",
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Public-service exam with a long notice: every one of the nine subjects is an area, named exactly as the notice names it, and every numbered item of their syllabi (182 topics) is taught by some skill; Linguística, Reconhecimento de Fala e Transcrição and Processo Legislativo are the role's own subjects and must be covered in depth, not as a token skill each
      - Foundations first: the first phase holds what the rest builds on and what most of the exam shares, such as reading and grammar for Língua Portuguesa and the Constitution's basics, before the role's most specialized subjects (speech recognition, parliamentary procedure details)
      - The exam is answered on paper (certo/errado items, plus the discursive test): every skill is what its items ask about a topic, at the exam's depth. The speech subject's skills explain how automatic speech recognition, end-to-end models, multimodal audio LLMs and speaker diarization work and fail, and how transcripts are post-processed, never job tasks with tools (reviewing recordings in an audio editor, choosing which range to replay, running pyannote or Whisper, writing Python)
      - Only the discursive test's skills are outcome skills (every candidate sits it and it's scored apart); no other skill is
      - Exam strategy the exam scores belongs here: with a wrong item cancelling a right one, deciding when to leave an item blank; and the discursive test (a technical piece) is prepared
      - Starting point: an adult graduate with a law degree, weak in IT and English. Law subjects need less from zero; IT and English need their foundations at the depth the exam asks
      - Weights follow the notice: the P1 and P2 tests have 90 items each, so the role's four subjects together weigh as much as the five basic ones

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-camara-registro-redacao",
    userInput: {
      context:
        "Tenho 27 anos e sou formada em direito. Sou fraca em informática e inglês. Estudo 2h por dia de semana e 4h aos sábados.",
      examBlueprint: CAMARA_BLUEPRINT,
      goal: "quero passar no concurso da câmara dos deputados para analista legislativo, área de registro e redação. a prova é em janeiro",
      goalKind: "exam",
      language: "pt",
      ownLevel: "intermediate",
    },
  },
  {
    expectations: `
      - MUST be in US English
      - Work goal: target the learner's real tasks: SQL (joins, aggregation, window functions), spreadsheets, cleaning data, descriptive statistics, defining business metrics (conversion, retention, average order value), charts and dashboards, A/B testing (hypotheses, sample size, significance, common pitfalls such as peeking), and explaining results to non-technical people
      - Must include using AI tools well for analysis: writing and checking queries with AI, spotting wrong AI analyses, not trusting unverified numbers
      - Should not drift into deep machine learning theory or general career advice the learner didn't ask for
      - Starts from basic knowledge, not from zero arithmetic

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-data-analyst-work",
    userInput: {
      context:
        "I'm a junior data analyst at an e-commerce company. I build weekly sales reports in Google Sheets and SQL, and my manager wants me to run A/B tests and explain the results. We use ChatGPT at work.",
      goal: "Get better at data analysis for my job",
      goalKind: "learn",
      language: "en",
      ownLevel: "basic",
      purpose: "work",
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Career change into UX design from zero: user research and interviews, synthesizing findings, information architecture, user flows, wireframes, prototyping in a design tool such as Figma, usability testing, visual design and typography basics, interaction design, accessibility, design systems, working with product managers and developers, measuring outcomes
      - Must include using AI tools well in design work (research synthesis, generating and critiquing ideas and prototypes, checking AI output)
      - What gets the job is part of the path, in two areas of their own near the end whose skills are marked as outcome skills: a portfolio of complete UX projects written up as case studies, and the job search for junior UX roles in Brazil (a résumé and portfolio that present eight years of teaching as an asset, such as running research with real people and explaining ideas clearly, finding openings, interviews and the design exercise or portfolio presentation); a "history of design" or generic career motivation is filler
      - Only these portfolio and job-search skills are outcome skills
      - The portfolio's projects grow with the path: the first project's skills (including choosing its problem) have prerequisites only in the first phase, so it can start in the first weeks; later projects build on later phases
      - Area sizes follow the job's daily work: the hands-on areas (interaction and interface design, prototyping and usability testing) together get the most lessons and start in the first phases; user research is substantial but no single supporting area (research, collaboration, theory) has more lessons than prototyping and usability testing, and research doesn't fill the first months alone

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-career-change-ux",
    userInput: {
      context:
        "Sou professora do ensino fundamental há 8 anos e quero mudar de carreira para trabalhar com UX design. Nunca trabalhei com design.",
      goal: "Mudar de carreira para UX design",
      goalKind: "learn",
      language: "pt",
      ownLevel: "none",
      purpose: "careerChange",
    },
  },
  {
    expectations: `
      - MUST be in Spain Spanish (not Latin American Spanish): names and descriptions in European Spanish vocabulary and forms
      - Language goal: skills are real situations with can-dos for working at a hotel in London, such as checking guests in and out, handling complaints, taking phone reservations, giving directions and recommendations, small talk with guests, writing short emails to guests, and understanding colleagues and instructions at work
      - Ordered by CEFR level from A1/A2 (beginner) to B1/B2 (intermediate); the learner has a basic level, so the path should not dwell on the alphabet
      - Grammar lives inside situations, not as standalone grammar skills
      - The course is English itself, titled in Spanish (for example "Inglés")

      ${SHARED_EXPECTATIONS}
    `,
    id: "es-language-english-hotel",
    userInput: {
      context:
        "Me voy a Londres en marzo para trabajar en la recepción de un hotel. Entiendo un poco de inglés pero me cuesta hablar.",
      goal: "Aprender inglés para trabajar en un hotel en Londres",
      goalKind: "language",
      language: "es",
      ownLevel: "basic",
      targetLanguage: "en",
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Small school test: only the topics the learner listed (plasma membrane and transport: diffusion, osmosis, active transport; organelles; nucleus; cell division: mitosis and meiosis) plus the minimum prerequisites (what a cell is, prokaryotic vs eukaryotic cells)
      - Lesson-sized skills, about 8 to 25 skills, one or two phases, a total of a few hours
      - Exam weights come from the listed material's emphasis, since there is no official blueprint
      - Topics outside the test, such as genetics, evolution or biochemistry beyond what the listed topics need, are wrong here

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-school-exam-cytology",
    userInput: {
      context:
        "Sou do 1º ano do ensino médio. A prova de sexta é sobre membrana plasmática e transportes (difusão, osmose, transporte ativo), organelas, núcleo e divisão celular (mitose e meiose).",
      goal: "Prova de biologia na sexta sobre citologia",
      goalKind: "exam",
      language: "pt",
      ownLevel: "basic",
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Small school test: only the topics the learner listed (plasma membrane and transport: diffusion, osmosis, active transport; organelles; nucleus; cell division: mitosis and meiosis) plus the minimum prerequisites (what a cell is, prokaryotic vs eukaryotic cells)
      - The test is in three days (LESSON_BUDGET 25, the most those days hold): the skills' lessons are sized by the listed topics, not padded up to 25 and never above it; every listed topic gets a skill of its own with at least one lesson, none outside them, and no area for a discursive test or exam strategy
      - Exam weights come from the listed material's emphasis, since there is no official blueprint
      - Topics outside the test, such as genetics, evolution or biochemistry beyond what the listed topics need, are wrong here

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-school-exam-cytology-three-days",
    userInput: {
      context:
        "Sou do 1º ano do ensino médio. A prova de sexta é sobre membrana plasmática e transportes (difusão, osmose, transporte ativo), organelas, núcleo e divisão celular (mitose e meiose).",
      goal: "Prova de biologia na sexta sobre citologia",
      goalKind: "exam",
      language: "pt",
      lessonBudget: 25,
      ownLevel: "basic",
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - A class test on Friday from the learner's own notes, read into a blueprint with one subject (Biologia) and six topics (S1.1 to S1.6): one skill for each topic at least, never one skill for several topics, each skill's \`topics\` listing its topic id; every topic id appears in a skill
      - Sized by the notes, not by the budget (LESSON_BUDGET 15, the most two days hold): roughly one to three lessons a topic, more for membrane transport (osmosis, active transport, endocytosis) and organelles (the notes say they come up a lot), never above 15 in all
      - Only what the notes teach (cell theory, prokaryotes and eukaryotes, plasma membrane and transport, organelles, nucleus, viruses) and the prerequisites a first-year high-school student lacks, a lesson each; nothing beyond the notes (no cell division, DNA replication or genetics), and no area for a discursive test or exam strategy beyond the notes' own announcement
      - Exam weights follow the notes' emphasis (organelles "cai muito")

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-class-test-own-notes-two-days",
    userInput: {
      context: `The learner's own material, page by page:
[p1] BIOLOGIA - 1º ANO B - Prof.ª Juliana
Resumo pra prova de sexta (9/10): A CÉLULA
1) Teoria celular: todo ser vivo é formado por células (exceto vírus); a célula é a menor unidade da vida; toda célula vem de outra célula (Virchow); Hooke viu as "celas" na cortiça (1665).
2) Procarionte x eucarionte: procarionte sem núcleo (DNA solto = nucleoide), sem organelas membranosas, ex. bactérias; eucarionte com núcleo (carioteca) e organelas, ex. animais, plantas, fungos, protozoários; as duas têm membrana plasmática, citoplasma, ribossomos e DNA.
3) Membrana plasmática: bicamada de fosfolipídios + proteínas (mosaico fluido); permeabilidade seletiva; transporte passivo sem ATP (difusão simples, difusão facilitada, osmose); osmose: água vai do meio hipotônico para o hipertônico; hemácia em água pura incha e estoura (hemólise), em solução muito salgada murcha; transporte ativo gasta ATP, contra o gradiente (bomba de sódio e potássio); endocitose (fagocitose e pinocitose) e exocitose.
4) Organelas (CAI MUITO!!): mitocôndria (respiração celular, ATP); cloroplasto (fotossíntese, plantas e algas); ribossomos (síntese de proteínas); RE rugoso (proteínas) e RE liso (lipídios, desintoxicação); complexo golgiense (modifica, empacota e secreta); lisossomo (digestão intracelular); vacúolo (grande na célula vegetal); parede celular (celulose).
5) Núcleo: carioteca com poros; cromatina = DNA + proteínas; nucléolo produz ribossomos.
6) Vírus: acelulares, parasitas intracelulares obrigatórios; capsídeo de proteína + DNA ou RNA; antibiótico não funciona contra vírus.
A prof disse: vai ter questão de completar a tabela das organelas e uma dissertativa sobre osmose!`,
      examBlueprint: {
        name: "Biologia",
        notes: [
          "Format: Questão de completar a tabela das organelas.",
          "Format: Dissertativa sobre osmose.",
        ],
        subjects: [
          {
            group: null,
            name: "Biologia",
            questions: null,
            topics: [
              "Teoria celular",
              "Procarionte x eucarionte",
              "Membrana plasmática",
              "Organelas",
              "Núcleo",
              "Vírus",
            ],
            weight: null,
          },
        ],
        topicFrequency: [{ level: "high", subject: "Biologia", topic: "Organelas" }],
      },
      goal: "prova de biologia sexta sobre célula",
      goalKind: "exam",
      language: "pt",
      lessonBudget: 15,
      ownLevel: "basic",
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Building an audience and sales for a small business: the responsible route, such as knowing the customer, photographing and presenting the product, planning and making posts and short videos, answering messages and taking orders, asking happy customers for honest reviews, local reach (Google Business Profile, partnerships), pricing and costs, and measuring what brings orders (reach, messages, orders per post)
      - Never a skill built on an unethical shortcut: no buying followers or likes, fake reviews, engagement pods or spam in other people's comments, misleading claims or copied photos. Any mention of them is only to say why the honest way reaches the same result
      - Must include using AI tools well for the business (drafting captions, ideas and replies, and checking them before posting)
      - Generic marketing theory or a "history of social media" is filler

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-build-bakery-instagram",
    userInput: {
      context:
        "Tenho uma confeitaria em casa e vendo bolos por encomenda. Meu Instagram tem 800 seguidores e quero chegar a 10 mil para vender mais.",
      goal: "Crescer o Instagram da minha confeitaria e vender mais bolos",
      goalKind: "learn",
      language: "pt",
      ownLevel: "basic",
      purpose: "work",
    },
  },
];
