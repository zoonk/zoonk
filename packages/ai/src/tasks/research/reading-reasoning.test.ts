import { describe, expect, it, vi } from "vitest";
import { type QuestionFormat, mergeQuestionFormats } from "./extract-question-formats";
import { getReadingReasoning } from "./reading-reasoning";
import { type ResearchDocument } from "./research-documents";

vi.mock("server-only", () => ({}));
vi.mock("./extract-exam-blueprint.prompt.md", () => ({ default: "Read the notice." }));
vi.mock("./extract-question-formats.prompt.md", () => ({ default: "List the formats." }));

function textDocument(chars: number): ResearchDocument {
  return { file: null, images: [], text: "a".repeat(chars), title: "Notes", url: null };
}

function fileDocument(mediaType: string): ResearchDocument {
  return {
    file: { data: new Uint8Array([1]), mediaType },
    images: [],
    text: null,
    title: "Upload",
    url: null,
  };
}

function format(kind: QuestionFormat["kind"], options: number | null = null): QuestionFormat {
  return {
    count: null,
    countPassage: null,
    description: `${kind} question`,
    document: 1,
    entry: null,
    kind,
    markingPassage: null,
    options,
    partialCredit: null,
    passage: kind,
    sections: [],
    select: null,
  };
}

describe(getReadingReasoning, () => {
  it("reads a page of notes or a photo at low reasoning, and a whole notice at the default", () => {
    expect(getReadingReasoning({ documents: [textDocument(1945)] })).toBe("low");
    expect(getReadingReasoning({ documents: [fileDocument("image/jpeg")] })).toBe("low");
    expect(getReadingReasoning({ documents: [textDocument(90_000)] })).toBeUndefined();

    expect(
      getReadingReasoning({ documents: [textDocument(15_000), textDocument(15_000)] }),
    ).toBeUndefined();
  });

  it("reads a file it can't size at the default, and keeps the caller's reasoning", () => {
    expect(getReadingReasoning({ documents: [fileDocument("application/pdf")] })).toBeUndefined();
    expect(getReadingReasoning({ documents: [textDocument(100)], reasoning: "high" })).toBe("high");
  });
});

describe(mergeQuestionFormats, () => {
  it("keeps different formats quoted in the same sentence", () => {
    const passage = "Questions are multiple choice or numeric entry.";
    const choice = { ...format("multipleChoice", 5), passage };
    const numeric = { ...format("numeric"), passage };

    expect(mergeQuestionFormats({ found: [choice], read: [choice, numeric] })).toStrictEqual([
      choice,
      numeric,
    ]);
  });

  it("keeps known sections from the matching blueprint reading", () => {
    const choice = format("multipleChoice", 5);
    const scoped = { ...choice, sections: ["Verbal"] };
    expect(mergeQuestionFormats({ found: [choice], read: [scoped] })).toStrictEqual([scoped]);
    expect(mergeQuestionFormats({ found: [scoped], read: [choice] })).toStrictEqual([scoped]);
  });

  it("adds every format the reading missed, two of the same kind included", () => {
    const table = { ...format("shortAnswer"), description: "Completar a tabela das organelas" };
    const essay = { ...format("essay"), description: "Dissertativa sobre osmose" };

    expect(mergeQuestionFormats({ found: [table, essay], read: [] })).toStrictEqual([table, essay]);

    const otherShort = {
      ...format("shortAnswer"),
      description: "Rotular a célula",
      passage: "rotular a célula",
    };

    expect(
      mergeQuestionFormats({ found: [table, otherShort], read: [format("essay")] }),
    ).toStrictEqual([table, otherShort, format("essay")]);
  });

  it("recovers scope when another choice format is present", () => {
    const completion = {
      ...format("multipleChoice", 3),
      description: "Complete a sentence",
      passage: "Fill the blank",
    };

    const comparison = {
      ...format("multipleChoice", 4),
      description: "Compare quantities",
      passage: "Compare quantities",
      sections: ["Quantitative"],
    };

    const scoped = { ...completion, sections: ["Verbal"] };

    expect(
      mergeQuestionFormats({ found: [completion, comparison], read: [scoped, comparison] }),
    ).toStrictEqual([scoped, comparison]);
  });

  it("keeps the narrow read's entry for a format both quote, and the reading's alone when it found none", () => {
    const passage = "This question type presents the answer choices in columns.";

    const columns = {
      ...format("multipleChoice", 5),
      description: "Fill each blank with one choice from its own column",
      passage,
      sections: ["Verbal"],
    };

    const severalPicks = {
      ...format("multipleChoice"),
      description: "One or more choices per column",
      passage,
      select: "all" as const,
    };

    expect(mergeQuestionFormats({ found: [columns], read: [severalPicks] })).toStrictEqual([
      columns,
    ]);

    expect(mergeQuestionFormats({ found: [], read: [severalPicks] })).toStrictEqual([severalPicks]);
  });

  it("adds the reading's format the narrow read missed though their descriptions share words", () => {
    const onePick = {
      ...format("multipleChoice", 5),
      description: "Select one answer choice",
      passage: "select just one answer choice",
    };

    const comparison = {
      ...format("multipleChoice", 4),
      description: "Compare two quantities and select one of four answer choices",
      passage: "Select one of the following four answer choices",
    };

    expect(mergeQuestionFormats({ found: [onePick], read: [comparison] })).toStrictEqual([
      onePick,
      comparison,
    ]);
  });

  it("takes the reading's format that names the kind of one the narrow read called 'other'", () => {
    const table = {
      ...format("other"),
      description: "Questão para preenchimento de tabela sobre organelas.",
    };

    const shortAnswer = {
      ...format("shortAnswer"),
      description: "Questão de completar a tabela das organelas.",
    };

    const essay = { ...format("essay"), description: "Dissertativa sobre osmose" };

    expect(mergeQuestionFormats({ found: [table, essay], read: [shortAnswer] })).toStrictEqual([
      shortAnswer,
      essay,
    ]);
  });

  it("keeps both formats the narrow read names where the reading read one 'other' for both", () => {
    const both = {
      ...format("other"),
      description: "Completar a tabela das organelas e dissertativa sobre osmose",
    };

    const table = { ...format("shortAnswer"), description: "Completar a tabela das organelas" };
    const essay = { ...format("essay"), description: "Dissertativa sobre osmose" };

    expect(mergeQuestionFormats({ found: [table, essay], read: [both] })).toStrictEqual([
      table,
      essay,
    ]);
  });

  it("keeps a format of a kind the reading has when it asks something else", () => {
    const essay = {
      ...format("essay"),
      description: "Redação dissertativo-argumentativa",
      passage: "redação",
    };

    const osmosis = { ...format("essay"), description: "Dissertativa sobre osmose" };

    expect(mergeQuestionFormats({ found: [osmosis], read: [essay] })).toStrictEqual([
      osmosis,
      essay,
    ]);
  });

  it("takes the reading's options only when each read has one format answered that way", () => {
    const fiveOptions = format("multipleChoice", 5);

    expect(
      mergeQuestionFormats({ found: [format("multipleChoice")], read: [fiveOptions] }),
    ).toStrictEqual([fiveOptions]);

    const comparison = {
      ...format("multipleChoice", 4),
      description: "Compare two amounts, four fixed choices",
      passage: "compare the two amounts",
    };

    const onePick = { ...format("multipleChoice"), description: "Pick one choice" };

    const blanks = {
      ...format("multipleChoice"),
      description: "Fill a blank from a short list",
      passage: "fill the blank",
    };

    expect(
      mergeQuestionFormats({ found: [onePick, blanks], read: [comparison] }).map(
        (merged) => merged.options,
      ),
    ).toStrictEqual([null, null, 4]);
  });
});
