import { type TestCase } from "@/lib/types";

export type QuestionGeneralityInput = { question: string };
export type QuestionGeneralityExpected = { isGeneral: boolean };

function generalityCase(id: string, question: string, isGeneral: boolean) {
  return { expected: { isGeneral }, id, userInput: { question } };
}

/** Tutor questions sampled from production (`sample:production`) and labeled by hand. */
function productionCase(id: string, question: string, isGeneral: boolean) {
  return { ...generalityCase(id, question, isGeneral), origin: "production" as const };
}

export const TEST_CASES: TestCase<QuestionGeneralityExpected, QuestionGeneralityInput>[] = [
  generalityCase("en-general-microwave", "How does a microwave heat food?", true),
  generalityCase(
    "pt-personal-exame-de-sangue",
    "o que significa o resultado do meu exame de sangue de ontem?",
    false,
  ),
  generalityCase("pt-general-inflacao", "o que é inflação?", true),
  generalityCase(
    "en-personal-my-code",
    "why doesn't my Python script read the CSV I uploaded?",
    false,
  ),
  generalityCase(
    "en-general-personal-wording",
    "I never understood how vaccines work, can you explain like I'm 10?",
    true,
  ),
  generalityCase(
    "pt-personal-refinanciar",
    "vale a pena eu refinanciar meu apartamento agora?",
    false,
  ),
  generalityCase(
    "pt-general-kid-asked",
    "meu filho perguntou por que as folhas mudam de cor no outono",
    true,
  ),
  generalityCase(
    "en-personal-manager-meeting",
    "what did my manager mean when she said my project needs more ownership?",
    false,
  ),
  generalityCase(
    "en-general-difference",
    "what's the difference between weather and climate?",
    true,
  ),
  generalityCase("pt-personal-bolo", "por que o meu bolo solou ontem?", false),
  generalityCase("en-general-black-hole", "how do black holes form", true),
  generalityCase(
    "pt-personal-contrato",
    "me explica essa cláusula de multa do contrato de aluguel que eu assinei",
    false,
  ),
  productionCase("pt-prod-bacteria-alimento", "como uma bactéria se alimenta?", true),
  productionCase(
    "pt-prod-good-evening-night",
    "Qual a diferença entre good evening e good night?",
    true,
  ),
  productionCase("pt-prod-di-solito", "Quando eu uso “di solito”?", true),
  productionCase(
    "pt-prod-minha-resposta-errada",
    "Por que minha resposta estava errada? Explique a resposta certa.",
    false,
  ),
];
