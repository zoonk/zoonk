import { type TestCase } from "@/lib/types";
import { type MemorySearchTermsParams } from "@zoonk/ai/tasks/v2/memory/search-terms";

/** The learner's facts for one case: the ones the task needs and the ones it doesn't. */
export type MemorySearchTermsExpected = { irrelevant: string[]; relevant: string[] };

type SearchCase = TestCase<MemorySearchTermsExpected, MemorySearchTermsParams>;

function searchCase({
  id,
  irrelevant,
  language,
  need,
  relevant,
}: MemorySearchTermsExpected & { id: string; language: string; need: string }): SearchCase {
  return { expected: { irrelevant, relevant }, id, userInput: { language, need } };
}

export const TEST_CASES: SearchCase[] = [
  searchCase({
    id: "en-explain-interest",
    irrelevant: ["Likes football examples", "Studies after 8 pm", "Wants Law"],
    language: "en",
    need: "Explain why the learner's answer on a compound interest question was wrong",
    relevant: ["Mixes up simple and compound interest", "Struggles with percentages"],
  }),
  searchCase({
    id: "en-plan-week",
    irrelevant: ["Likes football examples", "Wants Law at a public university"],
    language: "en",
    need: "Plan this learner's study schedule for the week",
    relevant: ["Can't study on Saturdays", "Studies after 8 pm on weekdays", "Works night shifts"],
  }),
  searchCase({
    id: "en-example-discounts",
    irrelevant: ["Can't study on Saturdays", "Has the ENEM on November 8"],
    language: "en",
    need: "Write a personal example for a lesson on shop discounts",
    relevant: ["Likes football examples", "Works at a clothing store"],
  }),
  searchCase({
    id: "en-exam-priorities",
    irrelevant: ["Likes football examples", "Studies on the bus"],
    language: "en",
    need: "Decide which topics to prioritize before the learner's exam",
    relevant: [
      "Has the ENEM on November 8",
      "Needs 700+ in the essay",
      "Wants Law at a public university",
    ],
  }),
  searchCase({
    id: "en-example-statistics",
    irrelevant: ["Can't study on Saturdays", "Wants Law"],
    language: "en",
    need: "Write a personal example for a statistics lesson on averages",
    relevant: ["Works as a nurse", "Likes basketball examples"],
  }),
  searchCase({
    id: "pt-explain-proportion",
    irrelevant: ["Gosta de exemplos de futebol", "Estuda à noite"],
    language: "pt",
    need: "Explicar o erro do aluno em uma questão de regra de três",
    relevant: ["Confunde grandezas diretas e inversas", "Tem dificuldade com proporção"],
  }),
  searchCase({
    id: "pt-plan-week",
    irrelevant: ["Gosta de exemplos de futebol", "Quer Direito na USP"],
    language: "pt",
    need: "Planejar a semana de estudos do aluno",
    relevant: ["Não estuda aos sábados", "Estuda depois das 20h", "Trabalha de dia"],
  }),
  searchCase({
    id: "pt-example-interest",
    irrelevant: ["Estuda no ônibus", "Tem a prova em novembro"],
    language: "pt",
    need: "Escrever um exemplo pessoal para uma aula de juros",
    relevant: ["É dono de uma padaria", "Gosta de exemplos de futebol"],
  }),
  searchCase({
    id: "pt-exam-priorities",
    irrelevant: ["Gosta de exemplos de futebol", "Estuda no ônibus"],
    language: "pt",
    need: "Decidir quais temas priorizar antes da prova do aluno",
    relevant: ["Tem o ENEM em 8 de novembro", "Precisa de 700 na redação"],
  }),
  searchCase({
    id: "pt-tutor-tone",
    irrelevant: ["Mora em Recife", "Estuda à noite"],
    language: "pt",
    need: "Escolher o tamanho e o tom das respostas do tutor",
    relevant: ["Prefere explicações curtas", "Prefere um tom direto"],
  }),
];
