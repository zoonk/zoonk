const SHARED_EXPECTATIONS = `
  - Choose from the fixed set only
  - Pick the primary functional domain first; add a secondary ONLY if it is central to the course goals
  - Anchor on learning outcomes, not surface keywords
`;

export const TEST_CASES = [
  {
    expectations: `
      - MUST include 'math'.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-calculus",
    userInput: { courseTitle: "Calculus" },
  },
  {
    expectations: `
      - MUST include 'history'.

      ${SHARED_EXPECTATIONS}
    `,
    id: "es-historia-de-roma",
    userInput: { courseTitle: "Historia de Roma" },
  },
  {
    expectations: `
      - SHOULD include 'arts' and/or 'culture'.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-spanish-literature-strict-rule",
    userInput: { courseTitle: "Spanish Literature" },
  },
  {
    expectations: `
      - SHOULD include 'culture' and/or 'society'.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-linguistics",
    userInput: { courseTitle: "Linguistics" },
  },
];
