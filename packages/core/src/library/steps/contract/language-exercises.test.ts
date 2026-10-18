import { describe, expect, it } from "vitest";
import { parseStepContent } from "./step-contract";

describe("language exercise content", () => {
  it("accepts exercises without their optional prompt fields", () => {
    const option = { feedback: "Correct", id: "a", isCorrect: true, text: "A" };

    const fillBlank = {
      answers: ["hablo"],
      distractors: ["habla"],
      feedback: "Use first person singular.",
      template: "Yo [BLANK] español.",
    };

    expect(parseStepContent("multipleChoice", { options: [option] })).toStrictEqual({
      options: [option],
    });

    expect(parseStepContent("fillBlank", fillBlank)).toStrictEqual(fillBlank);

    expect(parseStepContent("matchColumns", { pairs: [{ left: "A", right: "1" }] })).toStrictEqual({
      pairs: [{ left: "A", right: "1" }],
    });
  });

  it("keeps a multiple choice picture with its prompt and URL", () => {
    const content = {
      context: "Some context",
      image: {
        prompt: "A refund dashboard with one outlier row",
        url: "https://example.com/refund.webp",
      },
      options: [
        { feedback: "Correct!", id: "a", isCorrect: true, text: "A" },
        { feedback: "Wrong.", id: "b", isCorrect: false, text: "B" },
      ],
      question: "What is correct?",
    };

    expect(parseStepContent("multipleChoice", content)).toStrictEqual(content);
  });

  it("repairs generated escapes in nested option text", () => {
    const malformedLatexText = JSON.parse(
      String.raw`"FE preservada, geralmente \u00005c(\\ge 50\\%\\), não fecha."`,
    ) as string;

    const content = parseStepContent("multipleChoice", {
      options: [{ feedback: "Correct", id: "a", isCorrect: true, text: malformedLatexText }],
    });

    expect(content.options[0]?.text).toBe(
      String.raw`FE preservada, geralmente \(\ge 50\%\), não fecha.`,
    );
  });

  it("rejects options with extra fields and exercises missing required ones", () => {
    expect(() =>
      parseStepContent("multipleChoice", {
        options: [
          {
            effects: [{ dimension: "X", impact: "positive" }],
            feedback: "Something",
            id: "a",
            isCorrect: true,
            text: "A",
          },
        ],
      }),
    ).toThrow();

    expect(() =>
      parseStepContent("fillBlank", {
        answers: ["hablo"],
        distractors: ["habla"],
        feedback: "Use first person singular.",
      }),
    ).toThrow();
  });
});
