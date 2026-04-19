const SHARED_EXPECTATIONS = `
  - Choose from the fixed set only: core, language, custom
  - Language is strict: ONLY when the lesson teaches a foreign/new language
  - Custom is reserved for tool/product/environment-specific tutorials where steps ARE the lesson
  - Active phrasing ("Setting up...", "Building...", "Montando...") is NOT a signal for custom — it is the default style for core lessons too
  - If the lesson teaches transferable concepts that would apply across tools/environments, it is core — even if the title sounds hands-on
`;

export const TEST_CASES = [
  // Core: hands-on title, transferable concept (the Kanban regression case).
  // This lesson teaches what a board, column, card, and work lane ARE —
  // transferable across Trello, Jira, a whiteboard. NOT a product tutorial.
  {
    expectations: `
      - MUST return 'core' (teaches transferable Kanban concepts: board, column, card, work lane)
      - MUST NOT return 'custom' — "Montando" is an active gerund, not a signal for a product tutorial
      - A junior practitioner needs to understand what each element represents, not follow UI steps

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-core-kanban-board-structure",
    userInput: {
      chapterTitle: "Montando um quadro Kanban que mostra o trabalho",
      courseTitle: "Kanban",
      language: "pt",
      lessonDescription:
        "Monte a estrutura visível mínima do quadro para que o trabalho apareça diante dos olhos. Foque no que cada parte física ou digital representa no dia a dia.",
      lessonTitle: "Montando a estrutura visível do quadro",
    },
  },
  // Core: active JavaScript lesson — teaches the concept of a function,
  // which is transferable across any editor, runtime, or language.
  {
    expectations: `
      - MUST return 'core' (teaches the concept of a function, transferable across editors and runtimes)
      - "Turning repeated code into a function" sounds active but is teaching a concept

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-core-js-function-concept",
    userInput: {
      chapterTitle: "Functions, Arrays, and Objects",
      courseTitle: "JavaScript",
      language: "en",
      lessonDescription:
        "Break a repeated task into a named block of code and run it when needed. These ideas make code shorter, easier to read, and easier to change later.",
      lessonTitle: "Turning repeated code into a function",
    },
  },
  // Core: ML / transformers — concept (attention) wrapped in active framing.
  {
    expectations: `
      - MUST return 'core' (teaches the attention mechanism — a transferable architectural concept)
      - "Following how..." is active phrasing, not a signal for custom

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-core-transformer-attention",
    userInput: {
      chapterTitle: "Transformers",
      courseTitle: "Machine Learning",
      language: "en",
      lessonDescription:
        "Start with the core operation that made transformers work so well. Trace how a token looks at other tokens and turns those relationships into a new representation.",
      lessonTitle: "Following how one token attends to others",
    },
  },
  // Core: law / civil procedure — "Escrevendo uma petição..." teaches structure
  // that applies across any court or filing system. Contrast with the custom
  // case below that targets a specific e-filing platform.
  {
    expectations: `
      - MUST return 'core' (teaches petition structure — transferable across any court or platform)
      - Active gerund "Escrevendo" does not make it a custom tutorial

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-core-petition-structure",
    userInput: {
      chapterTitle: "Processo Civil",
      courseTitle: "Direito",
      language: "pt",
      lessonDescription:
        "Monte a estrutura mínima da demanda com clareza sobre fatos, fundamento e resultado pretendido. Uma inicial bem construída evita emendas, indeferimento e perda de foco.",
      lessonTitle: "Escrevendo uma petição inicial que se sustenta",
    },
  },
  // Core: astronomy — active framing, domain concept (transit photometry).
  {
    expectations: `
      - MUST return 'core' (teaches transit photometry — a transferable detection method)

      ${SHARED_EXPECTATIONS}
    `,
    id: "es-core-exoplanet-transit",
    userInput: {
      chapterTitle: "Exoplanetas",
      courseTitle: "Astronomía",
      language: "es",
      lessonDescription:
        "Lee la señal más famosa de los exoplanetas directamente en el brillo estelar. Cada detalle de la caída de luz aporta una pista física sobre el planeta y su órbita.",
      lessonTitle: "Leyendo un planeta cuando cruza su estrella",
    },
  },
  // Core: humanities — conceptual content about pre-colonial indigenous life.
  {
    expectations: `
      - MUST return 'core' (conceptual history content — not a procedural tutorial)

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-core-indigenous-trade-networks",
    userInput: {
      chapterTitle: "Indigenous Brazil Before Colonization",
      courseTitle: "Brazilian History",
      language: "en",
      lessonDescription:
        "Track how goods moved across long distances before Europeans arrived. Trade networks linked communities through rivers, trails, and shorelines rather than isolated local worlds.",
      lessonTitle: "Following trade across rivers, trails, and coasts",
    },
  },
  // Language: teaching Spanish vocabulary in an English-language course.
  {
    expectations: `
      - MUST return 'language' (teaching Spanish vocabulary)

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-language-spanish-greetings",
    userInput: {
      chapterTitle: "Getting Started",
      courseTitle: "Spanish for Beginners",
      language: "en",
      lessonDescription: "Learn how to say hello, goodbye, and common greetings in Spanish",
      lessonTitle: "Basic Greetings in Spanish",
    },
  },
  // Language: teaching English grammar to Portuguese speakers.
  {
    expectations: `
      - MUST return 'language' (teaching English grammar to Portuguese speakers)

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-language-english-past-tense",
    userInput: {
      chapterTitle: "Tempos Verbais",
      courseTitle: "Inglês Intermediário",
      language: "pt",
      lessonDescription: "Aprenda a usar o passado simples em inglês",
      lessonTitle: "Past Tense in English",
    },
  },
  // Edge: content ABOUT a language (etymology) is core, not language.
  {
    expectations: `
      - MUST return 'core' (academic study of language history, not language learning)
      - MUST NOT return 'language'

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-edge-etymology",
    userInput: {
      chapterTitle: "History of English",
      courseTitle: "English Language History",
      language: "en",
      lessonDescription: "Discover how English words evolved from Latin, Greek, and Germanic roots",
      lessonTitle: "Word Origins and Etymology",
    },
  },
  // Custom: tied to a specific product (Git on your computer).
  // Steps ARE the lesson; switching tools would require a different lesson.
  {
    expectations: `
      - MUST return 'custom' (installing a specific tool on a specific computer)

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-custom-git-setup",
    userInput: {
      chapterTitle: "Getting Started",
      courseTitle: "Git and GitHub",
      language: "en",
      lessonDescription: "Step-by-step guide to installing and configuring Git on your computer",
      lessonTitle: "How to Set Up Git",
    },
  },
  // Custom: tied to a specific framework's CLI.
  {
    expectations: `
      - MUST return 'custom' (creating a project with a specific framework's scaffolding)

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-custom-react-app",
    userInput: {
      chapterTitle: "Project Setup",
      courseTitle: "React Development",
      language: "en",
      lessonDescription: "Follow along to create a new React application from scratch",
      lessonTitle: "Creating Your First React App",
    },
  },
  // Custom: Spanish-language lesson teaching a specific install, NOT teaching Spanish.
  {
    expectations: `
      - MUST return 'custom' (installing a specific runtime on a computer)
      - MUST NOT return 'language' (Spanish is the course language, not the subject)

      ${SHARED_EXPECTATIONS}
    `,
    id: "es-edge-programming-tutorial-spanish",
    userInput: {
      chapterTitle: "Configuración",
      courseTitle: "Desarrollo Web",
      language: "es",
      lessonDescription: "Guía paso a paso para instalar Node.js en tu computadora",
      lessonTitle: "Instalando Node.js",
    },
  },
  // Custom contrast case: same domain (Kanban) as the first test, but tied to
  // a specific product. This lesson teaches Trello's UI, not transferable ideas.
  // Having both the Kanban-core and Trello-custom cases guards the model from
  // collapsing the two on surface cues (both use "board", both are hands-on).
  {
    expectations: `
      - MUST return 'custom' (tied to Trello's specific UI; switching to another tool requires a different lesson)
      - Contrast with pt-core-kanban-board-structure: same domain, but this teaches product steps, not transferable concepts

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-custom-trello-first-board",
    userInput: {
      chapterTitle: "Getting Started with Trello",
      courseTitle: "Trello for Teams",
      language: "en",
      lessonDescription:
        "Follow the steps to sign up, create your first board in the Trello web app, and invite teammates from the workspace menu.",
      lessonTitle: "Creating Your First Trello Board",
    },
  },
];
