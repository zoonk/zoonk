import { describe, expect, test } from "vitest";
import { assertStepContent, parseStepContent } from "./content-contract";

describe("step content contracts", () => {
  test("parses multipleChoice with optional context/question omitted", () => {
    const content = parseStepContent("multipleChoice", {
      options: [{ feedback: "Correct", isCorrect: true, text: "A" }],
    });

    expect(content).toEqual({
      options: [{ feedback: "Correct", isCorrect: true, text: "A" }],
    });
  });

  test("parses fillBlank with optional question omitted", () => {
    const content = parseStepContent("fillBlank", {
      answers: ["hablo"],
      distractors: ["habla"],
      feedback: "Use first person singular.",
      template: "Yo [BLANK] español.",
    });

    expect(content).toEqual({
      answers: ["hablo"],
      distractors: ["habla"],
      feedback: "Use first person singular.",
      template: "Yo [BLANK] español.",
    });
  });

  test("parses static text variant", () => {
    const content = parseStepContent("static", {
      text: "Background text",
      title: "Background title",
      variant: "text",
    });

    expect(content).toEqual({
      text: "Background text",
      title: "Background title",
      variant: "text",
    });
  });

  test("parses static grammarExample variant", () => {
    const content = parseStepContent("static", {
      highlight: "hablo",
      romanization: "ha-blo",
      sentence: "Yo hablo español.",
      translation: "I speak Spanish.",
      variant: "grammarExample",
    });

    expect(content).toEqual({
      highlight: "hablo",
      romanization: "ha-blo",
      sentence: "Yo hablo español.",
      translation: "I speak Spanish.",
      variant: "grammarExample",
    });
  });

  test("parses static grammarRule variant", () => {
    const content = parseStepContent("static", {
      ruleName: "Present tense endings",
      ruleSummary: "Use -o for yo and -es for tú.",
      variant: "grammarRule",
    });

    expect(content).toEqual({
      ruleName: "Present tense endings",
      ruleSummary: "Use -o for yo and -es for tú.",
      variant: "grammarRule",
    });
  });

  test("parses vocabulary step content", () => {
    const content = parseStepContent("vocabulary", {});
    expect(content).toEqual({});
  });

  test("parses reading step content", () => {
    const content = parseStepContent("reading", {});
    expect(content).toEqual({});
  });

  test("parses listening step content", () => {
    const content = parseStepContent("listening", {});
    expect(content).toEqual({});
  });

  test("parses matchColumns", () => {
    const content = parseStepContent("matchColumns", {
      pairs: [{ left: "A", right: "1" }],
      question: "Match the items.",
    });

    expect(content).toEqual({
      pairs: [{ left: "A", right: "1" }],
      question: "Match the items.",
    });
  });

  test("parses sortOrder", () => {
    const content = parseStepContent("sortOrder", {
      feedback: "Correct order.",
      items: ["one", "two"],
      question: "Sort these items.",
    });

    expect(content).toEqual({
      feedback: "Correct order.",
      items: ["one", "two"],
      question: "Sort these items.",
    });
  });

  test("parses selectImage", () => {
    const content = parseStepContent("selectImage", {
      options: [{ feedback: "Correct", isCorrect: true, prompt: "A cat", url: "https://a.co/x" }],
      question: "Which image shows a cat?",
    });

    expect(content).toEqual({
      options: [{ feedback: "Correct", isCorrect: true, prompt: "A cat", url: "https://a.co/x" }],
      question: "Which image shows a cat?",
    });
  });

  test("throws for invalid fillBlank", () => {
    expect(() =>
      assertStepContent("fillBlank", {
        answers: ["hablo"],
        distractors: ["habla"],
        feedback: "Use first person singular.",
      }),
    ).toThrow();
  });

  test("throws for unknown static variant", () => {
    expect(() =>
      parseStepContent("static", {
        text: "Hello",
        title: "World",
        variant: "unknown",
      }),
    ).toThrow();
  });
});
