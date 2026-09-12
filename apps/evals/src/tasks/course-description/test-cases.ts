const SHARED_EXPECTATIONS = `
  - Must be **1-3 sentences** maximum
  - Must be written in the specified language (en, pt, or es)
  - Must go **straight to the point** — no fluff, fillers, or unnecessary words
  - Use direct natural language; learn/understand/explore are allowed when useful, but avoid canned hype.
  - Must define **what the topic is**
  - Must explain **what learners will gain** from the course
  - Must convey **why this is important**
  - Must **avoid technical jargon** — write for someone with no prior knowledge
  - Focus on a concrete capability, not a list of technologies or careers.
  - Do not force career or employer boilerplate into professional topics, or imply completing a course guarantees a job.
  - For languages: Must reference CEFR levels (A1 to C2) and communication abilities
  - For hobbies/pop culture: Should focus on comprehensive coverage without career implications
  - Should be **concise**, **clear**, and **specific**
`;

export const TEST_CASES = [
  {
    expectations: `A brief, inviting answer to the narrow question, not a technical syllabus. Must distinguish perceived size from measurement without pretending the exact perceptual cause is settled. No list of jargon or career promises. ${SHARED_EXPECTATIONS}`,
    id: "en-question-moon-illusion",
    userInput: {
      format: "question" as const,
      language: "en",
      title: "Why the Moon Looks Larger Near the Horizon",
    },
  },
  {
    expectations: `
      - Should define what frontend development is (creating user interfaces)
      - Should NOT list technical tools/technologies (HTML, CSS, JavaScript, etc.)
      - Should name a practical capability without promising a job
      - Should be in US English

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-frontend-development",
    userInput: { language: "en", title: "Frontend Development" },
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
    userInput: { format: "language" as const, language: "en", title: "French" },
  },
  {
    expectations: `
      - Should define what artificial intelligence is
      - Should NOT list specific subfields as technical details
      - Should name a practical capability without promising a job
      - Should be in Brazilian Portuguese

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-inteligencia-artificial",
    userInput: { language: "pt", title: "Inteligência Artificial" },
  },
  {
    expectations: `
      - Should define what web development is
      - Should NOT list technical tools/technologies (HTML, CSS, JavaScript, etc.)
      - Should name a practical capability without promising a job
      - Should be in Latin American Spanish

      ${SHARED_EXPECTATIONS}
    `,
    id: "es-desarrollo-web",
    userInput: { language: "es", title: "Desarrollo Web" },
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
    userInput: { language: "en", title: "The Matrix" },
  },
];
