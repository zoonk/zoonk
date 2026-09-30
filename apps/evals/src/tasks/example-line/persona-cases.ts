import { getSeedLearner, getSeedScreen } from "@/datasets/seed-learners";
import { type TestCase } from "@/lib/types";
import { type GenerateExampleLineParams } from "@zoonk/ai/tasks/v2/variants/example-line";

type ExampleLineInput = Omit<
  GenerateExampleLineParams,
  "analytics" | "model" | "reasoning" | "useFallback"
>;

const SHARED_EXPECTATIONS = `
  - The output is \`line\`: one sentence, or null when nothing the learner shared fits
  - Don't evaluate JSON formatting
`;

/**
 * The learner's facts and goal as production hands them over, on a real screen of the lesson they
 * study. `idea` is the example slot the writer leaves on that screen.
 */
function personaCase({
  expectations,
  id,
  idea,
  learnerKey,
  lessonKey,
  title,
}: {
  expectations: string;
  id: string;
  idea: string;
  learnerKey: string;
  lessonKey: string;
  title: string;
}): TestCase<never, ExampleLineInput> {
  const learner = getSeedLearner(learnerKey);
  const screen = getSeedScreen({ learner, lessonKey, title });

  return {
    expectations: `${expectations}\n${SHARED_EXPECTATIONS}`,
    id: `${learner.language}-persona-${id}`,
    userInput: {
      facts: learner.facts.map(({ statement }) => statement),
      goal: learner.goal.title,
      idea,
      language: learner.language,
      screenText: screen.text,
    },
  };
}

/** Example lines for the seed learners (shared eval dataset), in English and Portuguese. */
export const PERSONA_TEST_CASES: TestCase<never, ExampleLineInput>[] = [
  personaCase({
    expectations: `
      - MUST be in US English
      - Maya is a night-shift nurse who wants to read papers about quantum computers: a tiny quantity from her work (a dose in micrograms, a drop's volume) or from quantum hardware fits, written with a negative power of ten
      - The power must be right (a microgram is 1 × 10⁻⁶ g) and the line must keep "negative power means small"
      - It must not give medical advice beyond the arithmetic
    `,
    id: "maya-negative-powers",
    idea: "Something tiny the learner meets in their work or interests, written with a negative power of ten.",
    learnerKey: "maya",
    lessonKey: "scientific-notation",
    title: "Small numbers, negative powers",
  }),
  personaCase({
    expectations: `
      - MUST be in US English
      - Sam just started investing through an index fund: a line saying that an index up 2% moves his fund by about 2% that day, with correct numbers (for example, $500 becomes about $510), fits
      - It must not recommend buying, selling or holding anything, nor promise returns
    `,
    id: "sam-index-fund",
    idea: "Money the learner already has in the market, moving with the index on one day.",
    learnerKey: "sam",
    lessonKey: "market-up-two-percent",
    title: "Why it matters to you",
  }),
  personaCase({
    expectations: `
      - MUST be in Brazilian Portuguese
      - Ana is preparing for the ENEM to study Medicine and takes a Saturday prep course: a discount on something she pays for (the prep course, books, a lab coat) fits, computed with the 10% shortcut, and the numbers must be right
      - It must not promise that she passes or gets into Medicine
    `,
    id: "ana-ten-percent-shortcut",
    idea: "Um preço que a pessoa paga, com o desconto calculado pelo atalho dos 10%.",
    learnerKey: "ana",
    lessonKey: "percent-discount",
    title: "O atalho dos 10%",
  }),
  personaCase({
    expectations: `
      - MUST be in Brazilian Portuguese
      - Lucas likes science fiction and prefers explanations without calculations: a line about the colors in a science-fiction scene (a ship's engine glow, a nebula, a lightsaber) fits, with no numbers or formulas
      - The physics must stay right: bigger drops give bluer light, and each element has its own set of colors
    `,
    id: "lucas-colors-sci-fi",
    idea: "Uma cor que a pessoa vê numa história ou no dia a dia, ligada ao tamanho da queda de energia.",
    learnerKey: "lucas",
    lessonKey: "why-colors-exist",
    title: "O tamanho da queda é a cor",
  }),
  personaCase({
    expectations: `
      - MUST be in Brazilian Portuguese
      - Pedro, a teenager, wants to learn to invest his allowance: a line about owning a small slice of a company he knows with his allowance, and what that slice gives him (a share of dividends, a vote or its growth), fits
      - It must not recommend a specific stock, must not promise returns and must say or imply that returns aren't guaranteed if it mentions money made
    `,
    id: "pedro-allowance-shareholder",
    idea: "Uma empresa que a pessoa conhece e da qual poderia ter uma pequena fatia.",
    learnerKey: "pedro",
    lessonKey: "own-a-share",
    title: "O que o acionista recebe",
  }),
  personaCase({
    expectations: `
      - MUST be in Brazilian Portuguese, with the English question in English
      - Marcos is moving to Toronto with his wife and works in IT: a question he will ask there (the rent or deposit of an apartment, a laptop, how many rooms) fits, with how much for prices and uncountable things and how many for things counted
      - The English must be correct
    `,
    id: "marcos-toronto-how-much",
    idea: "Uma pergunta em inglês que a pessoa vai fazer na nova cidade.",
    learnerKey: "marcos",
    lessonKey: "how-much-is-the-rent",
    title: "How much ou how many?",
  }),
];
