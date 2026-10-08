import { type TestCase } from "@/lib/types";
import { type FindSubjectQuestionsParams } from "@zoonk/ai/tasks/v2/research/find-subject-questions";
import { type FindSubjectQuestionsExpected } from "./task";

type FindSubjectQuestionsCase = TestCase<FindSubjectQuestionsExpected, FindSubjectQuestionsParams>;

const TODAY = "2026-10-06";

/** The 48º Exame's 1ª fase as its notice names its subjects, without their counts (6 Oct 2026). */
const OAB_SUBJECTS = [
  "Direito Administrativo",
  "Direito Civil",
  "Direito Processual Civil",
  "Direito Constitucional",
  "Direito do Trabalho",
  "Direito Processual do Trabalho",
  "Direito Empresarial",
  "Direito Penal",
  "Direito Processual Penal",
  "Direito Tributário e Processual Tributário",
  "Direitos Humanos",
  "Direito do Consumidor",
  "Direito da Criança e do Adolescente",
  "Direito Ambiental",
  "Direito Internacional",
  "Filosofia do Direito",
  "Direito Financeiro",
  "Direito Previdenciário",
  "Direito Eleitoral",
  "Estatuto da Advocacia e da OAB, Regulamento Geral e Código de Ética e Disciplina da OAB",
];

/**
 * Real exams whose notices name subjects without counts. The OAB's distribution is published for
 * every edition and Ética has kept its 8 questions through the 2024 changes, so a found answer
 * must give it 8; a concurso split only into tests may have no source, and then "unknown" is
 * right.
 */
export const TEST_CASES: FindSubjectQuestionsCase[] = [
  {
    expected: { counts: { 20: 8 }, status: "found" },
    id: "pt-oab-1a-fase",
    userInput: {
      board: "FGV",
      exam: "OAB Exame de Ordem Unificado, 1ª fase",
      subjects: OAB_SUBJECTS,
      today: TODAY,
      total: 80,
    },
  },
  {
    expected: { counts: {}, status: "any" },
    id: "pt-camara-registro-redacao",
    userInput: {
      board: "Cebraspe",
      exam: "Concurso da Câmara dos Deputados, Analista Legislativo – Registro e Redação",
      subjects: [
        "Língua Portuguesa",
        "Língua Inglesa",
        "Noções de Direito Administrativo e Administração Pública",
        "Noções de Direito Constitucional e de Regimento Interno da Câmara dos Deputados",
        "Tecnologia da Informação e Dados",
        "Linguística",
        "Reconhecimento de Fala, Transcrição e Inteligência Artificial",
        "Processo Legislativo e Regimento Interno da Câmara dos Deputados",
        "Ciência Política",
      ],
      today: TODAY,
      total: 180,
    },
  },
];
