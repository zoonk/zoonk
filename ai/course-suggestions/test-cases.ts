const SHARED_EXPECTATIONS = `
  - The main focus is the \`title\` field, no need to pay much attention to the \`description\` field
  - No level/joiner words like "basic", "intermediate", "advanced", "fundamentals", etc
  - No words like "course" in the title
  - Titles are always in Title Case
`;

export const TEST_CASES = [
  {
    locale: "pt",
    prompt: "I want to code",
    expectations: `
      - titles should look like these: "Programação","Ciência da Computação","Desenvolvimento Web","Engenharia de Software"
      - all titles and descriptions in Brazilian Portuguese

      ${SHARED_EXPECTATIONS}
    `,
  },
  {
    locale: "en",
    prompt: "quero aprender sobre buracos negros",
    expectations: `
      - suggestions should include "Black Holes"
      - suggestions may include broader topics like "Astrophysics"
      - all titles and descriptions in English

      ${SHARED_EXPECTATIONS}
    `,
  },
];
