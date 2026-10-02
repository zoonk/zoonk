import { type TestCase } from "@/lib/types";
import { type CourseOutlineParams } from "@zoonk/ai/tasks/v2/curriculum/course-outline";
import { type CourseOutlineExpected } from "./scorer";

const SHARED_EXPECTATIONS = `
  - The output is one level band of a shared course: chapters (title, description, objectives, skillKeys, tools) with every lesson's title, description, can-do line, estimated minutes and skills, plus uncoveredSkillKeys (required skills no chapter tagged)
  - A chapter's tools are what the learner uses on their own device; code checks score them, so don't judge them
  - A non-empty uncoveredSkillKeys means a required skill was missed
  - The outline is shared by every learner of this course level, so it must not be tailored to one person
  - Don't evaluate JSON formatting
`;

export const TEST_CASES: TestCase<CourseOutlineExpected, CourseOutlineParams>[] = [
  {
    expectations: `
      - MUST be in US English
      - Overview for a curious adult, in plain words with no formulas, covering the required skills
      - The learners already learn the TAUGHT_ELSEWHERE skills (the uncertainty principle, how measuring changes a quantum system, describing entanglement) in lessons from another course: no lesson teaches them again, even under another name (no "Quantum measurement" or "What entanglement is" lesson), and no chapter is named after them
      - A chapter next to those topics covers only what's still missing (such as Bell tests or why entanglement can't send messages)

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-quantum-overview-taught-elsewhere",
    userInput: {
      courseTitle: "Quantum physics",
      language: "en",
      level: "overview",
      requiredSkills: [
        {
          description:
            "Describe a quantum state as the full list of possible outcomes and their chances.",
          key: "quantum-states",
          name: "Describe quantum states",
        },
        {
          description: "Explain why quantum outcomes are chances, not hidden fixed values.",
          key: "quantum-probabilities",
          name: "Explain quantum probabilities",
        },
        {
          description:
            "Explain why entangled particles can't be used to send a message faster than light.",
          key: "no-signaling",
          name: "Distinguish entanglement from instant messaging",
        },
        {
          description: "Say what Bell tests check and what their results showed.",
          key: "bell-tests",
          name: "Interpret the purpose of Bell tests",
        },
      ],
      taughtElsewhere: [
        "Explain the uncertainty principle",
        "Explain how measuring changes a quantum system",
        "Describe entanglement",
      ],
    },
  },
  {
    expectations: `
      - MUST be in US English
      - Overview for a curious adult: 3 to 6 chapters, plain words, no formulas, equations or notation
      - Big ideas to cover at a high level: energy comes in packets (quantization), wave-particle duality, uncertainty, superposition and measurement, atoms and orbitals (why the electron doesn't fall into the nucleus), tunneling, entanglement, and quantum technology in everyday life (lasers, semiconductors and chips, MRI, quantum computing)
      - Lessons are short stories about one idea each, not a textbook sequence

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-quantum-physics-overview",
    userInput: { courseTitle: "Quantum physics", language: "en", level: "overview" },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Overview: 3 to 6 chapters of big ideas in plain words, no formulas or equations
      - Big ideas: scarcity and choices, supply and demand and prices, money, banks and interest rates, inflation, GDP, growth and unemployment, the government's role (taxes, spending, public debt), international trade and exchange rates, and how people really decide (behavioral economics); Brazilian examples are welcome

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-economia-overview",
    userInput: { courseTitle: "Economia", language: "pt", level: "overview" },
  },
  {
    expectations: `
      - MUST be in US English
      - Beginner band of classical mechanics: describing motion (position, velocity, acceleration, vectors), Newton's laws and free-body diagrams, friction, circular motion, work and energy and its conservation, momentum and collisions, rotation and torque, gravity and orbits, oscillations and simple harmonic motion
      - Every required skill key must be tagged on the chapter that teaches it: describe-motion, newtons-laws, energy-conservation, momentum, simple-harmonic-motion
      - Calculus-based derivations can appear only as far as a beginner band needs; Lagrangian and Hamiltonian mechanics belong to later bands

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-classical-mechanics-beginner-required",
    userInput: {
      courseTitle: "Classical mechanics",
      language: "en",
      level: "beginner",
      requiredSkills: [
        {
          description: "Use position, velocity and acceleration to describe how things move.",
          key: "describe-motion",
          name: "Describe motion with vectors",
        },
        {
          description: "Predict motion from the forces acting on an object.",
          key: "newtons-laws",
          name: "Apply Newton's laws",
        },
        {
          description: "Track kinetic and potential energy as an object moves.",
          key: "energy-conservation",
          name: "Use conservation of energy",
        },
        {
          description: "Use momentum to predict what happens in collisions.",
          key: "momentum",
          name: "Solve collisions with momentum",
        },
        {
          description: "Describe springs and pendulums with periodic motion.",
          key: "simple-harmonic-motion",
          name: "Model simple harmonic motion",
        },
      ],
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Beginner band of statistics: types of data and variables, tables and charts, measures of center and spread, percentiles and box plots, distributions and the normal curve, basic probability, sampling and bias, correlation vs causation, an introduction to estimation (confidence intervals) and to hypothesis tests only at a beginner depth
      - Practical work with spreadsheets and real data should appear, and a field AI is changing should include checking analyses and charts made with AI tools
      - Formulas may appear where the idea needs them, explained in everyday words

      ${SHARED_EXPECTATIONS}
    `,
    expected: { tool: "planilha|excel|sheets|calc" },
    id: "pt-estatistica-beginner",
    userInput: { courseTitle: "Estatística", language: "pt", level: "beginner" },
  },
  {
    expectations: `
      - MUST be in Spain Spanish (not Latin American Spanish), for example "ordenador" and "fichero" or "archivo" in their European use
      - Beginner band of Python programming: running Python and the tools to write it, variables and types, strings, conditionals, loops, functions, lists, dictionaries and other collections, reading and writing files, errors and exceptions, modules and packages, virtual environments, basic testing, and a small real program
      - Programming is a field AI is changing: lessons must include working with AI assistants (describing a task, reading and reviewing generated code, finding the bug in AI code) and favor concepts and debugging over memorizing syntax

      ${SHARED_EXPECTATIONS}
    `,
    expected: { tool: "python" },
    id: "es-python-beginner",
    userInput: { courseTitle: "Programación en Python", language: "es", level: "beginner" },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - This is a continuation, not a band: the course already teaches the EXTEND_SKILLS skill in the listed chapter, and the answer must be exactly one new chapter for it, tagged with its key, with about 8 lessons. Judge coverage, order and level fit on that one chapter, not on a whole band
      - The new chapter continues where the listed lessons stop, at a beginner (A1 to A2) English level, for Portuguese speakers: new interview situations and language (such as talking about strengths, a problem solved at work, why they want the job, questions to ask the interviewer), repeating none of the listed lessons, even under another name
      - Its title is its own scope in Brazilian Portuguese, never "Candidaturas e entrevistas" or a "Parte 2", "Mais…" or "Avançado" variant of it, and it doesn't repeat any title in OTHER_LEVEL_CHAPTERS
      - Lessons stay situations with English the learner says or understands, not grammar lectures

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-ingles-beginner-extend-interview",
    userInput: {
      courseTitle: "Inglês",
      extendSkills: [
        {
          chapters: [
            {
              lessons: [
                "Passado simples para experiência profissional",
                "Formação acadêmica e profissional",
                "Tarefas e responsabilidades anteriores",
                "Perguntas comportamentais de entrevista",
                "Marcadores de tempo na experiência profissional",
              ],
              title: "Candidaturas e entrevistas",
            },
          ],
          description: "Falar sobre empregos anteriores, formação e responsabilidades em inglês.",
          key: "descrever-experiencia",
          lessons: 8,
          name: "Descrever experiência profissional",
        },
      ],
      language: "pt",
      level: "beginner",
      otherLevelChapters: [
        "Primeiras conversas",
        "Apresentações e dados pessoais",
        "Candidaturas e entrevistas",
        "Comunicação cotidiana no trabalho",
      ],
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Beginner band of a canonical mathematics course from zero: whole-number operations, fractions and decimals, ratio and proportion, percentages, powers and roots, basic algebra and linear equations, units and measurement, plane geometry and areas, reading charts and tables, basic statistics (mean, median, mode), first-degree functions
      - Every required skill key must be tagged on the chapter that teaches it: porcentagem, razao-proporcao, leitura-graficos, estatistica-basica, geometria-plana, funcao-afim
      - Shared by all learners: exam-specific tricks for ENEM don't belong in a canonical course outline

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-matematica-beginner-enem-skills",
    userInput: {
      courseTitle: "Matemática",
      language: "pt",
      level: "beginner",
      requiredSkills: [
        {
          description: "Calcular aumentos, descontos e partes de um todo.",
          key: "porcentagem",
          name: "Calcular porcentagens",
        },
        {
          description: "Comparar grandezas e resolver regras de três.",
          key: "razao-proporcao",
          name: "Resolver problemas de proporção",
        },
        {
          description: "Tirar conclusões de gráficos e tabelas.",
          key: "leitura-graficos",
          name: "Interpretar gráficos e tabelas",
        },
        {
          description: "Resumir dados com média, mediana e moda.",
          key: "estatistica-basica",
          name: "Calcular média, mediana e moda",
        },
        {
          description: "Calcular áreas e perímetros de figuras planas.",
          key: "geometria-plana",
          name: "Calcular áreas de figuras planas",
        },
        {
          description: "Modelar situações com funções do primeiro grau.",
          key: "funcao-afim",
          name: "Usar funções do primeiro grau",
        },
      ],
    },
  },
];
