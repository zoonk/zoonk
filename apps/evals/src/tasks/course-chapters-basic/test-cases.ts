const SHARED_EXPECTATIONS = `
  - Should create a progressive learning path from fundamentals to practical applications
  - After finishing this course, they should be ready to get a job in the field
  - Should follow the language specified by locale parameter
`;

export const TEST_CASES = [
  {
    expectations: `
      - Prepare students for Python roles
      - MUST be in Brazilian Portuguese

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-python",
    userInput: { courseTitle: "Python", locale: "pt" },
  },
  {
    expectations: `
      - Prepare students for web developer roles
      - MUST be in US English

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-web-development",
    userInput: { courseTitle: "Web Development", locale: "en" },
  },
  {
    expectations: `
      - Cover how to apply agile methodologies not only in software but in various project types
      - MUST be in Brazilian Portuguese

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-metodologias-ageis",
    userInput: { courseTitle: "Metodologias Ágeis", locale: "pt" },
  },
  {
    expectations: `
      - MUST be in Spanish

      ${SHARED_EXPECTATIONS}
    `,
    id: "es-quimica",
    userInput: { courseTitle: "Química", locale: "es" },
  },
  {
    expectations: `
      - MUST be in English

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-economics",
    userInput: { courseTitle: "Economics", locale: "en" },
  },
  {
    expectations: `
      - MUST be in Portuguese (Brazil)

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-neurociencia",
    userInput: { courseTitle: "Neurociência", locale: "pt" },
  },
  {
    expectations: `
      - SHOULD cover everyday communication scenarios
      - MUST be in English (teaching Spanish)
      - Should prepare students for basic conversations and A1/A2 proficiency

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-spanish",
    userInput: { courseTitle: "Spanish", locale: "en" },
  },
  {
    expectations: `
      - MUST be in Portuguese (Brazil)
      - Should cover Brazilian Law
      
      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-direito",
    userInput: { courseTitle: "Direito", locale: "pt" },
  },
];
