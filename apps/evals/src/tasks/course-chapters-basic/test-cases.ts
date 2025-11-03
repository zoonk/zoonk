const SHARED_EXPECTATIONS = `
  - Should create a progressive learning path building upon previous chapters
  - After finishing this course, they should be ready for a mid-level job in the field
  - Should follow the language specified by locale parameter
  - Should follow title and description guidelines: no fluff, be concise, straight to the point
  - Should cover latest trends in the field
  - Should **NOT** include topics that are tailored towards intermediate or expert learners but it should include **EVERYTHING** needed for the learner to perform extremely well for a mid-level job in the field
  - Don't use vendors in chapter titles or descriptions (e.g. "npm", "yarn", "Redux", etc.)
    - Except are for widely known tools related to the course (e.g. "Git" in a programming course)
  - This is an eval system for a learning platform, of course the definition of "ready for a job" doesn't mean they have the legal requirements to work in the field (eg. medical license, law license, etc.). That's not important here, we're assessing if the course prepares the student with the necessary knowledge and skills.
  - You don't need to evaluate the output format here, just focus on the chapter content quality.
  - Titles should be concise and straight to the point, no fluff/filler words. For example:
    - Just "HTML" is better than "HTML Structure and Semantics" (structure and semantics are implied if this is the only HTML chapter). Similarly, if we only have one CSS chapter, just "CSS" is better than "CSS Styling and Layout".
    - "Front-end frameworks" is better than "Front-End UI Frameworks Overview" (too verbose) or "Front-End Frameworks: Core Concepts" (core concepts is unnecessary fluff)
    - "Relational Databases" is better than "Relational Databases and SQL" (SQL is implied, no need to mention)
    - "Introduction to Java" is better than "Introduction to Java and Setting Up Your Development Environment" (too verbose)
    - "Lean Startup" is better than "The Lean Startup Methodology: An Overview" (too verbose)
  - Similarly, descriptions should be concise and straight to the point, no fluff/filler words. For example:
    - "Styling with CSS: Selectors, properties, the box model, Flexbox, CSS Grid, and cascade principles." is better than "Master styling and layout with CSS, including selectors, properties, the box model, Flexbox, CSS Grid, and cascade principles." - "Master" is fluff, and so are words like "learn", "understand", "explore", etc.
    - "Properties of matter, states, and phase transitions." is better than "Explore the definition of Chemistry, properties of matter, states, and phase transitions." - "Explore the definition of Chemistry" are filler/unnecessary words.
`;

const SHARED_INPUT = { level: "basic", previousChapters: [] };

export const TEST_CASES = [
  {
    expectations: `
      - Prepare students for Python roles
      - MUST be in Brazilian Portuguese

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-python",
    userInput: { ...SHARED_INPUT, courseTitle: "Python", locale: "pt" },
  },
  {
    expectations: `
      - Prepare students for web developer roles
      - MUST be in US English

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-web-development",
    userInput: {
      ...SHARED_INPUT,
      courseTitle: "Web Development",
      locale: "en",
    },
  },
  {
    expectations: `
      - It's fine (and expected) to mention popular frameworks like Scrum and Kanban as part of the methodologies
      - MUST be in Brazilian Portuguese

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-metodologias-ageis",
    userInput: {
      ...SHARED_INPUT,
      courseTitle: "Metodologias Ágeis",
      locale: "pt",
    },
  },
  {
    expectations: `
      - MUST be in Spanish

      ${SHARED_EXPECTATIONS}
    `,
    id: "es-quimica",
    userInput: { ...SHARED_INPUT, courseTitle: "Química", locale: "es" },
  },
  {
    expectations: `
      - MUST be in English

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-economics",
    userInput: { ...SHARED_INPUT, courseTitle: "Economics", locale: "en" },
  },
  {
    expectations: `
      - MUST be in Portuguese (Brazil)

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-neurociencia",
    userInput: { ...SHARED_INPUT, courseTitle: "Neurociência", locale: "pt" },
  },
  {
    expectations: `
      - SHOULD cover everyday communication scenarios
      - MUST be in English (teaching Spanish)
      - Should prepare students for basic conversations and A1/A2 proficiency

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-spanish",
    userInput: { ...SHARED_INPUT, courseTitle: "Spanish", locale: "en" },
  },
  {
    expectations: `
      - MUST be in Portuguese (Brazil)
      - Should cover Brazilian Law
      
      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-direito",
    userInput: { ...SHARED_INPUT, courseTitle: "Direito", locale: "pt" },
  },
  {
    expectations: `
      - MUST be in US English.
      - Can mention Google Cloud vendor since this is a vendor-specific course, so it's an exception to the rule of not using vendors.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-google-cloud",
    userInput: { ...SHARED_INPUT, courseTitle: "Google Cloud", locale: "en" },
  },
];
