export type CourseIconInput = {
  /** Names the saved image file. */
  caseId: string;
  title: string;
  description: string;
  /** The course's language, for reporting; icons carry no text. */
  language: string;
};

const ICON_RULES =
  "One single object, centered, with a strong clean silhouette, in smooth matte 3D with soft lighting and a subtle shadow, 2 to 4 colors, isolated on a plain white background, like an app icon. No scene, no second object, no background props and no text, letters or numbers.";

/** Courses whose titles alone could mislead, so the description has to pick the right object. */
export const TEST_CASES = [
  {
    expectations: `An object that clearly stands for immunology and the body's defenses, such as a shield with a cell or an antibody, not a generic medical cross or pill bottle. ${ICON_RULES}`,
    id: "en-immunology",
    userInput: {
      caseId: "en-immunology",
      description:
        "Immunology is how the body tells friend from foe. The course covers germs, antibodies, memory cells and how vaccines train the immune system.",
      language: "en",
      title: "Immunology",
    },
  },
  {
    expectations: `An object that clearly stands for economics: money, prices or markets (such as a coin with a rising arrow or a balance of goods and coins), not an unrelated office object. ${ICON_RULES}`,
    id: "pt-economia",
    userInput: {
      caseId: "pt-economia",
      description:
        "Economia estuda como pessoas, empresas e governos fazem escolhas com recursos escassos: preços, juros, inflação e o papel do governo.",
      language: "pt",
      title: "Economia",
    },
  },
  {
    expectations: `An object that clearly stands for data analysis, such as a bar chart or a magnifying glass over a chart, not a generic computer. ${ICON_RULES}`,
    id: "en-data-analysis",
    userInput: {
      caseId: "en-data-analysis",
      description:
        "Data analysis turns raw numbers into answers: cleaning data, summarizing it, charting it honestly and checking conclusions.",
      language: "en",
      title: "Data analysis",
    },
  },
];
