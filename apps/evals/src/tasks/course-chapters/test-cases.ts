const SHARED_EXPECTATIONS = `
  - Extensive list of chapters
  - It allows learners to go from no knowledge to mastery of the subject
  - Starts with foundational topics and progresses to advanced topics
`;

export const TEST_CASES = [
  {
    id: "en-machine-learning",
    userInput: { courseTitle: "Machine Learning", locale: "en" },
    expectations: `
      - Content in US English

      ${SHARED_EXPECTATIONS}
    `,
  },
  {
    id: "pt-fisica-quantica",
    userInput: { courseTitle: "Física Quântica", locale: "pt" },
    expectations: `
      - Content in Brazilian Portuguese

      ${SHARED_EXPECTATIONS}
    `,
  },
  {
    id: "es-historia-espana",
    userInput: { courseTitle: "Historia de España", locale: "es" },
    expectations: `
      - Should follow chronological progression
      - Content in Spain Spanish

      ${SHARED_EXPECTATIONS}
    `,
  },
  {
    id: "fr-cuisine-francaise",
    userInput: { courseTitle: "Cuisine Française", locale: "fr" },
    expectations: `
      - Content in French

      ${SHARED_EXPECTATIONS}
    `,
  },
  {
    id: "pt-marketing-digital",
    userInput: { courseTitle: "Marketing Digital", locale: "pt" },
    expectations: `
      - Content in Brazilian Portuguese

      ${SHARED_EXPECTATIONS}
    `,
  },
  {
    id: "en-the-matrix",
    userInput: { courseTitle: "The Matrix", locale: "en" },
    expectations: `
      - Should be specific to The Matrix film/trilogy, not confused with Matrix as a mathematical concept
      - Content in US English

      ${SHARED_EXPECTATIONS}
    `,
  },
  {
    id: "pt-direito",
    userInput: { courseTitle: "Direito", locale: "pt" },
    expectations: `
      - Covers Brazilian law system
      - Content in Brazilian Portuguese

      ${SHARED_EXPECTATIONS}
    `,
  },
  {
    id: "es-derecho-mexicano",
    userInput: { courseTitle: "Derecho Mexicano", locale: "es" },
    expectations: `
      - Covers Mexican law system
      - Content in Mexican Spanish

      ${SHARED_EXPECTATIONS}
    `,
  },
  {
    id: "en-java",
    userInput: { courseTitle: "Java", locale: "en" },
    expectations: `
    - Must not confuse with JavaScript
    - Content in US English

    ${SHARED_EXPECTATIONS}
  `,
  },
  {
    id: "en-python",
    userInput: { courseTitle: "Python", locale: "en" },
    expectations: `
    - Must focus on Python programming language, not the snake
    - Content in US English

    ${SHARED_EXPECTATIONS}
  `,
  },
];
