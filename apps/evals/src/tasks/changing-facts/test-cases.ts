import { type TestCase } from "@/lib/types";
import {
  type ChangingFactsParams,
  type ChangingFactsTopic,
} from "@zoonk/ai/tasks/v2/research/changing-facts";
import { type ChangingFactsExpected } from "./task";

/** The language is the goal's, since the goal is the only input. */
function topicCase(
  id: string,
  language: string,
  goal: string,
  topics: ChangingFactsTopic | ChangingFactsTopic[],
) {
  return {
    expected: { topics: Array.isArray(topics) ? topics : [topics] },
    id,
    language,
    userInput: { goal },
  } satisfies TestCase<ChangingFactsExpected, ChangingFactsParams>;
}

export const TEST_CASES: TestCase<ChangingFactsExpected, ChangingFactsParams>[] = [
  topicCase("enem", "pt", "quero passar no ENEM desse ano pra enfermagem", "exam"),
  topicCase("tcdf", "pt", "Concurso TCDF 2026 analista administrativo", "exam"),
  topicCase("sat", "en", "Get a 1450 on the SAT in March", "exam"),
  topicCase("abitur", "de", "Abitur 2027 in Bayern bestehen, Mathe und Deutsch", "exam"),
  topicCase("bac", "fr", "réussir le bac de philo en juin", "exam"),
  topicCase("ielts", "en", "IELTS 7.0 for my visa", "exam"),
  topicCase("math-for-enem", "pt", "matemática para o ENEM", "exam"),
  topicCase("income-tax", "pt", "declarar meu imposto de renda 2027 sozinho", "regulation"),
  topicCase("gdpr", "en", "GDPR compliance for my startup's app", "regulation"),
  topicCase("visa", "en", "how to get a Portuguese digital nomad visa", "regulation"),
  topicCase(
    "labor-law",
    "pt",
    "direitos trabalhistas na CLT atual para o meu primeiro emprego",
    "regulation",
  ),
  topicCase(
    "nextjs",
    "en",
    "what's new in the latest Next.js version and how to migrate",
    "software",
  ),
  topicCase(
    "ios-sdk",
    "en",
    "build apps with this year's iOS SDK and SwiftUI features",
    "software",
  ),
  topicCase("aws-services", "de", "Neue AWS-Dienste für Serverless 2026", "software"),
  topicCase("calculus", "en", "calculus from scratch", "none"),
  topicCase("history", "pt", "história do Brasil colonial", "none"),
  topicCase("spanish", "pt", "aprender espanhol para viajar", "none"),
  topicCase("python", "en", "learn Python programming", "none"),
  topicCase("photosynthesis", "en", "how does photosynthesis work", "none"),
  topicCase("accounting", "en", "accounting basics", "none"),
];
