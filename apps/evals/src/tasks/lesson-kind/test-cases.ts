const SHARED_EXPECTATIONS = `
  - Choose from the fixed set only: explanation, tutorial.
  - Tutorial is reserved for tool/product/platform/environment-specific lessons where the concrete steps are the lesson.
  - Active phrasing ("Setting up...", "Building...", "Montando...", "Escrevendo...") is NOT a signal for tutorial.
  - If the lesson teaches transferable concepts that would apply across tools/environments, it is explanation even if the title sounds hands-on.
  - When in doubt, choose explanation.
`;

export const TEST_CASES = [
  {
    expectations: `
      - MUST return 'explanation' because this teaches transferable Kanban concepts: board, column, card, and work lane.
      - MUST NOT return 'tutorial' because "Montando" is active phrasing, not a signal for a product-specific tutorial.
      - A junior practitioner needs to understand what each element represents, not follow UI steps.

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-explanation-kanban-board-structure",
    userInput: {
      chapterTitle: "Montando um quadro Kanban que mostra o trabalho",
      courseTitle: "Kanban",
      language: "pt",
      lessonDescription:
        "Monte a estrutura visível mínima do quadro para que o trabalho apareça diante dos olhos. Foque no que cada parte física ou digital representa no dia a dia.",
      lessonTitle: "Montando a estrutura visível do quadro",
    },
  },
  {
    expectations: `
      - MUST return 'explanation' because this teaches the concept of a function, transferable across editors and runtimes.
      - "Turning repeated code into a function" sounds active but is teaching a concept.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-explanation-js-function-concept",
    userInput: {
      chapterTitle: "Functions, Arrays, and Objects",
      courseTitle: "JavaScript",
      language: "en",
      lessonDescription:
        "Break a repeated task into a named block of code and run it when needed. These ideas make code shorter, easier to read, and easier to change later.",
      lessonTitle: "Turning repeated code into a function",
    },
  },
  {
    expectations: `
      - MUST return 'explanation' because this teaches attention as a transferable architectural concept.
      - "Following how..." is active phrasing, not a signal for tutorial.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-explanation-transformer-attention",
    userInput: {
      chapterTitle: "Transformers",
      courseTitle: "Machine Learning",
      language: "en",
      lessonDescription:
        "Start with the core operation that made transformers work so well. Trace how a token looks at other tokens and turns those relationships into a new representation.",
      lessonTitle: "Following how one token attends to others",
    },
  },
  {
    expectations: `
      - MUST return 'explanation' because this teaches petition structure that transfers across courts and platforms.
      - Active gerund "Escrevendo" does not make it a tutorial.

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-explanation-petition-structure",
    userInput: {
      chapterTitle: "Processo Civil",
      courseTitle: "Direito",
      language: "pt",
      lessonDescription:
        "Monte a estrutura mínima da demanda com clareza sobre fatos, fundamento e resultado pretendido. Uma inicial bem construída evita emendas, indeferimento e perda de foco.",
      lessonTitle: "Escrevendo uma petição inicial que se sustenta",
    },
  },
  {
    expectations: `
      - MUST return 'explanation' because this teaches transit photometry as a transferable detection method.

      ${SHARED_EXPECTATIONS}
    `,
    id: "es-explanation-exoplanet-transit",
    userInput: {
      chapterTitle: "Exoplanetas",
      courseTitle: "Astronomía",
      language: "es",
      lessonDescription:
        "Lee la señal más famosa de los exoplanetas directamente en el brillo estelar. Cada detalle de la caída de luz aporta una pista física sobre el planeta y su órbita.",
      lessonTitle: "Leyendo un planeta cuando cruza su estrella",
    },
  },
  {
    expectations: `
      - MUST return 'explanation' because this is conceptual history content, not a procedural tutorial.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-explanation-indigenous-trade-networks",
    userInput: {
      chapterTitle: "Indigenous Brazil Before Colonization",
      courseTitle: "Brazilian History",
      language: "en",
      lessonDescription:
        "Track how goods moved across long distances before Europeans arrived. Trade networks linked communities through rivers, trails, and shorelines rather than isolated local worlds.",
      lessonTitle: "Following trade across rivers, trails, and coasts",
    },
  },
  {
    expectations: `
      - MUST return 'explanation' because this is academic study of language history, not a product-specific tutorial.
      - The output must not invent a language-learning kind.

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
  {
    expectations: `
      - MUST return 'tutorial' because installing and configuring Git is tied to a specific tool and computer environment.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-tutorial-git-setup",
    userInput: {
      chapterTitle: "Getting Started",
      courseTitle: "Git and GitHub",
      language: "en",
      lessonDescription: "Step-by-step guide to installing and configuring Git on your computer",
      lessonTitle: "How to Set Up Git",
    },
  },
  {
    expectations: `
      - MUST return 'tutorial' because creating a project with React's scaffolding depends on a specific framework/tooling path.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-tutorial-react-app",
    userInput: {
      chapterTitle: "Project Setup",
      courseTitle: "React Development",
      language: "en",
      lessonDescription: "Follow along to create a new React application from scratch",
      lessonTitle: "Creating Your First React App",
    },
  },
  {
    expectations: `
      - MUST return 'tutorial' because installing Node.js is tied to a specific runtime and computer environment.
      - MUST NOT infer any language-learning kind because Spanish is the course language, not the subject.

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
  {
    expectations: `
      - MUST return 'tutorial' because this is tied to Trello's specific UI and switching tools would require different steps.
      - Contrast with pt-explanation-kanban-board-structure: same domain, but this teaches product steps rather than transferable concepts.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-tutorial-trello-first-board",
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
