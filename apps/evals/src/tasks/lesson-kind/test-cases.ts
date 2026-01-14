const SHARED_EXPECTATIONS = `
  - Choose from the fixed set only: core, language, custom
  - Language is strict: ONLY for actual language learning (vocabulary, grammar, etc.)
  - Custom is for tutorials/how-to/step-by-step guides
  - Core is the default for conceptual/theoretical content
`;

export const TEST_CASES = [
  // Core lessons
  {
    expectations: `
      - MUST return 'core' (conceptual programming topic)

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-core-variables",
    userInput: {
      chapterTitle: "Programming Basics",
      courseTitle: "Learn Python",
      language: "en",
      lessonDescription:
        "Learn what variables are, why they exist, and how they store data in programming",
      lessonTitle: "Introduction to Variables",
    },
  },
  {
    expectations: `
      - MUST return 'core' (science concept requiring explanation)

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-core-photosynthesis",
    userInput: {
      chapterTitle: "Plant Biology",
      courseTitle: "Biology 101",
      language: "en",
      lessonDescription:
        "Explore how plants convert sunlight into energy through the process of photosynthesis",
      lessonTitle: "Understanding Photosynthesis",
    },
  },
  // Language lessons
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
      lessonDescription:
        "Learn how to say hello, goodbye, and common greetings in Spanish",
      lessonTitle: "Basic Greetings in Spanish",
    },
  },
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
  // Custom lessons
  {
    expectations: `
      - MUST return 'custom' (step-by-step tutorial/how-to)

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-custom-git-setup",
    userInput: {
      chapterTitle: "Getting Started",
      courseTitle: "Git and GitHub",
      language: "en",
      lessonDescription:
        "Step-by-step guide to installing and configuring Git on your computer",
      lessonTitle: "How to Set Up Git",
    },
  },
  {
    expectations: `
      - MUST return 'custom' (hands-on tutorial)

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-custom-react-app",
    userInput: {
      chapterTitle: "Project Setup",
      courseTitle: "React Development",
      language: "en",
      lessonDescription:
        "Follow along to create a new React application from scratch",
      lessonTitle: "Creating Your First React App",
    },
  },
  // Edge cases
  {
    expectations: `
      - MUST return 'core' (studying ABOUT languages, not learning a language)
      - MUST NOT return 'language'

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-edge-linguistics-not-language",
    userInput: {
      chapterTitle: "Foundations",
      courseTitle: "Linguistics 101",
      language: "en",
      lessonDescription:
        "Explore the scientific study of language structure and meaning",
      lessonTitle: "Introduction to Linguistics",
    },
  },
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
      lessonDescription:
        "Discover how English words evolved from Latin, Greek, and Germanic roots",
      lessonTitle: "Word Origins and Etymology",
    },
  },
  {
    expectations: `
      - MUST return 'custom' (step-by-step installation guide)
      - MUST NOT return 'language' (Spanish is the course language, not the subject)

      ${SHARED_EXPECTATIONS}
    `,
    id: "es-edge-programming-tutorial-spanish",
    userInput: {
      chapterTitle: "Configuración",
      courseTitle: "Desarrollo Web",
      language: "es",
      lessonDescription:
        "Guía paso a paso para instalar Node.js en tu computadora",
      lessonTitle: "Instalando Node.js",
    },
  },
];
