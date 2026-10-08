import { describe, expect, it } from "vitest";
import { toSubjectQuestionsFinding } from "./subject-questions-finding";

const PAGE = "https://blog.example.com/oab-distribuicao-de-questoes";
const searched = (url: string) => url.startsWith("https://blog.example.com/");

const raw = {
  counts: [
    { questions: 8, subject: 1 },
    { questions: 6, subject: 2 },
    { questions: 6, subject: 3 },
  ],
  edition: " 45º Exame ",
  sourceTitle: "Quantas questões cai de cada matéria",
  sourceUrl: PAGE,
  status: "found" as const,
};

describe(toSubjectQuestionsFinding, () => {
  it("keeps one count per subject, in the subjects' order, with its source", () => {
    expect(
      toSubjectQuestionsFinding({ isSearched: searched, raw, subjectCount: 3, total: 20 }),
    ).toStrictEqual({
      edition: "45º Exame",
      questions: [8, 6, 6],
      source: { title: "Quantas questões cai de cada matéria", url: PAGE },
      status: "found",
    });
  });

  it("drops counts that miss a subject, don't add up to the exam's total or come from nowhere", () => {
    const unknown = { edition: null, questions: [], source: null, status: "unknown" };

    expect(
      toSubjectQuestionsFinding({ isSearched: searched, raw, subjectCount: 4, total: null }),
    ).toStrictEqual(unknown);

    expect(
      toSubjectQuestionsFinding({ isSearched: searched, raw, subjectCount: 3, total: 80 }),
    ).toStrictEqual(unknown);

    expect(
      toSubjectQuestionsFinding({
        isSearched: searched,
        raw: { ...raw, sourceUrl: "https://invented.example.org/page" },
        subjectCount: 3,
        total: null,
      }),
    ).toStrictEqual(unknown);

    expect(
      toSubjectQuestionsFinding({
        isSearched: searched,
        raw: { ...raw, counts: [...raw.counts, { questions: 2, subject: 1 }] },
        subjectCount: 3,
        total: null,
      }),
    ).toStrictEqual(unknown);
  });
});
