import { getSeedFact, getSeedLearner } from "@/datasets/seed-learners";
import { type TestCase } from "@/lib/types";
import { type MemoryRelevanceInput } from "@zoonk/ai/tasks/v2/memory/relevance";
import { type MemoryRelevanceExpected } from "./test-cases";

/** How the tutor asks for memory in production, with the learner's question at the end. */
function tutorNeed(question: string): string {
  return `A tutor answering the learner's question about a lesson: ${question}`;
}

const PLAN_WEEK = "Plan this learner's study schedule for the week";
const PT_PLAN_WEEK = "Planejar a semana de estudos do aluno";

/** One of a seed learner's own memory facts, asked about for a task that learner would run. */
function personaCase({
  fact,
  id,
  learnerKey,
  need,
  relevant,
}: {
  fact: string;
  id: string;
  learnerKey: string;
  need: string;
  relevant: boolean;
}): TestCase<MemoryRelevanceExpected, MemoryRelevanceInput> {
  const learner = getSeedLearner(learnerKey);

  return {
    expected: { relevant },
    id: `${learner.language}-persona-${learnerKey}-${id}`,
    userInput: { fact: getSeedFact({ includes: fact, learner }), need },
  };
}

/** The seed learners' memory (shared eval dataset), in English and Portuguese. */
export const PERSONA_TEST_CASES: TestCase<MemoryRelevanceExpected, MemoryRelevanceInput>[] = [
  personaCase({
    fact: "worked example",
    id: "tutor-worked-example",
    learnerKey: "maya",
    need: tutorNeed("Why is 10⁻³ a small number and not a negative one?"),
    relevant: true,
  }),
  personaCase({
    fact: "Studies at 7:30 am",
    id: "tutor-study-time",
    learnerKey: "maya",
    need: tutorNeed("Why is 10⁻³ a small number and not a negative one?"),
    relevant: false,
  }),
  personaCase({
    fact: "Studies at 7:30 am",
    id: "plan-after-night-shift",
    learnerKey: "maya",
    need: PLAN_WEEK,
    relevant: true,
  }),
  personaCase({
    fact: "worked example",
    id: "plan-worked-example",
    learnerKey: "maya",
    need: PLAN_WEEK,
    relevant: false,
  }),
  personaCase({
    fact: "index fund",
    id: "example-index-fund",
    learnerKey: "sam",
    need: "Write a personal example for a quick explanation of an index going up 2%",
    relevant: true,
  }),
  personaCase({
    fact: "cursinho aos sábados",
    id: "plan-saturday-course",
    learnerKey: "ana",
    need: PT_PLAN_WEEK,
    relevant: true,
  }),
  personaCase({
    fact: "Estuda à noite",
    id: "example-study-time",
    learnerKey: "ana",
    need: "Escrever um exemplo pessoal para uma aula de porcentagem",
    relevant: false,
  }),
  personaCase({
    fact: "sem contas",
    id: "tutor-no-math",
    learnerKey: "lucas",
    need: tutorNeed("por que a luz azul tem mais energia que a vermelha?"),
    relevant: true,
  }),
  personaCase({
    fact: "Estuda à noite",
    id: "tutor-study-time",
    learnerKey: "lucas",
    need: tutorNeed("por que a luz azul tem mais energia que a vermelha?"),
    relevant: false,
  }),
  personaCase({
    fact: "Toronto",
    id: "example-toronto-move",
    learnerKey: "marcos",
    need: "Escrever um exemplo pessoal para uma aula sobre perguntar preços em inglês",
    relevant: true,
  }),
  personaCase({
    fact: "Estuda às 7h",
    id: "example-study-time",
    learnerKey: "marcos",
    need: "Escrever um exemplo pessoal para uma aula sobre perguntar preços em inglês",
    relevant: false,
  }),
  personaCase({
    fact: "mesada",
    id: "example-allowance",
    learnerKey: "pedro",
    need: "Escrever um exemplo pessoal para uma aula sobre o que é uma ação",
    relevant: true,
  }),
];
