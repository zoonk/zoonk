import { describe, expect, it } from "vitest";
import { assertStepContent, parseStepContent } from "./content";

describe("step content contracts", () => {
  it("parses multipleChoice with optional context/question omitted", () => {
    const content = parseStepContent("multipleChoice", {
      options: [{ feedback: "Correct", id: "a", isCorrect: true, text: "A" }],
    });

    expect(content).toStrictEqual({
      options: [{ feedback: "Correct", id: "a", isCorrect: true, text: "A" }],
    });
  });

  it("parses multipleChoice with all fields", () => {
    const content = parseStepContent("multipleChoice", {
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
    });

    expect(content).toStrictEqual({
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
    });
  });

  it("rejects multipleChoice options with extra fields", () => {
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
  });

  it("parses fillBlank with optional question omitted", () => {
    const content = parseStepContent("fillBlank", {
      answers: ["hablo"],
      distractors: ["habla"],
      feedback: "Use first person singular.",
      template: "Yo [BLANK] español.",
    });

    expect(content).toStrictEqual({
      answers: ["hablo"],
      distractors: ["habla"],
      feedback: "Use first person singular.",
      template: "Yo [BLANK] español.",
    });
  });

  it("parses static text variant", () => {
    const content = parseStepContent("static", {
      text: "Background text",
      title: "Background title",
      variant: "text",
    });

    expect(content).toStrictEqual({
      text: "Background text",
      title: "Background title",
      variant: "text",
    });
  });

  it("parses static grammarExample variant", () => {
    const content = parseStepContent("static", {
      highlight: "hablo",
      romanization: "ha-blo",
      sentence: "Yo hablo español.",
      translation: "I speak Spanish.",
      variant: "grammarExample",
    });

    expect(content).toStrictEqual({
      highlight: "hablo",
      romanization: "ha-blo",
      sentence: "Yo hablo español.",
      translation: "I speak Spanish.",
      variant: "grammarExample",
    });
  });

  it("rejects obsolete static grammarRule variant", () => {
    expect(() =>
      parseStepContent("static", {
        ruleName: "Present tense endings",
        ruleSummary: "Use -o for yo and -es for tú.",
        variant: "grammarRule",
      }),
    ).toThrow();
  });

  it("parses vocabulary step content", () => {
    const content = parseStepContent("vocabulary", {});
    expect(content).toStrictEqual({});
  });

  it("parses alphabet step content", () => {
    const content = parseStepContent("alphabet", {
      audioText: "あ",
      audioUrl: "https://example.com/a.mp3",
      forms: [],
      pronunciation: "like a in father",
      readingAid: "a",
      symbol: "あ",
    });

    expect(content).toStrictEqual({
      audioText: "あ",
      audioUrl: "https://example.com/a.mp3",
      forms: [],
      pronunciation: "like a in father",
      readingAid: "a",
      symbol: "あ",
    });
  });

  it("parses translation step content", () => {
    const content = parseStepContent("translation", {});
    expect(content).toStrictEqual({});
  });

  it("parses reading step content", () => {
    const content = parseStepContent("reading", {});
    expect(content).toStrictEqual({});
  });

  it("parses listening step content", () => {
    const content = parseStepContent("listening", {});
    expect(content).toStrictEqual({});
  });

  it("parses matchColumns", () => {
    const content = parseStepContent("matchColumns", {
      pairs: [{ left: "A", right: "1" }],
      question: "Match the items.",
    });

    expect(content).toStrictEqual({
      pairs: [{ left: "A", right: "1" }],
      question: "Match the items.",
    });
  });

  it("parses matchColumns with optional question omitted", () => {
    const content = parseStepContent("matchColumns", { pairs: [{ left: "A", right: "1" }] });

    expect(content).toStrictEqual({ pairs: [{ left: "A", right: "1" }] });
  });

  it("parses sortOrder", () => {
    const content = parseStepContent("sortOrder", {
      feedback: "Correct order.",
      items: ["one", "two"],
      question: "Sort these items.",
    });

    expect(content).toStrictEqual({
      feedback: "Correct order.",
      items: ["one", "two"],
      question: "Sort these items.",
    });
  });

  it("parses selectImage", () => {
    const content = parseStepContent("selectImage", {
      options: [
        {
          feedback: "Correct",
          id: "image-1",
          isCorrect: true,
          prompt: "A cat",
          url: "https://a.co/x",
        },
      ],
      question: "Which image shows a cat?",
    });

    expect(content).toStrictEqual({
      options: [
        {
          feedback: "Correct",
          id: "image-1",
          isCorrect: true,
          prompt: "A cat",
          url: "https://a.co/x",
        },
      ],
      question: "Which image shows a cat?",
    });
  });

  it("parses grammar example with null romanization", () => {
    const content = parseStepContent("static", {
      highlight: "hablo",
      romanization: null,
      sentence: "Yo hablo español.",
      translation: "I speak Spanish.",
      variant: "grammarExample",
    });

    expect(content).toStrictEqual({
      highlight: "hablo",
      romanization: null,
      sentence: "Yo hablo español.",
      translation: "I speak Spanish.",
      variant: "grammarExample",
    });
  });

  it("rejects grammar example with empty string romanization", () => {
    expect(() =>
      parseStepContent("static", {
        highlight: "hablo",
        romanization: "",
        sentence: "Yo hablo español.",
        translation: "I speak Spanish.",
        variant: "grammarExample",
      }),
    ).toThrow();
  });

  it("throws for invalid fillBlank", () => {
    expect(() =>
      assertStepContent("fillBlank", {
        answers: ["hablo"],
        distractors: ["habla"],
        feedback: "Use first person singular.",
      }),
    ).toThrow();
  });

  it("throws for unknown static variant", () => {
    expect(() =>
      parseStepContent("static", { text: "Hello", title: "World", variant: "unknown" }),
    ).toThrow();
  });

  describe("static intro", () => {
    it("parses generic intro", () => {
      const content = parseStepContent("static", {
        text: "You arrive in the middle of the problem.",
        title: "Opening",
        variant: "intro",
      });

      expect(content).toStrictEqual({
        text: "You arrive in the middle of the problem.",
        title: "Opening",
        variant: "intro",
      });
    });

    it("rejects intro without title", () => {
      expect(() =>
        parseStepContent("static", {
          text: "You arrive in the middle of the problem.",
          variant: "intro",
        }),
      ).toThrow();
    });

    it("rejects intro with unsupported metrics", () => {
      expect(() =>
        parseStepContent("static", {
          metrics: [{ label: "Production" }, { label: "Morale" }],
          text: "You are a factory manager.",
          title: "Factory crisis",
          variant: "intro",
        }),
      ).toThrow();
    });
  });
});
