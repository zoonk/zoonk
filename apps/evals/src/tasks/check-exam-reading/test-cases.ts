import { type TestCase } from "@/lib/types";
import { type CheckReadingEvalInput } from "./generate";
import { type CheckReadingExpected } from "./task";

const OAB_NOTICE = {
  title: "Edital de abertura do 48º Exame de Ordem Unificado",
  url: "https://s.oab.org.br/arquivos/2026/09/fb43fb37-838e-4d33-a863-99fa1f98b921.pdf",
};

const OAB_EXAM = "OAB Exame de Ordem Unificado, 1ª fase";

/**
 * The 48th OAB exam's first phase as a live reading listed it on 8 Oct 2026: 19 subjects, without the
 * Statute of the Legal Profession and the Code of Ethics, which the notice's own table cell ("…, as well as
 * the Statute of the Legal Profession and of the OAB…") and rule 3.4.1.1 name.
 */
const OAB_READ_WITHOUT_ETHICS = [
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
];

function uncounted(names: readonly string[]) {
  return names.map((name) => ({ name, questions: null }));
}

/** Readings of real notices (8 Oct 2026), some with what a live reading left out. */
export const TEST_CASES: TestCase<CheckReadingExpected, CheckReadingEvalInput>[] = [
  {
    expected: { counts: [], missing: [["etica", "estatuto da advocacia"]] },
    id: "pt-oab-48-without-ethics",
    userInput: {
      documents: [OAB_NOTICE],
      exam: OAB_EXAM,
      subjects: uncounted(OAB_READ_WITHOUT_ETHICS),
      total: 80,
    },
  },
  {
    expected: { counts: [], missing: [] },
    id: "pt-oab-48-complete",
    userInput: {
      documents: [OAB_NOTICE],
      exam: OAB_EXAM,
      subjects: uncounted([
        ...OAB_READ_WITHOUT_ETHICS,
        "Estatuto da Advocacia e da OAB, Regulamento Geral e Código de Ética e Disciplina da OAB",
      ]),
      total: 80,
    },
  },
  {
    // The notice gives every objective test 45 questions; this reading lost mathematics'.
    expected: {
      counts: [{ questions: 45, subject: "Matemática e suas Tecnologias" }],
      missing: [],
    },
    id: "pt-enem-2026-count-left-out",
    userInput: {
      documents: [
        {
          title: "Edital Inep nº 64, de 21 de maio de 2026 (Enem 2026)",
          url: "http://www.abmes.org.br/arquivos/legislacoes/Edital-inep-064-2026-05-21.pdf",
        },
      ],
      exam: "ENEM",
      subjects: [
        { name: "Linguagens, Códigos e suas Tecnologias", questions: 45 },
        { name: "Ciências Humanas e suas Tecnologias", questions: 45 },
        { name: "Ciências da Natureza e suas Tecnologias", questions: 45 },
        { name: "Matemática e suas Tecnologias", questions: null },
        { name: "Redação", questions: null },
      ],
      total: 180,
    },
  },
  {
    // Counts are stated per test (P1, P2), never per subject: nothing is missing.
    expected: { counts: [], missing: [] },
    id: "pt-camara-2026-complete",
    userInput: {
      documents: [
        {
          title: "Edital nº 1 – Câmara dos Deputados, de 2 de outubro de 2026",
          url: "https://cdn.cebraspe.org.br/concursos/CD_26_ANALISTA/arquivos/BBE30D016054F40651E36AC7B302C3425BD148A39675CA840A5A0CCBFBB5F0F1.pdf",
        },
      ],
      exam: "Câmara dos Deputados, Analista Legislativo – Registro e Redação",
      subjects: uncounted([
        "Língua Portuguesa",
        "Língua Inglesa",
        "Noções de Direito Administrativo e Administração Pública",
        "Noções de Direito Constitucional e de Regimento Interno da Câmara dos Deputados",
        "Tecnologia da Informação e Dados",
        "Linguística",
        "Reconhecimento de Fala, Transcrição e Inteligência Artificial",
        "Processo Legislativo e Regimento Interno da Câmara dos Deputados, Regimento Comum do Congresso Nacional",
        "Ciência Política",
        "Prova discursiva",
      ]),
      total: 180,
    },
  },
  {
    expected: { counts: [], missing: [] },
    id: "en-sat-complete",
    userInput: {
      documents: [
        {
          title: "SAT Test Structure",
          url: "https://satsuite.collegeboard.org/sat/whats-on-the-test/structure",
        },
      ],
      exam: "SAT",
      subjects: [
        { name: "Reading and Writing", questions: 54 },
        { name: "Math", questions: 44 },
      ],
      total: 98,
    },
  },
];
