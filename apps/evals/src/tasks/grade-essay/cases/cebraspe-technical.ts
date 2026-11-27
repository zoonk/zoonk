import economics2024 from "./cebraspe-2024-economics.json";
import law2024 from "./cebraspe-2024-law.json";
import economics2025 from "./cebraspe-2025-economics.json";
import law2025 from "./cebraspe-2025-law.json";
import { type GradeWritingExpected, publishedCase, publishedQuestion } from "./shared";

export type CacdTechnicalSubject = NonNullable<GradeWritingExpected["cacd"]>["subject"];

const SOURCES = {
  2024: {
    comparative: false,
    guide:
      "https://guiasirbr.wordpress.com/wp-content/uploads/2025/06/guia_da_sarue_malabarista.pdf",
    notice:
      "https://cdn.cebraspe.org.br/concursos/IRBR_24_DIPLOMACIA/arquivos/ED_1_IRBR_CACD_24_ABERTURA_ATUALIZADO_RET_2.PDF",
    questions: {
      economics:
        "https://cdn.cebraspe.org.br/concursos/irbr_24_diplomacia/arquivos/2_IRBR_24_SEGUNDA_FASE_PROVA_ESCRITA_DE_ECONOMIA.PDF",
      law: "https://cdn.cebraspe.org.br/concursos/irbr_24_diplomacia/arquivos/3_IRBR_24_SEGUNDA_FASE_PROVA_ESCRITA_DE_DIREITO.PDF",
    },
  },
  2025: {
    comparative: false,
    guide: "https://drive.google.com/file/d/1iyvblAfecpqH2SSnKNP1NzOc2vntNiWK/view",
    notice:
      "https://cdn.cebraspe.org.br/concursos/IRBR_25_DIPLOMACIA/arquivos/Ed_1_IRBr_CACD_25_abertura_atualizado_ret_6_convertido.html",
    questions: {
      economics:
        "https://cdn.cebraspe.org.br/concursos/irbr_25_diplomacia/arquivos/6177C8D07037EF600652D50E071512236FEDD1E71BC4DD746001BCB61DB5EE14.pdf",
      law: "https://cdn.cebraspe.org.br/concursos/irbr_25_diplomacia/arquivos/958AD9FE33DEA065CEC6CF3474796B1B1CFD6F74CE4512D0406A8526179F5DAA.pdf",
    },
    standards: {
      economics:
        "https://cdn.cebraspe.org.br/concursos/irbr_25_diplomacia/arquivos/7FCCCF34DAD7168E0F1F45EE75D7BCF6FE51B14A0187B3DCBFB685BDB06E54C9.pdf",
      law: "https://cdn.cebraspe.org.br/concursos/irbr_25_diplomacia/arquivos/ADFFD68AE706D0FA173B085E0F008CA39A96486A06305A4BD801A77980C5D84C.pdf",
    },
  },
};

type Year = keyof typeof SOURCES;
type Section = Parameters<typeof publishedQuestion>[0]["sections"][number];

type TechnicalQuestion = {
  answers: {
    author: string;
    lines: number | null;
    mark: number;
    page: number;
    shortOfFull: number[] | null;
    text: string;
  }[];
  context: string | null;
  lines: number;
  number: number;
  points: number;
  question: string;
  questionPage: number;
  sections: (Omit<Section, "aspects"> & { aspects: (string | number)[][] })[];
  standard: string;
  standardPage: number;
  title: string;
};

function questionSections(question: TechnicalQuestion): Section[] {
  return question.sections.map(({ aspects, id, name }) => ({
    aspects: aspects.map(([description, credit]): [string, number] => {
      if (typeof description !== "string" || typeof credit !== "number") {
        throw new TypeError(`Invalid CACD rubric for ${question.title} / ${id}.`);
      }

      return [description, credit];
    }),
    id,
    name,
  }));
}

function itemExpectations(question: TechnicalQuestion, shortOfFull: number[] | null) {
  const full = (index: number) => shortOfFull !== null && !shortOfFull.includes(index + 1);

  const aspects = question.sections.flatMap(({ aspects: entries }, itemIndex) =>
    entries.map(() => full(itemIndex)),
  );

  return {
    earned: aspects.flatMap((known, index) => (known ? [index] : [])),
    uncertain: aspects.flatMap((known, index) => (known ? [] : [index])),
  };
}

function technicalCases({
  questions,
  subject,
  year,
}: {
  questions: TechnicalQuestion[];
  subject: CacdTechnicalSubject;
  year: Year;
}) {
  const source = SOURCES[year];
  const { comparative, guide, notice } = source;

  return questions.flatMap((question) => {
    const { answers, context, lines, number, points, questionPage, standard, standardPage, title } =
      question;

    const taskKey = `cacd-${year}-${subject}`;
    const reference = `${"standards" in source ? source.standards[subject] : guide}#page=${standardPage}`;

    const input = publishedQuestion({
      citation: { passage: `Padrão de resposta, questão ${number}`, sourceId: reference },
      kind: "points",
      lines,
      question: question.question,
      sections: questionSections(question),
      taskKey,
      text: "",
      title,
    });

    if (input.basis.points !== points) {
      throw new Error(`Wrong rubric total for ${taskKey} Q${number}.`);
    }

    const zeroing = [
      ["blank", "Ausência de texto"],
      ["offTopic", "Fuga ao tema"],
      ["identification", "Marca identificadora na resposta"],
    ] as const;

    input.basis.grading.zeroing = zeroing.map(([kind, text]) => ({
      citation: { passage: text, sourceId: notice },
      kinds: [kind],
      text,
    }));

    return answers.map(({ author, lines: writtenLines, mark, page, shortOfFull, text }, index) => {
      const expected: Partial<GradeWritingExpected> = {
        ...itemExpectations(question, shortOfFull),
        cacd: {
          comparative,
          itemsBelowMaximum: shortOfFull,
          questionReference: `${source.questions[subject]}#page=${questionPage}`,
          subject,
          writtenLines,
          year,
        },
        officialContent: mark,
        officialTotal: mark,
      };

      return publishedCase({
        expected,
        id: `cebraspe-${taskKey}-q${number}-${index + 1}`,
        source: {
          author,
          board: "Cebraspe",
          notice,
          reference,
          scoreReference: `${guide}#page=${page}`,
        },
        userInput: { ...input, context, keyPoints: [standard], text },
      });
    });
  });
}

export const CEBRASPE_TECHNICAL_CASES = [
  ...technicalCases({ questions: economics2024, subject: "economics", year: 2024 }),
  ...technicalCases({ questions: law2024, subject: "law", year: 2024 }),
  ...technicalCases({ questions: economics2025, subject: "economics", year: 2025 }),
  ...technicalCases({ questions: law2025, subject: "law", year: 2025 }),
];
