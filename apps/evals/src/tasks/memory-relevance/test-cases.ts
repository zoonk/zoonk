import { type TestCase } from "@/lib/types";
import { type MemoryFactText } from "@zoonk/ai/tasks/v2/memory/facts";
import { type MemoryRelevanceInput } from "@zoonk/ai/tasks/v2/memory/relevance";

export type MemoryRelevanceExpected = { relevant: boolean };

function relevanceCase({
  category,
  id,
  need,
  relevant,
  statement,
}: {
  category: MemoryFactText["category"];
  id: string;
  need: string;
  relevant: boolean;
  statement: string;
}): TestCase<MemoryRelevanceExpected, MemoryRelevanceInput> {
  return { expected: { relevant }, id, userInput: { fact: { category, statement }, need } };
}

const EXAMPLES_PERCENTAGES = "Write a personal example for a lesson on percentages";
const PLAN_WEEK = "Plan this learner's study schedule for the week";
const PT_PLAN_WEEK = "Planejar a semana de estudos do aluno";

export const TEST_CASES: TestCase<MemoryRelevanceExpected, MemoryRelevanceInput>[] = [
  relevanceCase({
    category: "preferences",
    id: "en-example-likes-football",
    need: EXAMPLES_PERCENTAGES,
    relevant: true,
    statement: "Likes football examples",
  }),
  relevanceCase({
    category: "routine",
    id: "en-example-study-time",
    need: EXAMPLES_PERCENTAGES,
    relevant: false,
    statement: "Studies after 8 pm",
  }),
  relevanceCase({
    category: "routine",
    id: "en-plan-no-saturdays",
    need: PLAN_WEEK,
    relevant: true,
    statement: "Can't study on Saturdays",
  }),
  relevanceCase({
    category: "preferences",
    id: "en-plan-football",
    need: PLAN_WEEK,
    relevant: false,
    statement: "Likes football examples",
  }),
  relevanceCase({
    category: "learning",
    id: "en-explain-mixes-interest",
    need: "Explain why the learner's answer on a compound interest question was wrong",
    relevant: true,
    statement: "Mixes up simple and compound interest",
  }),
  relevanceCase({
    category: "goals",
    id: "en-pronunciation-law-goal",
    need: "Write a pronunciation drill for Spanish vowels",
    relevant: false,
    statement: "Wants Law at a public university",
  }),
  relevanceCase({
    category: "background",
    id: "en-example-nurse-statistics",
    need: "Write a personal example for a statistics lesson on averages",
    relevant: true,
    statement: "Works as a nurse",
  }),
  relevanceCase({
    category: "preferences",
    id: "en-tone-short",
    need: "Choose the length and tone of the tutor's replies",
    relevant: true,
    statement: "Prefers short, direct explanations",
  }),
  relevanceCase({
    category: "goals",
    id: "en-priorities-essay",
    need: "Decide which exam topics to prioritize in the plan",
    relevant: true,
    statement: "Needs 700+ in the essay",
  }),
  relevanceCase({
    category: "routine",
    id: "en-example-bus",
    need: "Write a personal example for a chemistry lesson on acids",
    relevant: false,
    statement: "Studies on the bus in the morning",
  }),
  relevanceCase({
    category: "preferences",
    id: "pt-example-futebol",
    need: "Escrever um exemplo pessoal para uma aula de porcentagem",
    relevant: true,
    statement: "Gosta de exemplos de futebol",
  }),
  relevanceCase({
    category: "routine",
    id: "pt-plan-works-late",
    need: PT_PLAN_WEEK,
    relevant: true,
    statement: "Trabalha até as 19h nos dias de semana",
  }),
  relevanceCase({
    category: "preferences",
    id: "pt-plan-cooking",
    need: PT_PLAN_WEEK,
    relevant: false,
    statement: "Gosta de exemplos de culinária",
  }),
  relevanceCase({
    category: "learning",
    id: "pt-explain-proportion",
    need: "Explicar o erro do aluno em uma questão de regra de três",
    relevant: true,
    statement: "Confunde grandezas diretas e inversas",
  }),
  relevanceCase({
    category: "background",
    id: "pt-example-bakery",
    need: "Escrever um exemplo pessoal para uma aula de juros",
    relevant: true,
    statement: "É dono de uma padaria",
  }),
  relevanceCase({
    category: "goals",
    id: "pt-pronunciation-medicine",
    need: "Criar exercícios de pronúncia do inglês",
    relevant: false,
    statement: "Quer Medicina na USP",
  }),
  relevanceCase({
    category: "background",
    id: "pt-level-engineer",
    need: "Escolher o nível das explicações de uma aula de cálculo",
    relevant: true,
    statement: "Já é formado em Engenharia",
  }),
  relevanceCase({
    category: "routine",
    id: "pt-example-night",
    need: "Escrever um exemplo pessoal para uma aula de frações",
    relevant: false,
    statement: "Estuda à noite",
  }),
];
