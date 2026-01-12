const SHARED_EXPECTATIONS = `
  - Must be **1-3 sentences** maximum
  - Must be written in the specified language (en, pt, or es)
  - Must go **straight to the point** — no fluff, fillers, or unnecessary words
  - Must NEVER use words like "learn", "understand", "explore", "introduction to", "basics of", "comprehensive guide to", "master", etc.
  - Must define **what the topic is**
  - Must explain **what learners will gain** from the course
  - Must convey **why this is important**
  - Must **avoid technical jargon** — write for someone with no prior knowledge
  - Must focus on outcomes and career opportunities rather than specific tools/technologies
  - For professional topics: Must specify **career opportunities** and **work environments** (e.g., "work at tech companies, agencies, or as a freelancer")
  - For languages: Must reference CEFR levels (A1 to C2) and communication abilities
  - For hobbies/pop culture: Should focus on comprehensive coverage without career implications
  - Should be **concise**, **clear**, and **specific**
`;

export const TEST_CASES = [
  {
    expectations: `
      - Should define what frontend development is (creating user interfaces)
      - Should NOT list technical tools/technologies (HTML, CSS, JavaScript, etc.)
      - Should specify career opportunities
      - Should be in US English

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-frontend-development",
    userInput: {
      language: "en",
      title: "Frontend Development",
    },
  },
  {
    expectations: `
      - Should define what French proficiency means
      - Should mention CEFR progression (A1 to C2)
      - Should explain communication abilities and opportunities
      - Should be in US English

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-french",
    userInput: {
      language: "en",
      title: "French",
    },
  },
  {
    expectations: `
      - Should define what artificial intelligence is
      - Should NOT list specific subfields as technical details
      - Should specify career opportunities
      - Should be in Brazilian Portuguese

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-inteligencia-artificial",
    userInput: {
      language: "pt",
      title: "Inteligência Artificial",
    },
  },
  {
    expectations: `
      - Should define what web development is
      - Should NOT list technical tools/technologies (HTML, CSS, JavaScript, etc.)
      - Should specify career opportunities
      - Should be in Latin American Spanish

      ${SHARED_EXPECTATIONS}
    `,
    id: "es-desarrollo-web",
    userInput: {
      language: "es",
      title: "Desarrollo Web",
    },
  },
  {
    expectations: `
      - Should define what The Matrix is
      - Should convey cultural importance
      - Should NOT mention career opportunities (pop culture topic)
      - Should be in US English

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-the-matrix",
    userInput: {
      language: "en",
      title: "The Matrix",
    },
  },
];
