const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. AUTHENTICITY: The quote must be a real statement by a real, named person. Never invented, paraphrased, or attributed to generic sources like "Common saying" or "Traditional wisdom". If the exact quote cannot be determined, the closest real, verifiable quote should be used.

2. ATTRIBUTION: Author must be a real, identifiable person in the format "Name, Year" (e.g., "Alan Turing, 1950") or just "Name" (e.g., "Marie Curie"). Never a generic source.

3. RELEVANCE: The quote must directly support the point described in the VISUAL_DESCRIPTION.

4. CONSTRAINTS: Quote text max 500 characters.

5. LANGUAGE: Text and author fields must be in the specified language. If the original quote is in a different language, provide a faithful translation.
`;

export const TEST_CASES = [
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-turing-machines",
    userInput: {
      description:
        "A quote from Alan Turing about whether machines can think. The quote should come from his 1950 paper 'Computing Machinery and Intelligence' where he proposed the imitation game (Turing test).",
      language: "en",
    },
  },
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-einstein-simplicity",
    userInput: {
      description:
        "A quote from Albert Einstein about making things as simple as possible but not simpler. This is often used in the context of scientific explanation and theory design.",
      language: "en",
    },
  },
  {
    expectations: `${SHARED_EXPECTATIONS}
LANGUAGE REQUIREMENT: All content must be in Brazilian Portuguese.
    `,
    id: "pt-curie-ciencia",
    userInput: {
      description:
        "Uma citação de Marie Curie sobre a importância da ciência e da pesquisa. A citação deve refletir sua dedicação à ciência e ao avanço do conhecimento.",
      language: "pt",
    },
  },
  {
    expectations: `${SHARED_EXPECTATIONS}
LANGUAGE REQUIREMENT: All content must be in Latin American Spanish.
    `,
    id: "es-darwin-adaptacion",
    userInput: {
      description:
        "Una cita de Charles Darwin sobre la adaptación y la supervivencia. La cita debe reflejar su idea de que no son los más fuertes sino los más adaptables los que sobreviven.",
      language: "es",
    },
  },
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-knuth-premature-optimization",
    userInput: {
      description:
        "Donald Knuth's famous quote about premature optimization being the root of all evil. The quote is from his 1974 paper 'Structured Programming with go to Statements'.",
      language: "en",
    },
  },
];
