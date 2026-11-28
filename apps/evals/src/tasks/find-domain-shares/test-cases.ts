import { type TestCase } from "@/lib/types";
import { type DomainSharesEvalInput, type ShareSubject } from "./generate";
import { type DomainSharesExpected } from "./task";

type DomainSharesCase = TestCase<DomainSharesExpected, DomainSharesEvalInput>;

/** Each heading with its stated range: the midpoint is its weight. */
type Range = [heading: string, min: number, max: number];

const SAT_DOCUMENTS = [
  {
    title: "SAT Weekend Student Guide",
    url: "https://satsuite.collegeboard.org/media/pdf/sat-student-guide.pdf",
  },
  {
    title: "Assessment Framework for the Digital SAT Suite",
    url: "https://satsuite.collegeboard.org/media/pdf/assessment-framework-for-digital-sat-suite.pdf",
  },
  {
    title: "The Digital SAT Suite of Assessments Specifications Overview",
    url: "https://satsuite.collegeboard.org/media/pdf/digital-sat-test-spec-overview.pdf",
  },
  {
    title: "SAT Suite Test Dates and Deadlines – SAT Suite | College Board",
    url: "https://satsuite.collegeboard.org/sat/dates-deadlines",
  },
  {
    title: "How the SAT Is Structured – SAT Suite | College Board",
    url: "https://satsuite.collegeboard.org/sat/whats-on-the-test/structure",
  },
  {
    title: "SAT Registration and Test Day Checklist",
    url: "https://satsuite.collegeboard.org/media/pdf/digital-sat-registration-test-day-guide.pdf",
  },
  {
    title: "SAT Suite Important Dates Flyer",
    url: "https://satsuite.collegeboard.org/media/pdf/sat-suite-calendar-flyer.pdf",
  },
];

const FE_DOCUMENTS = [
  {
    title: "NCEES Examinee Guide (November 2026)",
    url: "https://ncees.org/wp-content/uploads/2026/11/NCEESExamGuide_November-2026_3.pdf",
  },
  { title: "FE Exam | NCEES", url: "https://ncees.org/exams/fe-exam/" },
  {
    title: "FE Civil CBT Exam Specifications",
    url: "https://ncees.org/wp-content/uploads/2022/09/FE-Civil-CBT-specs-1.pdf",
  },
  {
    title: "FE Mechanical CBT Exam Specifications",
    url: "https://ncees.org/wp-content/uploads/FE-Mechanical-CBT-specs.pdf",
  },
  {
    title: "FE Electrical and Computer CBT Exam Specifications",
    url: "https://ncees.org/wp-content/uploads/FE-Electrical-and-Computer-CBT-specs.pdf",
  },
  {
    title: "FE Chemical CBT Exam Specifications",
    url: "https://ncees.org/wp-content/uploads/FE-Che-CBT-specs.pdf",
  },
  {
    title: "FE Other Disciplines CBT Exam Specifications",
    url: "https://ncees.org/wp-content/uploads/2022/09/FE-Other-Disciplines-CBT-specs.pdf",
  },
];

const FE_CIVIL: Range[] = [
  ["Mathematics and Statistics", 8, 12],
  ["Ethics and Professional Practice", 4, 6],
  ["Engineering Economics", 5, 8],
  ["Statics", 8, 12],
  ["Dynamics", 4, 6],
  ["Mechanics of Materials", 7, 11],
  ["Materials", 5, 8],
  ["Fluid Mechanics", 6, 9],
  ["Surveying", 6, 9],
  ["Water Resources and Environmental Engineering", 10, 15],
  ["Structural Engineering", 10, 15],
  ["Geotechnical Engineering", 10, 15],
  ["Transportation Engineering", 9, 14],
  ["Construction Engineering", 8, 12],
];

const FE_MECHANICAL: Range[] = [
  ["Mathematics", 6, 9],
  ["Probability and Statistics", 4, 6],
  ["Ethics and Professional Practice", 4, 6],
  ["Engineering Economics", 4, 6],
  ["Electricity and Magnetism", 5, 8],
  ["Statics", 9, 14],
  ["Dynamics, Kinematics, and Vibrations", 10, 15],
  ["Mechanics of Materials", 9, 14],
  ["Material Properties and Processing", 7, 11],
  ["Fluid Mechanics", 10, 15],
  ["Thermodynamics", 10, 15],
  ["Heat Transfer", 7, 11],
  ["Measurements, Instrumentation, and Controls", 5, 8],
  ["Mechanical Design and Analysis", 10, 15],
];

const FE_ELECTRICAL: Range[] = [
  ["Mathematics", 11, 17],
  ["Probability and Statistics", 4, 6],
  ["Ethics and Professional Practice", 4, 6],
  ["Engineering Economics", 5, 8],
  ["Properties of Electrical Materials", 4, 6],
  ["Circuit Analysis (DC and AC Steady State)", 11, 17],
  ["Linear Systems", 5, 8],
  ["Signal Processing", 5, 8],
  ["Electronics", 7, 11],
  ["Power Systems", 8, 12],
  ["Electromagnetics", 4, 6],
  ["Control Systems", 6, 9],
  ["Communications", 5, 8],
  ["Computer Networks", 4, 6],
  ["Digital Systems", 8, 12],
  ["Computer Systems", 5, 8],
  ["Software Engineering", 4, 6],
];

const FE_CHEMICAL: Range[] = [
  ["Mathematics", 6, 9],
  ["Probability and Statistics", 4, 6],
  ["Engineering Sciences", 4, 6],
  ["Materials Science", 4, 6],
  ["Chemistry and Biology", 7, 11],
  ["Fluid Mechanics/Dynamics", 8, 12],
  ["Thermodynamics", 8, 12],
  ["Material/Energy Balances", 10, 15],
  ["Heat Transfer", 8, 12],
  ["Mass Transfer and Separation", 8, 12],
  ["Solids Handling", 3, 5],
  ["Chemical Reaction Engineering", 7, 11],
  ["Economics", 4, 6],
  ["Process Design", 7, 11],
  ["Process Control", 4, 6],
  ["Safety, Health, and Environment", 5, 8],
  ["Ethics and Professional Practice", 3, 5],
];

const FE_OTHER: Range[] = [
  ["Mathematics", 8, 12],
  ["Probability and Statistics", 6, 9],
  ["Chemistry", 5, 8],
  ["Instrumentation and Controls", 4, 6],
  ["Engineering Ethics and Societal Impacts", 5, 8],
  ["Safety, Health, and Environment", 6, 9],
  ["Engineering Economics", 6, 9],
  ["Statics", 9, 14],
  ["Dynamics", 9, 14],
  ["Strength of Materials", 9, 14],
  ["Materials", 6, 9],
  ["Fluid Mechanics", 12, 18],
  ["Basic Electrical Engineering", 6, 9],
  ["Thermodynamics and Heat Transfer", 9, 14],
];

const FE_DISCIPLINES: [name: string, ranges: Range[]][] = [
  ["Civil", FE_CIVIL],
  ["Mechanical", FE_MECHANICAL],
  ["Electrical and Computer", FE_ELECTRICAL],
  ["Chemical", FE_CHEMICAL],
  ["Other Disciplines", FE_OTHER],
];

function toWeights(ranges: readonly Range[]): Record<string, number> {
  return Object.fromEntries(ranges.map(([heading, min, max]) => [heading, (min + max) / 2]));
}

function toSubject({
  name,
  questions,
  weights,
}: {
  name: string;
  questions: number | null;
  weights: Record<string, number>;
}): ShareSubject {
  return { headings: Object.keys(weights), name, questions };
}

/** College Board's "≈" shares of each section's questions. */
const SAT_SHARES = {
  Math: {
    "Advanced Math": 35,
    Algebra: 35,
    "Geometry and Trigonometry": 15,
    "Problem-Solving and Data Analysis": 15,
  },
  "Reading and Writing": {
    "Craft and Structure": 28,
    "Expression of Ideas": 20,
    "Information and Ideas": 26,
    "Standard English Conventions": 26,
  },
};

/** An invented notice: one test splits its points by heading, the other names headings without shares. */
const SPLIT_POINTS_NOTICE = `TRIBUNAL DE CONTAS DO ESTADO DE SERRA AZUL
EDITAL Nº 2/2027 – CONCURSO PÚBLICO PARA AUDITOR DE CONTROLE EXTERNO

7 DA PROVA OBJETIVA
7.1 A prova objetiva terá duas partes: Conhecimentos Básicos, com 40 questões, e Conhecimentos Específicos, com 60 questões.
7.2 Os pontos de Conhecimentos Específicos serão distribuídos da seguinte forma: Auditoria Governamental, 40% dos pontos; Contabilidade Pública, 35% dos pontos; Direito Administrativo, 25% dos pontos.

ANEXO I – CONTEÚDO PROGRAMÁTICO
CONHECIMENTOS BÁSICOS
Língua Portuguesa: 1 Compreensão de textos. 2 Ortografia.
Raciocínio Lógico: 1 Proposições. 2 Conectivos.
CONHECIMENTOS ESPECÍFICOS
Auditoria Governamental: 1 Normas de auditoria. 2 Planejamento.
Contabilidade Pública: 1 Orçamento. 2 Receita e despesa públicas.
Direito Administrativo: 1 Atos administrativos. 2 Licitações.`;

const SPLIT_POINTS_SHARES = {
  "Conhecimentos Básicos": null,
  "Conhecimentos Específicos": {
    "Auditoria Governamental": 40,
    "Contabilidade Pública": 35,
    "Direito Administrativo": 25,
  },
};

export const TEST_CASES: DomainSharesCase[] = [
  {
    expected: SAT_SHARES,
    id: "sat-content-domains",
    language: "en",
    origin: "production",
    userInput: {
      documents: SAT_DOCUMENTS,
      exam: "SAT",
      language: "en",
      subjects: [
        toSubject({
          name: "Reading and Writing",
          questions: null,
          weights: SAT_SHARES["Reading and Writing"],
        }),
        toSubject({ name: "Math", questions: null, weights: SAT_SHARES.Math }),
      ],
    },
  },
  {
    expected: Object.fromEntries(FE_DISCIPLINES.map(([name, ranges]) => [name, toWeights(ranges)])),
    id: "fe-knowledge-areas",
    language: "en",
    origin: "production",
    userInput: {
      documents: FE_DOCUMENTS,
      exam: "FE Exam",
      language: "en",
      subjects: FE_DISCIPLINES.map(([name, ranges]) =>
        toSubject({ name, questions: 110, weights: toWeights(ranges) }),
      ),
    },
  },
  {
    expected: SPLIT_POINTS_SHARES,
    id: "pt-points-split-one-test",
    language: "pt",
    userInput: {
      documents: [{ text: SPLIT_POINTS_NOTICE, title: "Edital nº 2/2027 – TCE Serra Azul" }],
      exam: "Concurso TCE Serra Azul, Auditor de Controle Externo",
      language: "pt",
      subjects: [
        {
          headings: ["Língua Portuguesa", "Raciocínio Lógico"],
          name: "Conhecimentos Básicos",
          questions: 40,
        },
        toSubject({
          name: "Conhecimentos Específicos",
          questions: 60,
          weights: SPLIT_POINTS_SHARES["Conhecimentos Específicos"],
        }),
      ],
    },
  },
];
