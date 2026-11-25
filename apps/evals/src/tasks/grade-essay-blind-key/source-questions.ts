import { type WritingPromptInput } from "@zoonk/ai/tasks/items/write-writing-prompt";
import { CEBRASPE_PUBLISHED_CASES } from "../grade-essay/cases/cebraspe-published";
import { FGV_PUBLISHED_CASES } from "../grade-essay/cases/fgv-published";
import { type Grading, type WritingCase } from "../grade-essay/cases/shared";

/** A real question a board set, as the writer may see it: the notice's rules, never its key. */
export type SourceQuestion = {
  id: string;
  board: "FGV/OAB" | "Cebraspe";
  stratum: "fgv-oab" | "cacd-history";
  cutoffShare: number;
  cutoffSource: string;
  question: string;
  context: string | null;
  /** The notice's grading the writer and the grader both read. */
  grading: Grading;
  writerInput: WritingPromptInput;
  cases: WritingCase[];
};

const SKILL = {
  id: "0195f1d2-7c4a-7d3e-9a10-4b5c6d7e8f90",
  name: "Responder questões discursivas fundamentadas",
};

const OAB_AREAS: Record<string, string> = {
  civil: "Direito Civil",
  labor: "Direito do Trabalho",
  penal: "Direito Penal",
  tax: "Direito Tributário",
};

const OAB_EXAMS: Record<string, string> = {
  xv: "XV Exame de Ordem Unificado (OAB), 2ª fase",
  xvi: "XVI Exame de Ordem Unificado (OAB), 2ª fase",
};

/** OAB's notice: the practical test passes at 6.00 of 10.00 points; each question is worth 1.25. */
const OAB_CUTOFF = { share: 0.6, source: "FGV OAB notice: 6.00 of 10.00 in the practical test" };

/** CACD's notice (6.8.10) passes the written phase at 480 of its eight 100-point tests. */
const CACD_CUTOFF = { share: 0.6, source: "CACD notice 6.8.10: 480.00 of 800.00 in the phase" };

/** The grading the writer and the grader see cite the notice, never the board's standard. */
function noticeGrading(grading: Grading, notice: string, passage: string): Grading {
  return {
    ...grading,
    criteria: grading.criteria.map((criterion) => ({
      ...criterion,
      citation: { passage, sourceId: notice },
    })),
  };
}

function oabQuestion(cases: WritingCase[]): SourceQuestion {
  const [first] = cases;

  if (!first) {
    throw new Error("A source question needs a case.");
  }

  const parts = first.id.split("-");
  const exam = parts[2] ?? "";
  const area = parts[3] ?? "";
  const notice = first.expected?.source?.notice ?? "";
  const { basis, context, question } = first.userInput;
  const subject = OAB_AREAS[area] ?? area;

  const grading = noticeGrading(
    basis.grading,
    notice,
    "Prova prático-profissional: quatro questões práticas, sob a forma de situações-problema, valendo 1,25 ponto cada",
  );

  return {
    board: "FGV/OAB",
    cases,
    context,
    cutoffShare: OAB_CUTOFF.share,
    cutoffSource: OAB_CUTOFF.source,
    grading,
    id: first.id.replace(/-pt$/u, ""),
    question,
    stratum: "fgv-oab",
    writerInput: {
      board: "FGV",
      choices: [{ group: "Área de opção da prova prático-profissional", subject }],
      drillSkillId: null,
      exam: OAB_EXAMS[exam] ?? exam,
      language: "pt",
      skills: [SKILL],
      subject: { name: subject, topics: [] },
      task: {
        count: 4,
        description:
          "quatro questões práticas, sob a forma de situações-problema, de até 30 linhas cada, valendo 1,25 ponto cada, na área de opção do examinando",
        grading,
        handwritten: true,
        key: `oab-${exam}-${area}-questions`,
        lines: basis.lines,
        minutes: 300,
        points: basis.points,
        section: "Prova prático-profissional",
        session: null,
      },
      unit: "answer",
      usedTitles: [],
    },
  };
}

function cacdQuestion(cases: WritingCase[]): SourceQuestion {
  const [first] = cases;

  if (!first) {
    throw new Error("A source question needs a case.");
  }

  const notice = first.expected?.source?.notice ?? "";
  const { basis, context, question } = first.userInput;
  const id = first.id.replace(/-\d+-pt$/u, "");
  const year = id.split("-")[2];

  const grading = noticeGrading(
    basis.grading,
    notice,
    "6.8.7 As quatro questões da prova escrita de História do Brasil valerão um total de 100,00 pontos e serão avaliadas conforme os critérios constantes do item 3 do Anexo IV",
  );

  return {
    board: "Cebraspe",
    cases,
    context,
    cutoffShare: CACD_CUTOFF.share,
    cutoffSource: CACD_CUTOFF.source,
    grading,
    id,
    question,
    stratum: "cacd-history",
    writerInput: {
      board: "Cebraspe",
      choices: [],
      drillSkillId: null,
      exam: `Concurso de Admissão à Carreira de Diplomata (CACD) ${year}, Segunda Fase`,
      language: "pt",
      skills: [SKILL],
      subject: { name: "História do Brasil", topics: [] },
      task: {
        count: 4,
        description: `prova escrita de História do Brasil com quatro questões discursivas que valem 100,00 pontos no total; esta questão vale ${basis.points} pontos, em até ${basis.lines} linhas`,
        grading,
        handwritten: true,
        key: `cacd-${year}-history`,
        lines: basis.lines,
        minutes: 300,
        points: basis.points,
        section: "Prova escrita de História do Brasil",
        session: null,
      },
      unit: "answer",
      usedTitles: [],
    },
  };
}

function groupBy(cases: WritingCase[], key: (testCase: WritingCase) => string) {
  const groups = new Map<string, WritingCase[]>();

  for (const testCase of cases) {
    groups.set(key(testCase), [...(groups.get(key(testCase)) ?? []), testCase]);
  }

  return [...groups.values()];
}

export const SOURCE_QUESTIONS: SourceQuestion[] = [
  ...groupBy(FGV_PUBLISHED_CASES, ({ id }) => id).map((cases) => oabQuestion(cases)),
  ...groupBy(
    CEBRASPE_PUBLISHED_CASES.filter(({ id }) => id.includes("-history-")),
    ({ id }) => id.replace(/-\d+-pt$/u, ""),
  ).map((cases) => cacdQuestion(cases)),
];
