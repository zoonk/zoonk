import { type TestCase } from "@/lib/types";
import { type SkillGraphCase, type SkillGraphExpected } from "./library-cases";

const BUDGET_ALIAS_CASES: TestCase<SkillGraphExpected, SkillGraphCase>[] = [
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
    coursesByArea: {
      "Contabilidade Pública": ["Contabilidade Pública"],
      "Direito Financeiro": ["Direito Financeiro"],
      [name]: ["Administração Financeira e Orçamentária"],
    },
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

const COMPUTING_ALIAS_CASES: TestCase<SkillGraphExpected, SkillGraphCase>[] = [
  "Noções de Informática",
  "Informática",
].map((name, index) => ({
  expectations: `
    - Write in Brazilian Portuguese.
    - Noções de Informática and Informática name the same discipline in public-service notices. Its shared course is titled exactly Informática under either notice heading, with no second course under the alias.
    - The notice tests everyday computing knowledge, not computer science or programming. All computing skills belong to Informática.
    - Arquivologia is a separate discipline: archival classification and appraisal stay in its own course, even though computing also covers files and folders.
    - Areas retain the notice's exact subject names.
  `,
  expected: {
    courses: [["Informática"], ["Arquivologia"]],
    coursesByArea: { Arquivologia: ["Arquivologia"], [name]: ["Informática"] },
    noCourses: ["Noções de Informática", "Ciência da Computação"],
  },
  id: `pt-computing-alias-${index + 1}`,
  userInput: {
    examBlueprint: {
      name: "Disciplinas de concurso público",
      notes: [],
      subjects: [
        {
          group: null,
          name,
          questions: 10,
          topics: [
            "Organização e gerenciamento de arquivos e pastas no Windows",
            "Edição de textos, planilhas e apresentações no Microsoft Office",
            "Navegação na internet e uso de correio eletrônico",
          ],
          weight: null,
        },
        {
          group: null,
          name: "Arquivologia",
          questions: 5,
          topics: ["Classificação e avaliação de documentos de arquivo"],
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

export const DISCIPLINE_ALIAS_CASES = [...BUDGET_ALIAS_CASES, ...COMPUTING_ALIAS_CASES];
