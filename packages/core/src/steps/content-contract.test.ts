import { describe, expect, test } from "vitest";
import { assertStepContent, parseStepContent } from "./content-contract";

describe("step content contracts", () => {
  test("parses core multipleChoice with optional context/question omitted", () => {
    const content = parseStepContent("multipleChoice", {
      kind: "core",
      options: [{ feedback: "Correct", isCorrect: true, text: "A" }],
    });

    expect(content).toEqual({
      kind: "core",
      options: [{ feedback: "Correct", isCorrect: true, text: "A" }],
    });
  });

  test("parses core multipleChoice with all fields", () => {
    const content = parseStepContent("multipleChoice", {
      context: "Some context",
      kind: "core",
      options: [
        { feedback: "Correct!", isCorrect: true, text: "A" },
        { feedback: "Wrong.", isCorrect: false, text: "B" },
      ],
      question: "What is correct?",
    });

    expect(content).toEqual({
      context: "Some context",
      kind: "core",
      options: [
        { feedback: "Correct!", isCorrect: true, text: "A" },
        { feedback: "Wrong.", isCorrect: false, text: "B" },
      ],
      question: "What is correct?",
    });
  });

  test("rejects multipleChoice without kind", () => {
    expect(() =>
      parseStepContent("multipleChoice", {
        options: [{ feedback: "Correct", isCorrect: true, text: "A" }],
      }),
    ).toThrow();
  });

  test("rejects core options with extra fields", () => {
    expect(() =>
      parseStepContent("multipleChoice", {
        kind: "core",
        options: [
          {
            consequence: "Something",
            effects: [{ dimension: "X", impact: "positive" }],
            text: "A",
          },
        ],
      }),
    ).toThrow();
  });

  test("rejects unknown kind value", () => {
    expect(() =>
      parseStepContent("multipleChoice", {
        kind: "unknown",
        options: [{ feedback: "Correct", isCorrect: true, text: "A" }],
      }),
    ).toThrow();
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

  test("parses translation step content", () => {
    const content = parseStepContent("translation", {});
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

  test("parses grammar example with null romanization", () => {
    const content = parseStepContent("static", {
      highlight: "hablo",
      romanization: null,
      sentence: "Yo hablo español.",
      translation: "I speak Spanish.",
      variant: "grammarExample",
    });

    expect(content).toEqual({
      highlight: "hablo",
      romanization: null,
      sentence: "Yo hablo español.",
      translation: "I speak Spanish.",
      variant: "grammarExample",
    });
  });

  test("rejects grammar example with empty string romanization", () => {
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

  describe("tradeoff", () => {
    const validContent = {
      event: null,
      outcomes: [
        {
          invested: { consequence: "Great progress" },
          maintained: { consequence: "Treading water" },
          neglected: { consequence: "Things got worse" },
          priorityId: "study",
        },
        {
          invested: { consequence: "Healthy" },
          maintained: { consequence: "OK" },
          neglected: { consequence: "Stressed" },
          priorityId: "exercise",
        },
        {
          invested: { consequence: "Well rested" },
          maintained: { consequence: "Fine" },
          neglected: { consequence: "Exhausted" },
          priorityId: "sleep",
        },
      ],
      priorities: [
        { description: "Study notes", id: "study", name: "Study" },
        { description: "Physical activity", id: "exercise", name: "Exercise" },
        { description: "Rest and recovery", id: "sleep", name: "Sleep" },
      ],
      resource: { name: "hours", total: 5 },
      stateModifiers: null,
      tokenOverride: null,
    };

    test("parses valid tradeoff content", () => {
      const result = parseStepContent("tradeoff", validContent);
      expect(result.priorities).toHaveLength(3);
      expect(result.resource.total).toBe(5);
      expect(result.event).toBeNull();
    });

    test("parses tradeoff content with event and modifiers", () => {
      const result = parseStepContent("tradeoff", {
        ...validContent,
        event: "The exam was moved to tomorrow",
        stateModifiers: [{ delta: -1, priorityId: "sleep" }],
        tokenOverride: 4,
      });
      expect(result.event).toBe("The exam was moved to tomorrow");
      expect(result.stateModifiers).toHaveLength(1);
      expect(result.tokenOverride).toBe(4);
    });

    test("rejects tradeoff with fewer than 3 priorities", () => {
      expect(() =>
        parseStepContent("tradeoff", {
          ...validContent,
          priorities: [
            { description: "a", id: "a", name: "A" },
            { description: "b", id: "b", name: "B" },
          ],
        }),
      ).toThrow();
    });

    test("rejects tradeoff with more than 4 priorities", () => {
      expect(() =>
        parseStepContent("tradeoff", {
          ...validContent,
          priorities: [
            { description: "a", id: "a", name: "A" },
            { description: "b", id: "b", name: "B" },
            { description: "c", id: "c", name: "C" },
            { description: "d", id: "d", name: "D" },
            { description: "e", id: "e", name: "E" },
          ],
        }),
      ).toThrow();
    });

    test("rejects tradeoff with missing outcomes", () => {
      expect(() =>
        parseStepContent("tradeoff", {
          ...validContent,
          outcomes: [],
        }),
      ).toThrow();
    });

    test("rejects tradeoff with extra fields", () => {
      expect(() =>
        parseStepContent("tradeoff", {
          ...validContent,
          extraField: "should fail",
        }),
      ).toThrow();
    });
  });
});
