const SHARED_EXPECTATIONS = `
  - Must choose "useExisting" only when a candidate clearly covers the same learner goal
  - Must choose "createNew" when candidates are broader, narrower, siblings, ambiguous, or jurisdictionally different
  - If using an existing course, courseSlug must exactly match the correct candidate slug
  - If creating new, courseSlug must be null
  - The reason should be concise and should explain the identity boundary
  - False positives are major errors because they redirect learners to the wrong course
`;

export const TEST_CASES = [
  {
    expectations: `
      - Must choose "useExisting"
      - Must choose courseSlug "frontend-development"
      - "Frontend Engineering" and "Frontend Development" are synonyms for the same course

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-frontend-engineering",
    userInput: {
      candidates: [
        {
          description: "Build user-facing web interfaces.",
          language: "en",
          slug: "frontend-development",
          targetLanguage: null,
          title: "Frontend Development",
        },
        {
          description: "Build full web applications.",
          language: "en",
          slug: "web-development",
          targetLanguage: null,
          title: "Web Development",
        },
      ],
      suggestion: {
        description: "Build client-side product interfaces.",
        language: "en",
        targetLanguage: null,
        title: "Frontend Engineering",
      },
    },
  },
  {
    expectations: `
      - Must choose "useExisting"
      - Must choose courseSlug "python"
      - "Introduction to Python" is a level/package variant of "Python"

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-introduction-to-python",
    userInput: {
      candidates: [
        {
          description: "Use Python to write programs.",
          language: "en",
          slug: "python",
          targetLanguage: null,
          title: "Python",
        },
      ],
      suggestion: {
        description: "Start writing Python programs.",
        language: "en",
        targetLanguage: null,
        title: "Introduction to Python",
      },
    },
  },
  {
    expectations: `
      - Must choose "useExisting"
      - Must choose courseSlug "machine-learning-pt"
      - The suggested Portuguese title and the candidate English title refer to the same Portuguese course

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-aprendizado-de-maquina",
    userInput: {
      candidates: [
        {
          description: "Modelos que aprendem padrões a partir de dados.",
          language: "pt",
          slug: "machine-learning-pt",
          targetLanguage: null,
          title: "Machine Learning",
        },
      ],
      suggestion: {
        description: "Modelos que aprendem com dados.",
        language: "pt",
        targetLanguage: null,
        title: "Aprendizado de máquina",
      },
    },
  },
  {
    expectations: `
      - Must choose "createNew"
      - courseSlug must be null
      - "Deep Learning" is a narrower independent field, not the same course as "Machine Learning"

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-deep-learning-not-machine-learning",
    userInput: {
      candidates: [
        {
          description: "Classical and modern models that learn from data.",
          language: "en",
          slug: "machine-learning",
          targetLanguage: null,
          title: "Machine Learning",
        },
      ],
      suggestion: {
        description: "Neural-network methods with many layers.",
        language: "en",
        targetLanguage: null,
        title: "Deep Learning",
      },
    },
  },
  {
    expectations: `
      - Must choose "createNew"
      - courseSlug must be null
      - "React" has its own identity and should not map to "JavaScript"

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-react-not-javascript",
    userInput: {
      candidates: [
        {
          description: "The JavaScript language.",
          language: "en",
          slug: "javascript",
          targetLanguage: null,
          title: "JavaScript",
        },
      ],
      suggestion: {
        description: "Build interfaces with React.",
        language: "en",
        targetLanguage: null,
        title: "React",
      },
    },
  },
  {
    expectations: `
      - Must choose "useExisting"
      - Must choose courseSlug "ingles-pt"
      - TOEFL preparation belongs to the English language course

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-toefl-english",
    userInput: {
      candidates: [
        {
          description: "Curso para aprender inglês.",
          language: "pt",
          slug: "ingles-pt",
          targetLanguage: "en",
          title: "Inglês",
        },
      ],
      suggestion: {
        description: "Preparação para uma prova de proficiência em inglês.",
        language: "pt",
        targetLanguage: "en",
        title: "TOEFL",
      },
    },
  },
  {
    expectations: `
      - Must choose "createNew"
      - courseSlug must be null
      - English literature is about literature, not learning the English language

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-english-literature-not-language",
    userInput: {
      candidates: [
        {
          description: "Learn the English language.",
          language: "en",
          slug: "english",
          targetLanguage: "en",
          title: "English",
        },
      ],
      suggestion: {
        description: "Study major works written in English.",
        language: "en",
        targetLanguage: null,
        title: "English Literature",
      },
    },
  },
  {
    expectations: `
      - Must choose "createNew"
      - courseSlug must be null
      - "California Law" and "Brazilian Law" differ by jurisdiction

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-california-law-not-brazilian-law",
    userInput: {
      candidates: [
        {
          description: "Legal systems and rules in Brazil.",
          language: "en",
          slug: "brazilian-law",
          targetLanguage: null,
          title: "Brazilian Law",
        },
      ],
      suggestion: {
        description: "Legal systems and rules in California.",
        language: "en",
        targetLanguage: null,
        title: "California Law",
      },
    },
  },
  {
    expectations: `
      - Must choose "createNew"
      - courseSlug must be null
      - "Matrix" alone is ambiguous and should not map to the movie candidate

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-matrix-ambiguous",
    userInput: {
      candidates: [
        {
          description: "The 1999 science fiction film.",
          language: "en",
          slug: "the-matrix",
          targetLanguage: null,
          title: "The Matrix",
        },
      ],
      suggestion: {
        description: "A course about matrices or media.",
        language: "en",
        targetLanguage: null,
        title: "Matrix",
      },
    },
  },
  {
    expectations: `
      - Must choose "useExisting"
      - Must choose courseSlug "calculus"
      - "Differential Calculus" is consolidated into the broader Calculus course

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-differential-calculus",
    userInput: {
      candidates: [
        {
          description: "Limits, derivatives, integrals, and applications.",
          language: "en",
          slug: "calculus",
          targetLanguage: null,
          title: "Calculus",
        },
        {
          description: "Vectors and matrices.",
          language: "en",
          slug: "linear-algebra",
          targetLanguage: null,
          title: "Linear Algebra",
        },
      ],
      suggestion: {
        description: "Derivatives and rates of change.",
        language: "en",
        targetLanguage: null,
        title: "Differential Calculus",
      },
    },
  },
];
