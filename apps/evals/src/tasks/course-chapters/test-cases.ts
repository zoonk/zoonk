const SHARED_EXPECTATIONS = `
  - It should assume learners start with no prior knowledge of the subject
  - Should create a progressive learning path going from beginner foundations to deep mastery of the subject
  - Should stay tightly focused on the course title instead of drifting into generic academic or professional content
  - Early chapters should cover canonical topics learners would reasonably expect from the course title
  - Should include the essential knowledge and practical skills needed to become highly capable in the field
  - Should follow the language specified by language parameter
  - Should follow title and description guidelines: no fluff, be concise, straight to the point
  - Should keep the curriculum modern and relevant without replacing canonical foundations with trends
  - If supporting topics like research methods, communication, statistics, ethics, regulation, or career are included, they should be clearly scoped to the course title rather than generic
  - Generic cross-disciplinary chapters that could be copied unchanged into many different courses are a major error unless they are explicitly the subject of the course
  - Prefer concept names over vendor names in chapter titles/descriptions (e.g., "Package management" instead of "npm"). Ecosystem-level tools (npm, yarn, Redux, Zustand) should be avoided in titles
    - Exception: foundational tools that ARE the course subject matter are allowed (e.g., "Git" in a programming course, "Node.js" in a web dev course, "Docker" in a DevOps course). The test: would a chapter about this subject be incomplete without mentioning this tool?
    - Vendor name usage is a minor issue — it affects title quality but not pedagogical content. Do NOT treat it as a major error
  - For professional fields, practical readiness refers to knowledge and skills, not legal licenses or credentials. That's not important here
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
  - Don't add assessment-style chapters: no final projects, capstone assignments, exercises, quizzes, or "test your knowledge" chapters. A theoretical synthesis chapter (e.g., "Design Patterns in Architecture") is fine even if it synthesizes prior material — the rule targets assessment/project chapters, not synthesis of knowledge. If a chapter uses the word "capstone" but is theoretical (not an assignment), treat it as a minor issue at most, not a major error
  - It shouldn't mention in title or description prompt instructions or performance claims about the learner
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
      - MUST be in Brazilian Portuguese
      - The opening chapters should feel unmistakably like biology, with canonical foundations such as cells, biomolecules, genetics, evolution, physiology, ecology, or other core biology topics
      - Generic titles like "Pensamento científico", "prática de pesquisa", "literatura científica", or "comunicação acadêmica" do not belong unless they are explicitly scoped to biology and are not the main opening focus

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-biologia",
    userInput: { courseTitle: "Biologia", language: "pt" },
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
      - MUST be in Brazilian Portuguese
      - Should cover core computer science areas such as computation, programming, data structures, algorithms, systems, data, or AI
      - Should stay focused on computer science itself rather than generic professional advice

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-ciencia-da-computacao",
    userInput: { courseTitle: "Ciência da Computação", language: "pt" },
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
      - UK spelling is expected (e.g., "offences" not "offenses", "defence" not "defense"). Using US spellings in a UK Law course is a minor error — it shows dialect inconsistency but does not affect pedagogical quality. Do NOT treat spelling variants as a major error

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
