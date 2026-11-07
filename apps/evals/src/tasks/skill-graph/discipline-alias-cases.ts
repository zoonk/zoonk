import { type TestCase } from "@/lib/types";
import { type SkillGraphCase, type SkillGraphExpected } from "./library-cases";

export const DISCIPLINE_ALIAS_CASES: TestCase<SkillGraphExpected, SkillGraphCase>[] = [
  "Orçamento Público",
  "Administração Financeira e Orçamentária",
  "AFO",
].map((name, index) => ({
  expectations: `
    - Write in Brazilian Portuguese.
    - The public-budget discipline in the AL-CE notices is known as Orçamento Público, Administração Financeira e Orçamentária and AFO. Its shared course is titled exactly Administração Financeira e Orçamentária, whichever name this notice uses. Never add a second budget course under an alias.
    - Direito Financeiro and Contabilidade Pública are different disciplines: each keeps its own course and skills. Their relationship to budgeting does not make them aliases of AFO.
    - Every notice topic is taught in its own discipline's course. Areas retain the notice's exact subject names.
  `,
  expected: {
    courses: [
      ["Administração Financeira e Orçamentária"],
      ["Direito Financeiro"],
      ["Contabilidade Pública"],
    ],
    noCourses: ["Orçamento Público", "AFO"],
  },
  id: `pt-alce-budget-catalog-${index + 1}`,
  userInput: {
    examBlueprint: {
      name: "Disciplinas de concurso público",
      notes: [],
      subjects: [
        {
          group: null,
          name,
          questions: 12,
          topics: [
            "Relacionar PPA, LDO e LOA",
            "Analisar ciclo orçamentário e créditos adicionais",
            "Classificar receitas e despesas orçamentárias",
            "Analisar execução da receita e da despesa",
          ],
          weight: null,
        },
        {
          group: null,
          name: "Direito Financeiro",
          questions: 4,
          topics: [
            "Competência legislativa em direito financeiro e normas gerais da Lei 4.320/1964",
          ],
          weight: null,
        },
        {
          group: null,
          name: "Contabilidade Pública",
          questions: 4,
          topics: ["Variações patrimoniais e demonstrações contábeis aplicadas ao setor público"],
          weight: null,
        },
      ],
      topicFrequency: [],
    },
    goal: "Preparação para concurso público",
    goalKind: "exam",
    language: "pt",
  },
}));
