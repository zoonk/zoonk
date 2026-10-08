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
  return { description: `${kind} question`, document: 1, kind, options, passage: kind };
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
  it("adds every format the reading missed, two of the same kind included", () => {
    const table = { ...format("shortAnswer"), description: "Completar a tabela das organelas" };
    const essay = { ...format("essay"), description: "Dissertativa sobre osmose" };

    expect(mergeQuestionFormats({ found: [table, essay], read: [] })).toStrictEqual([table, essay]);

    const otherShort = { ...format("shortAnswer"), description: "Rotular a célula" };

    expect(
      mergeQuestionFormats({ found: [table, otherShort], read: [format("essay")] }),
    ).toStrictEqual([format("essay"), table, otherShort]);
  });

  // Pedro's notes, read again: the reading's table was "other" and the narrow read's "shortAnswer".
  it("keeps one entry for a format both read, the one that names its kind", () => {
    const table = {
      ...format("other"),
      description: "Questão para preenchimento de tabela sobre organelas.",
    };

    const essay = { ...format("essay"), description: "Questão discursiva sobre osmose." };

    const shortAnswer = {
      ...format("shortAnswer"),
      description: "Questão de completar a tabela das organelas.",
    };

    const sameEssay = { ...format("essay"), description: "Dissertativa sobre osmose" };

    expect(
      mergeQuestionFormats({ found: [shortAnswer, sameEssay], read: [essay, table] }),
    ).toStrictEqual([essay, shortAnswer]);
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
    const essay = { ...format("essay"), description: "Redação dissertativo-argumentativa" };
    const osmosis = { ...format("essay"), description: "Dissertativa sobre osmose" };

    expect(mergeQuestionFormats({ found: [osmosis], read: [essay] })).toStrictEqual([
      essay,
      osmosis,
    ]);
  });

  it("keeps the reading's format of a kind, taking the narrow read's when only it states the options", () => {
    const fiveOptions = format("multipleChoice", 5);

    expect(
      mergeQuestionFormats({ found: [fiveOptions], read: [format("multipleChoice")] }),
    ).toStrictEqual([fiveOptions]);

    expect(
      mergeQuestionFormats({ found: [format("multipleChoice")], read: [fiveOptions] }),
    ).toStrictEqual([fiveOptions]);
  });
});
