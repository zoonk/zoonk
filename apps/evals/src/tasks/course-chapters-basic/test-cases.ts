const SHARED_EXPECTATIONS = `
  - Chapters should be 3-7 words long
  - Should create a progressive learning path from fundamentals to practical applications
  - Should cover enough content to prepare learners for entry-level positions. After finishing this course, they should be able to get a job in the field
  - Should introduce basic resources and career options in the field
  - Should strongly cover fundamentals but also prepare them for practical applications in real-world scenarios
  - Should NOT include personalized content like "Build Your Own X", "Final Project", or "Your First X"
  - Should use modern terminology and everyday language, avoiding overly technical jargon
  - Should be split into granular topics (many smaller chapters rather than few large ones)
  - Should follow the language specified by locale parameter
`;

export const TEST_CASES = [
  {
    expectations: `
      - Prepare students for entry-level Python roles
      - MUST be in Brazilian Portuguese

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-python",
    userInput: { courseTitle: "Python", locale: "pt" },
  },
  {
    expectations: `
      - Prepare students for entry-level web developer roles
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
      - MUST cover grammar basics: articles, gender, verb conjugations
      - MUST introduce pronunciation and phonetics
      - SHOULD include chapters on common phrases and vocabulary themes
      - SHOULD cover cultural context for language learning
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
