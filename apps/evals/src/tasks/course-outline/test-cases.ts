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
      - MUST be in Brazilian Portuguese
      - Beginner band of UX design for career changers: research, problem framing, information architecture, interaction, visual design, prototyping, testing and the work with a product team
      - No two lessons of a chapter teach the same distinction: "a need is not a product goal", "a goal is not a solution" and "a solution is not a result" belong in one lesson; "a symptom is not a problem" and "a symptom is not its cause" too. Each lesson has its own move: a new idea, a procedure, a harder case or applying earlier ideas together

      ${SHARED_EXPECTATIONS}
    `,
    expected: { tool: "figma|figjam|penpot" },
    id: "pt-ux-beginner-distinct-lessons",
    userInput: { courseTitle: "Design de UX", language: "pt", level: "beginner" },
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
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Intermediate band of a shared speech recognition and transcription course; the learners who need the required skills prepare for a public-service exam answered on paper (certo/errado items), so WITHOUT_TOOLS is yes
      - Every required skill is tagged on a chapter that teaches it the way such an exam asks it: how automatic speech recognition works and where it fails (acoustic and language models, word error rate), what end-to-end models change (CTC, attention, transducers), what multimodal audio LLMs do differently, how speaker diarization works (segmentation, speaker embeddings, clustering, overlap) and its limits, with no tools on those chapters
      - The band may still have practice chapters with tools for other learners, but no required skill is tagged only on one, and none of the required skills is taught as a job task (choosing replay ranges, editing audio)

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-fala-intermediate-written-exam",
    userInput: {
      courseTitle: "Reconhecimento de Fala e Transcrição",
      language: "pt",
      level: "intermediate",
      requiredSkills: [
        {
          description:
            "Explicar como um sistema de reconhecimento automático de fala converte áudio em texto e onde erra.",
          key: "asr",
          name: "Explicar o reconhecimento automático de fala",
        },
        {
          description: "Distinguir modelos de fala de ponta a ponta das arquiteturas em etapas.",
          key: "end-to-end",
          name: "Comparar modelos de fala end-to-end",
        },
        {
          description: "Avaliar o que LLMs multimodais de áudio nativo fazem e seus limites.",
          key: "multimodal",
          name: "Avaliar LLMs multimodais de áudio",
        },
        {
          description: "Explicar como a diarização identifica e separa falantes e onde falha.",
          key: "diarizacao",
          name: "Explicar a diarização de falantes",
        },
      ],
      withoutTools: true,
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Intermediate band of a shared English course whose required skills are needed by candidates of the exam in EXAMS, who read English texts at B1 to B2 and judge statements about them as right or wrong
      - The chapters that teach the required skills are written at that depth: lessons on reading news reports, institutional and academic texts (whose claim a sentence is, whether the author endorses or only reports it, hedges and reporting verbs, reference across sentences, inference and the author's stance), never on recognizing quotation marks, who said a one-line sentence or everyday scenes
      - No title, description or objective names the exam, its board or its notice ("Câmara dos Deputados", "Cebraspe", "concurso", "edital")
      - Every required skill is tagged on a chapter without tools

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-ingles-intermediate-exam-reading",
    userInput: {
      courseTitle: "Língua inglesa",
      exams: [
        {
          name: "Concurso Câmara dos Deputados, Analista Legislativo - Registro e Redação",
          style:
            "trueFalse: Itens julgados CERTO ou ERRADO. essay: Duas questões discursivas sobre conhecimentos específicos, com até 20 linhas cada.",
        },
      ],
      language: "pt",
      level: "intermediate",
      requiredSkills: [
        {
          description:
            "Distinguir, em textos em inglês, o que o autor afirma do que ele atribui a outras fontes.",
          key: "atribuicao",
          name: "Identificar a quem pertence uma afirmação",
        },
        {
          description: "Inferir a posição do autor a partir de escolhas de palavras e ressalvas.",
          key: "posicao-autor",
          name: "Inferir a posição do autor de um texto",
        },
        {
          description: "Reconhecer a que se referem pronomes e expressões ao longo de um texto.",
          key: "referencia",
          name: "Reconhecer o referente de pronomes e expressões",
        },
      ],
      withoutTools: true,
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - A private course built from one first-year high-school student's own class summary (MATERIAL) for a test on Friday: the outline teaches exactly that summary, in its order and at its depth, with its terms (teoria celular, procariontes e eucariontes, membrana e transportes com osmose e bomba de sódio e potássio, organelas e suas funções, célula animal e vegetal, núcleo)
      - Nothing beyond the material except what one of its ideas needs: no glycocalyx, secondary active transport, respiratory chain, endosymbiosis, nuclear lamina or nuclear pore transport, and no cell division, which the summary says isn't on the test
      - The summary's exam-style exercises (procarionte ou eucarionte, a red cell in distilled water, matching organelles to functions, animal vs plant differences) are reflected in what lessons prepare the learner to do
      - The band is small, like the summary: a few chapters, not a whole university course

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-biologia-material-class-test",
    userInput: {
      courseTitle: "Biologia celular",
      language: "pt",
      level: "intermediate",
      material: `<page ref="S1" of="Resumo para a prova">
Biologia 1º ano B - Prof.ª Juliana - Resumo para a prova de sexta (9/10): A CÉLULA
1. Teoria celular: todos os seres vivos são formados por células (vírus são acelulares). A célula é a menor unidade estrutural e funcional. Toda célula vem de outra preexistente (Virchow). Hooke (1665) observou cortiça.
2. Procariontes (bactérias e arqueas): sem núcleo organizado (nucleoide), sem organelas membranosas, têm ribossomos, membrana e parede. Eucariontes: núcleo com carioteca e organelas membranosas. CAI NA PROVA: ribossomos existem nos dois!
3. Membrana plasmática: mosaico fluido (Singer e Nicolson, 1972), bicamada de fosfolipídios com proteínas, permeabilidade seletiva. Passivo (sem ATP): difusão simples, facilitada, osmose (água vai do hipotônico para o hipertônico). Ativo (com ATP): bomba de sódio e potássio (3 Na+ para fora, 2 K+ para dentro). Endocitose (fagocitose, pinocitose) e exocitose.
4. Organelas: mitocôndria (respiração celular, ATP, DNA próprio); cloroplasto (fotossíntese, só plantas e algas, DNA próprio); ribossomo (síntese de proteínas); RE rugoso (proteínas) e liso (lipídios, desintoxicação); complexo golgiense (modifica, empacota, secreta; acrossomo); lisossomo (digestão intracelular); vacúolo central (vegetal); centríolos (divisão nas animais).
5. Animal x vegetal: vegetal tem parede de celulose, cloroplastos, vacúolo central grande, geralmente sem centríolos; animal sem parede, sem cloroplastos, com centríolos.
6. Núcleo: carioteca com poros, cromatina (DNA + proteínas), nucléolo (forma ribossomos).
Exercícios (estilo da prova): 1) Célula com parede, ribossomos e sem núcleo organizado: procarionte ou eucarionte? Justifique. 2) Por que uma hemácia em água destilada pode se romper? Use hipotônico e hipertônico. 3) Relacione mitocôndria, lisossomo, complexo golgiense, ribossomo com digestão, secreção, ATP, proteínas. 4) Duas diferenças entre célula animal e vegetal.
Obs.: a prova tem 5 questões abertas e 5 de marcar. Não cai divisão celular (mitose fica para o próximo bimestre).
</page>`,
      requiredSkills: [
        {
          description: "Aplicar os postulados da teoria celular.",
          key: "teoria-celular",
          name: "Aplicar a teoria celular",
        },
        {
          description: "Distinguir células procariontes e eucariontes pela organização.",
          key: "procariontes",
          name: "Diferenciar procariontes e eucariontes",
        },
        {
          description: "Explicar o transporte passivo e ativo pela membrana, incluindo a osmose.",
          key: "membrana",
          name: "Explicar os transportes pela membrana",
        },
        {
          description: "Relacionar cada organela à sua função.",
          key: "organelas",
          name: "Relacionar organelas e funções",
        },
      ],
    },
  },
];
