const SHARED_EXPECTATIONS = `
  - It should assume learners start with no prior knowledge of the subject
  - Should create a progressive learning path going from basic/beginner to mastery of the subject
  - By the end of this course, they should be able to lead very complex projects and tasks in this field
  - They should be prepared for certifications or advanced studies in this subject like a master's degree or PhD
  - Should include **EVERYTHING** a student needs to be at the top 1% of the field
  - Should follow the language specified by language parameter
  - Should follow title and description guidelines: no fluff, be concise, straight to the point
  - Should cover latest trends in the field
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
    - "Introduction to X" is valid for titles of introductory chapters but we should avoid those words in descriptions
  - Similarly, descriptions should be concise and straight to the point, no fluff/filler words. For example:
    - "Styling with CSS: Selectors, properties, the box model, Flexbox, CSS Grid, and cascade principles." is better than "Master styling and layout with CSS, including selectors, properties, the box model, Flexbox, CSS Grid, and cascade principles." - "Master" is fluff, and so are words like "learn", "understand", "explore", etc.
    - "Properties of matter, states, and phase transitions." is better than "Explore the definition of Chemistry, properties of matter, states, and phase transitions." - "Explore the definition of Chemistry" are filler/unnecessary words.
  - Don't add capstone/final projects, assessments, or exercises
  - It shouldn't mention in title or description references to 1% or similar instructions about being top 1%
`;

export const TEST_CASES = [
  {
    expectations: `
      - Prepare students for Python roles
      - MUST be in Brazilian Portuguese

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-python",
    userInput: { courseTitle: "Python", language: "pt" },
  },
  {
    expectations: `
      - Prepare students for web developer roles
      - MUST be in US English

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-web-development",
    userInput: { courseTitle: "Web Development", language: "en" },
  },
  {
    expectations: `
      - It's fine (and expected) to mention popular frameworks like Scrum and Kanban as part of the methodologies
      - MUST be in Brazilian Portuguese

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-metodologias-ageis",
    userInput: { courseTitle: "Metodologias Ágeis", language: "pt" },
  },
  {
    expectations: `
      - MUST be in Spanish

      ${SHARED_EXPECTATIONS}
    `,
    id: "es-quimica",
    userInput: { courseTitle: "Química", language: "es" },
  },
  {
    expectations: `
      - MUST be in US English

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-economics",
    userInput: { courseTitle: "Economics", language: "en" },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-neurociencia",
    userInput: { courseTitle: "Neurociência", language: "pt" },
  },
  {
    expectations: `
      - SHOULD cover everyday communication scenarios
      - MUST be in English (teaching Spanish)
      - Should reach at least A2 proficiency
      - Don't add culture-specific chapters, just focus on language learning
      - Don't add proficiency exam preparation chapters, just focus on language learning skills
      - Don't add career chapter since this is an exception to the career-related rule. Main focus here is language learning

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-spanish",
    userInput: { courseTitle: "Spanish", language: "en" },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Should cover Brazilian Law
      
      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-direito",
    userInput: { courseTitle: "Direito", language: "pt" },
  },
  {
    expectations: `
      - MUST be in US English
      - Can mention Google Cloud vendor since this is a vendor-specific course, so it's an exception to the rule of not using vendors.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-google-cloud",
    userInput: { courseTitle: "Google Cloud", language: "en" },
  },
  {
    expectations: `
      - MUST be in UK English
      - Should cover British Law

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-uk-law",
    userInput: { courseTitle: "UK Law", language: "en" },
  },
  {
    expectations: `
      - MUST be in US English

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-brazilian-history",
    userInput: { courseTitle: "Brazilian History", language: "en" },
  },
  {
    expectations: `
        - MUST be in US English
        - Should not cover career-related chapters since this is a pop culture topic

        ${SHARED_EXPECTATIONS}
      `,
    id: "en-harry-potter",
    userInput: { courseTitle: "Harry Potter", language: "en" },
  },
];
