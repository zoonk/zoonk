import { type TestCase } from "@/lib/types";
import { type SkillGraphParams } from "@zoonk/ai/tasks/v2/curriculum/skill-graph";

const SHARED_EXPECTATIONS = `
  - The output is the planner's map of the goal: courses, phases (title, milestone and estimated hours) and skills (key, name, description, course, level, phase, prerequisites, estimated lessons, exam weight)
  - Skill names are actions starting with a verb, named generically so other courses could reuse them
  - Estimated hours are study time (3-minute lessons plus practice and reviews); judge whether the total is honest for the goal, not whether it matches an exact number
  - Exam weights are 1 to 5 for exam goals and null otherwise
  - Don't evaluate JSON formatting
`;

const ENEM_BLUEPRINT = `
ENEM (Exame Nacional do Ensino Médio), two Sundays.
Day 1: Linguagens, Códigos e suas Tecnologias (45 questions: Portuguese, literature, arts, physical education, communication technologies, and English or Spanish) + Ciências Humanas e suas Tecnologias (45 questions: history, geography, philosophy, sociology) + the essay (redação).
Day 2: Ciências da Natureza e suas Tecnologias (45 questions: biology, chemistry, physics) + Matemática e suas Tecnologias (45 questions).
Scoring: item response theory (TRI). Getting hard questions right while missing easy ones counts as inconsistent and lowers the score. 5 options per question, no penalty for wrong answers. 5h30 on day 1, 5h on day 2.
Essay: dissertative-argumentative text on a social issue, graded 0 to 1000 in five competencies of 200 points each: C1 formal written Portuguese; C2 understanding the prompt and building a dissertative-argumentative text with knowledge from several areas; C3 selecting and organizing arguments; C4 cohesion; C5 an intervention proposal that respects human rights.
How often topics appear in recent editions (approximate):
- Matemática: statistics and reading charts and tables (very often), percentages and proportions (very often), plane and solid geometry (often), functions (often), probability and counting (often), financial math (sometimes).
- Natureza: ecology and environment (very often), human physiology and health (often), genetics (often), electricity and energy (often), mechanics (sometimes), organic chemistry (often), stoichiometry and solutions (often), electrochemistry (sometimes).
- Humanas: Brazil colony, empire and republic (very often), citizenship, social movements and rights (very often), environment and geography of Brazil (often), ancient and medieval history (sometimes), philosophy and sociology classics (often), urbanization and agrarian issues (often).
- Linguagens: text interpretation and genres (very often), language functions and linguistic variation (often), literature movements (sometimes), arts (sometimes), foreign language reading (5 questions).
`;

const POLICIA_FEDERAL_BLUEPRINT = `
Concurso da Polícia Federal, cargo Agente de Polícia Federal (banca Cebraspe). Objective test of 120 true-or-false items plus an essay, 4h30.
Scoring: each right item is worth 1 point and each wrong item takes 1 point away; a blank item is worth 0.
Bloco I (60 items): Língua Portuguesa (text comprehension, types and genres, cohesion, syntax, punctuation, agreement, regency and crase, pronoun placement, rewriting of excerpts), Noções de Direito Administrativo, Noções de Direito Constitucional, Noções de Direito Penal e Processual Penal, Legislação Especial (drugs, firearms, organized crime, abuse of authority, heinous crimes).
Bloco II (36 items): Estatística (descriptive statistics, probability, inference), Raciocínio Lógico (propositions, equivalences, arguments, sets, counting), Informática (hardware, operating systems, networks, internet, security, cloud, databases and SQL, data analysis).
Bloco III (24 items): Contabilidade Geral (assets, accounting records, financial statements).
Essay: a dissertative text on a current topic. Later phases: physical tests (pull-ups, long jump, swimming, timed run).
How often topics appear in recent editions (approximate): text comprehension and rewriting (very often), administrative and constitutional law (very often), criminal law and procedure (often), informática (often), logic and statistics (often), accounting (sometimes).
`;

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
      - Producing a portfolio case study is allowed because the learner asked to change careers; generic job-search advice or a "history of design" is filler

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
