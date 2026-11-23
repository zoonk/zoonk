import { type TestCase } from "@/lib/types";
import { type EvalSubject, type TaskSubjectsEvalInput } from "./generate";
import { type TaskSubjectsExpected } from "./task";

type TaskSubjectsCase = TestCase<TaskSubjectsExpected, TaskSubjectsEvalInput>;

const CGU_BASIC = "Conhecimentos básicos (P1)";
const CGU_COMPLEMENTARY = "Conhecimentos complementares (P2)";
const CGU_SPECIFIC = "Conhecimentos específicos (P3)";

const CGU_COMPLEMENTARY_SUBJECTS = [
  "Fundamentos de Governança, Riscos e Integridade Pública e Privada",
  "Fundamentos de Transparência, Ouvidoria e Participação Social",
  "Fundamentos de Direito Público Aplicado, Controle e Responsabilização",
  "Fundamentos de Evidências, Dados e Inteligência Artificial",
  "Fundamentos de Auditoria Governamental e Atuação Integrada da CGU",
];

const CGU_SPECIALTIES = [
  "Auditoria",
  "Tecnologia da Informação – Ciência de Dados",
  "Tecnologia da Informação – Infraestrutura de TI",
  "Tecnologia da Informação – Desenvolvimento de Sistemas",
];

const CGU_SUBJECTS: EvalSubject[] = [
  { group: CGU_BASIC, name: "Estado, Democracia, Direitos e Ciência Política" },
  { group: CGU_BASIC, name: "Ética Pública e Responsabilidade Profissional" },
  ...CGU_COMPLEMENTARY_SUBJECTS.map((name) => ({ group: CGU_COMPLEMENTARY, name })),
  ...CGU_SPECIALTIES.map((name) => ({ choiceGroup: "Especialidade", group: CGU_SPECIFIC, name })),
];

const TCDF_SPECIALIZED = [
  "Direito Administrativo",
  "Administração Financeira e Orçamentária",
  "Administração Geral e Pública",
];

const TCDF_SUBJECTS: EvalSubject[] = [
  { group: "Conhecimentos básicos (P1)", name: "Língua Portuguesa" },
  { group: "Conhecimentos básicos (P1)", name: "Lei Orgânica do Distrito Federal" },
  { group: "Conhecimentos específicos (P2)", name: "Direito Constitucional" },
  { group: "Conhecimentos específicos (P2)", name: "Lei Orgânica do TCDF e Regimento Interno" },
  ...TCDF_SPECIALIZED.map((name) => ({ group: "Conhecimentos especializados (P3)", name })),
];

/** An invented notice whose discursive topic is a theme, not one of its subjects. */
const MUNICIPAL_NOTICE = `PREFEITURA MUNICIPAL DE VALE ALTO
EDITAL Nº 3/2026 – CONCURSO PÚBLICO PARA O CARGO DE ASSISTENTE ADMINISTRATIVO

5 DAS PROVAS
5.1 O concurso será composto de prova objetiva e de prova discursiva, aplicadas no mesmo dia, com duração total de 4 horas.
5.2 A prova objetiva terá 40 questões de múltipla escolha, com cinco alternativas cada, sobre Língua Portuguesa (15 questões), Noções de Informática (10 questões) e Conhecimentos Específicos (15 questões).
5.3 A prova discursiva consistirá na redação de um texto dissertativo, com extensão máxima de 30 linhas, sobre tema de atualidade relacionado à administração pública municipal.`;

/** An invented syllabus whose written paper names a part of the course and an elective. */
const SCIENCE_SYLLABUS = `NORTHFIELD SCIENCE CERTIFICATE – SYLLABUS 2027

Candidates study the three Core Units (Unit 1: Cells, Unit 2: Energy, Unit 3: Forces) and choose one Option: Option A, Ecology, or Option B, Genetics.

Paper 1 (multiple choice, 1 hour) covers the Core Units.
Paper 2 (written, 2 hours) has two parts. Part A is one structured essay of up to 800 words on the Core Units. Part B is one extended response on the candidate's chosen Option.`;

/** An invented notice whose discursive questions each name a discipline. */
const DISCIPLINES_NOTICE = `TRIBUNAL REGIONAL DE SERRA CLARA – EDITAL Nº 2/2027
6.1 A prova discursiva será composta de duas questões, de até 20 linhas cada.
6.2 A primeira questão versará sobre Direito Constitucional e a segunda, sobre Direito Administrativo.
7.1 A prova objetiva abordará Língua Portuguesa, Direito Constitucional, Direito Administrativo e Noções de Informática.`;

export const TEST_CASES: TaskSubjectsCase[] = [
  {
    expected: { "2.1": CGU_COMPLEMENTARY_SUBJECTS, "2.2": CGU_SPECIALTIES },
    id: "cgu-2026-part-and-specialty",
    language: "pt",
    userInput: {
      documents: [
        {
          title: "Edital nº 1 – CGU 2026 – Auditor Federal de Finanças e Controle (atualizado)",
          url: "https://cdn.cebraspe.org.br/concursos/CGU_26_AFFC/arquivos/FDEEFB41D8ACD48AB369A9915EA1A48C67389EC91427E98F6F264E19B1F63FB9.pdf",
        },
      ],
      exam: "CGU 2026, Auditor Federal de Finanças e Controle",
      subjects: CGU_SUBJECTS,
      tasks: [
        {
          description:
            "uma questão discursiva, relacionada a conhecimentos complementares, a ser respondida em até 30 linhas, no valor de 30,00 pontos",
          id: "2.1",
          section: "Prova discursiva (P4)",
        },
        {
          description:
            "uma questão envolvendo situação-problema, a ser respondida em até 60 linhas, no valor de 70,00 pontos",
          id: "2.2",
          section: "Prova discursiva (P4)",
        },
      ],
    },
  },
  {
    expected: { "4.1": TCDF_SPECIALIZED, "4.2": TCDF_SPECIALIZED },
    id: "tcdf-2026-specialized-part",
    language: "pt",
    userInput: {
      documents: [
        {
          title: "Edital nº 1 – TCDF/ANACE, de 8 de julho de 2026",
          url: "https://cdn.cebraspe.org.br/concursos/tc_df_26_analista/arquivos/7971F586B9A9CE2C60801C731D8A1CD87F4C5136CA1F1E346C27C5C743773A73.pdf",
        },
      ],
      exam: "Concurso TCDF, Analista Administrativo de Controle Externo",
      subjects: TCDF_SUBJECTS,
      tasks: [
        {
          description: "uma questão discursiva de até 20 linhas, valendo 15,00 pontos",
          id: "4.1",
          section: "(P4) Discursiva",
        },
        {
          description:
            "uma peça de natureza técnica (Informação) de até 50 linhas, valendo 35,00 pontos",
          id: "4.2",
          section: "(P4) Discursiva",
        },
      ],
    },
  },
  {
    expected: { "2.1": [] },
    id: "municipal-theme-not-a-subject",
    language: "pt",
    userInput: {
      documents: [{ text: MUNICIPAL_NOTICE, title: "Edital nº 3/2026 – Prefeitura de Vale Alto" }],
      exam: "Concurso da Prefeitura de Vale Alto, Assistente Administrativo",
      subjects: [
        { name: "Língua Portuguesa" },
        { name: "Noções de Informática" },
        { name: "Conhecimentos Específicos" },
      ],
      tasks: [
        {
          description: "texto dissertativo de até 30 linhas",
          id: "2.1",
          section: "Prova discursiva",
        },
      ],
    },
  },
  {
    expected: {
      "2.1": ["Unit 1: Cells", "Unit 2: Energy", "Unit 3: Forces"],
      "2.2": ["Ecology", "Genetics"],
    },
    id: "science-core-and-option",
    language: "en",
    userInput: {
      documents: [{ text: SCIENCE_SYLLABUS, title: "Northfield Science Certificate syllabus" }],
      exam: "Northfield Science Certificate",
      subjects: [
        { group: "Core Units", name: "Unit 1: Cells" },
        { group: "Core Units", name: "Unit 2: Energy" },
        { group: "Core Units", name: "Unit 3: Forces" },
        { choiceGroup: "Option", name: "Ecology" },
        { choiceGroup: "Option", name: "Genetics" },
      ],
      tasks: [
        {
          description: "Part A: one structured essay of up to 800 words",
          id: "2.1",
          section: "Paper 2",
        },
        { description: "Part B: one extended response", id: "2.2", section: "Paper 2" },
      ],
    },
  },
  {
    expected: { "1.1": ["Direito Constitucional"], "1.2": ["Direito Administrativo"] },
    id: "court-one-discipline-each",
    language: "pt",
    userInput: {
      documents: [{ text: DISCIPLINES_NOTICE, title: "Edital nº 2/2027 – TR Serra Clara" }],
      exam: "Tribunal Regional de Serra Clara, Analista Judiciário",
      subjects: [
        { name: "Língua Portuguesa" },
        { name: "Direito Constitucional" },
        { name: "Direito Administrativo" },
        { name: "Noções de Informática" },
      ],
      tasks: [
        {
          description: "primeira questão discursiva, de até 20 linhas",
          id: "1.1",
          section: "Prova discursiva",
        },
        {
          description: "segunda questão discursiva, de até 20 linhas",
          id: "1.2",
          section: "Prova discursiva",
        },
      ],
    },
  },
];
