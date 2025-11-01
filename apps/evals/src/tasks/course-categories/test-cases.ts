const SHARED_EXPECTATIONS = `
  - Choose from the fixed set only
  - Pick the primary functional domain first; add a secondary ONLY if it is central to the course goals
  - Anchor on learning outcomes, not surface keywords
  - Languages strict/important rule: Use 'languages' only when the course is about learning a language (e.g., Spanish, English, JLPT prep). Do NOT use 'languages' for literature, linguistics, or cultural studies
`;

export const TEST_CASES = [
  {
    expectations: `
      - MUST include 'math'.
      - SHOULD NOT include 'languages'.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-calculus",
    userInput: { courseTitle: "Calculus" },
  },
  {
    expectations: `
      - MUST include 'languages'.
      - SHOULD NOT include other categories

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-ingles",
    userInput: { courseTitle: "Inglês" },
  },
  {
    expectations: `
      - MUST include 'history'.
      - SHOULD NOT include 'languages'.

      ${SHARED_EXPECTATIONS}
    `,
    id: "es-historia-de-roma",
    userInput: { courseTitle: "Historia de Roma" },
  },
  {
    expectations: `
      - MUST NOT include 'languages' (strict rule: literature is not language learning).
      - SHOULD include 'arts' and/or 'culture'.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-spanish-literature-strict-rule",
    userInput: { courseTitle: "Spanish Literature" },
  },
  {
    expectations: `
      - MUST NOT include 'languages' (strict rule: linguistics is not language learning).
      - SHOULD include 'culture' and/or 'society'.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-linguistics",
    userInput: { courseTitle: "Linguistics" },
  },
];
