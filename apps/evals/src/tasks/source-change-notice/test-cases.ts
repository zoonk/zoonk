import { type TestCase } from "@/lib/types";
import { type SourceChangeNoticeParams } from "@zoonk/ai/tasks/v2/research/source-change-notice";

const SHARED_EXPECTATIONS = `
- One plain sentence in the requested language, at most 120 characters.
- Names what changed first (the notice, the law, the documentation), then the most important new value.
- States only what the changes show: no reasons, no advice, no judgment of whether the change is good.
- No em dashes, exclamation marks or emoji, and no promise of any result.
`;

export const TEST_CASES: TestCase<unknown, SourceChangeNoticeParams>[] = [
  {
    expectations: `${SHARED_EXPECTATIONS}\n- Says the notice changed and the objective test now has 100 items (or questions), in Portuguese.`,
    id: "tcdf-question-count",
    userInput: {
      changes: JSON.stringify([{ after: 100, before: 120, field: "edition.questionCount" }]),
      language: "pt",
      source: "Concurso TCDF, Analista Administrativo de Controle Externo",
    },
  },
  {
    expectations: `${SHARED_EXPECTATIONS}\n- Says the exam date moved to 22 November 2026 (in Portuguese), and may add "e mais" for the other change.`,
    id: "exam-date-moved",
    userInput: {
      changes: JSON.stringify([
        {
          after: [{ date: "2026-11-22", kind: "exam", label: "Provas objetivas e discursiva" }],
          before: [{ date: "2026-11-08", kind: "exam", label: "Provas objetivas e discursiva" }],
          field: "edition.dates",
        },
        {
          after: [{ text: "Será permitido o uso de caneta transparente." }],
          before: [],
          field: "rules",
        },
      ]),
      language: "pt",
      source: "Concurso TCDF",
    },
  },
  {
    expectations: `${SHARED_EXPECTATIONS}\n- In English, says the documentation changed and names the removed API or the new version from the lines.`,
    id: "software-docs",
    userInput: {
      changes:
        "- The `getServerSideProps` API is supported in the pages router.\n+ Version 17 removes `getServerSideProps`; use Server Components to fetch data.",
      language: "en",
      source: "Next.js documentation",
    },
  },
  {
    expectations: `${SHARED_EXPECTATIONS}\n- In German, says the dates changed and gives the new Mathematik date (6 May 2027).`,
    id: "abitur-date",
    userInput: {
      changes: JSON.stringify([
        {
          after: [{ date: "2027-05-06", kind: "exam", label: "Mathematik" }],
          before: [{ date: "2027-05-05", kind: "exam", label: "Mathematik" }],
          field: "edition.dates",
        },
      ]),
      language: "de",
      source: "Abitur Bayern 2027",
    },
  },
];
