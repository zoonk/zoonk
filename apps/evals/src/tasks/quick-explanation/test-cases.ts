import { type TestCase } from "@/lib/types";
import { type QuickExplanationParams } from "@zoonk/ai/tasks/v2/explain/quick-explanation";

type QuickExplanationInput = Pick<QuickExplanationParams, "language" | "question">;

export const TEST_CASES: TestCase<unknown, QuickExplanationInput>[] = [
  {
    expectations: `Explanation in Brazilian Portuguese of compound interest (juros sobre juros), so growth speeds up over time. Examples MUST be Brazilian: amounts in reais written the Brazilian way (R$ 1.000,00 or R$ 1.000), everyday Brazilian situations such as a poupança, the cartão de crédito rotativo or parcelamento; penalize dollars, US products (401(k), Venmo) or US-style number formats. No formula; must not recommend a specific investment.`,
    id: "pt-juros-compostos-contexto-local",
    userInput: { language: "pt", question: "como funcionam os juros compostos?" },
  },
  {
    expectations: `Explanation in Brazilian Portuguese of how the US credit score works: the question sets the place, so it stays in the United States (a FICO score from about 300 to 850, the three credit bureaus, paying on time and using little of the card's limit), with amounts in dollars. Penalize swapping it for Brazil's Serasa score as if it were the same system; a one-line comparison is fine. No personal financial advice.`,
    id: "pt-credit-score-eua-lugar-da-pergunta",
    userInput: { language: "pt", question: "Como funciona o credit score nos Estados Unidos?" },
  },
  {
    expectations: `Explanation in US English of how taxes come out of a paycheck: federal income tax withheld based on the W-4, Social Security and Medicare (FICA), and state income tax in most states; the refund or bill at tax time settles the difference. Examples in dollars with US situations. Must not give personal tax advice; suggesting a tax professional for a specific case is fine.`,
    id: "en-paycheck-taxes-local",
    userInput: { language: "en", question: "why is my paycheck smaller than my salary?" },
  },
  {
    expectations: `Microwaves make water molecules in food jiggle, and that motion is heat. Penalize the common myth that microwaves cook "from the inside out" and any claim that they make food radioactive. A good practical example: why a cup of water heats but an empty plate barely warms, or why food heats unevenly.`,
    id: "en-microwave",
    userInput: { language: "en", question: "How does a microwave heat food?" },
  },
  {
    expectations: `Explanation in Brazilian Portuguese: inflation is a general, continuous rise in prices that makes money buy less. A good story uses everyday Brazilian examples (supermarket, bus fare) and can mention that a little inflation is normal. No formulas.`,
    id: "pt-inflacao",
    userInput: { language: "pt", question: "o que é inflação?" },
  },
  {
    expectations: `Sunlight scatters off air molecules, and blue light scatters much more than red (Rayleigh scattering); our eyes and the sun's spectrum explain why it looks blue and not violet. Sunsets are red because light crosses more air. Penalize "the sky reflects the ocean".`,
    id: "en-sky-blue",
    userInput: { language: "en", question: "why is the sky blue" },
  },
  {
    expectations: `Explanation in Brazilian Portuguese of how a vaccine trains the immune system with a harmless piece or version of a germ, so the body recognizes it later. Must be accurate and must not give personal medical advice; saying to talk to a health professional about a specific case is fine. Penalize claims that vaccines give the disease or are 100% effective.`,
    id: "pt-vacina",
    userInput: { language: "pt", question: "Como funciona uma vacina?" },
  },
  {
    expectations: `Compound interest means earning interest on past interest, so growth speeds up over time. The question doesn't ask for a formula, so none should appear; numbers in an example are fine. Must not recommend a specific investment.`,
    id: "en-compound-interest",
    userInput: { language: "en", question: "I never understood how compound interest works" },
  },
  {
    expectations: `Explanation in Brazilian Portuguese. The question asks for the quadratic formula (fórmula de Bhaskara), so showing it is allowed and expected, but each part must be explained in words, with what the discriminant (delta) tells you about the number of solutions and one worked example with small numbers.`,
    id: "pt-bhaskara-formula-pedida",
    userInput: { language: "pt", question: "me explica a fórmula de Bhaskara" },
  },
];
