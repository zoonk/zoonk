import { describe, expect, test } from "vitest";
import { assertStepContent, parseStepContent } from "./content";

describe("step content contracts", () => {
  test("parses core multipleChoice with optional context/question omitted", () => {
    const content = parseStepContent("multipleChoice", {
      kind: "core",
      options: [{ feedback: "Correct", id: "a", isCorrect: true, text: "A" }],
    });

    expect(content).toEqual({
      kind: "core",
      options: [{ feedback: "Correct", id: "a", isCorrect: true, text: "A" }],
    });
  });

  test("parses core multipleChoice with all fields", () => {
    const content = parseStepContent("multipleChoice", {
      context: "Some context",
      image: {
        prompt: "A refund dashboard with one outlier row",
        url: "https://example.com/refund.webp",
      },
      kind: "core",
      options: [
        { feedback: "Correct!", id: "a", isCorrect: true, text: "A" },
        { feedback: "Wrong.", id: "b", isCorrect: false, text: "B" },
      ],
      question: "What is correct?",
    });

    expect(content).toEqual({
      context: "Some context",
      image: {
        prompt: "A refund dashboard with one outlier row",
        url: "https://example.com/refund.webp",
      },
      kind: "core",
      options: [
        { feedback: "Correct!", id: "a", isCorrect: true, text: "A" },
        { feedback: "Wrong.", id: "b", isCorrect: false, text: "B" },
      ],
      question: "What is correct?",
    });
  });

  test("rejects multipleChoice without kind", () => {
    expect(() =>
      parseStepContent("multipleChoice", {
        options: [{ feedback: "Correct", id: "a", isCorrect: true, text: "A" }],
      }),
    ).toThrow();
  });

  test("rejects core options with extra fields", () => {
    expect(() =>
      parseStepContent("multipleChoice", {
        kind: "core",
        options: [
          {
            effects: [{ dimension: "X", impact: "positive" }],
            feedback: "Something",
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
        options: [{ feedback: "Correct", id: "a", isCorrect: true, text: "A" }],
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

    expect(content).toEqual({
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

  describe("story", () => {
    const baseChoice = {
      alignment: "strong" as const,
      feedback: "Things improve.",
      id: "1a",
      metricEffects: [{ effect: "positive" as const, metric: "Production" }],
      stateImage: { prompt: "World state after the helpful action" },
      text: "Do the right thing",
    };

    test("parses step with problem and options", () => {
      const content = parseStepContent("story", {
        image: { prompt: "Story decision scene" },
        options: [baseChoice, { ...baseChoice, alignment: "weak", id: "1b" }],
        problem: "You face a decision.",
      });

      expect(content.problem).toBe("You face a decision.");
      expect(content.options).toHaveLength(2);
    });

    test("accepts more than 4 options", () => {
      const options = Array.from({ length: 5 }, (_, i) => ({
        ...baseChoice,
        id: `choice-${i}`,
      }));

      const content = parseStepContent("story", {
        image: { prompt: "Crowded decision scene" },
        options,
        problem: "Many options available.",
      });

      expect(content.options).toHaveLength(5);
    });

    test("rejects fewer than 2 choices", () => {
      expect(() =>
        parseStepContent("story", {
          options: [baseChoice],
          problem: "Only one option.",
        }),
      ).toThrow();
    });

    test("rejects extra fields on step content", () => {
      expect(() =>
        parseStepContent("story", {
          intro: "Not allowed here.",
          options: [baseChoice, { ...baseChoice, id: "1b" }],
          problem: "Test.",
        }),
      ).toThrow();
    });

    test("rejects extra fields on choice", () => {
      expect(() =>
        parseStepContent("story", {
          options: [{ ...baseChoice, extra: "field" }],
          problem: "Test.",
        }),
      ).toThrow();
    });

    test("rejects missing problem", () => {
      expect(() =>
        parseStepContent("story", {
          options: [baseChoice, { ...baseChoice, id: "1b" }],
        }),
      ).toThrow();
    });
  });

  describe("static intro", () => {
    test("parses generic intro without story metrics", () => {
      const content = parseStepContent("static", {
        text: "You arrive in the middle of the problem.",
        title: "Opening",
        variant: "intro",
      });

      expect(content).toEqual({
        text: "You arrive in the middle of the problem.",
        title: "Opening",
        variant: "intro",
      });
    });

    test("rejects intro without title", () => {
      expect(() =>
        parseStepContent("static", {
          text: "You arrive in the middle of the problem.",
          variant: "intro",
        }),
      ).toThrow();
    });

    test("rejects intro with story metrics", () => {
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

  describe("static storyOutcome", () => {
    test("parses outcome with metrics", () => {
      const content = parseStepContent("static", {
        metrics: [{ label: "Production" }, { label: "Morale" }],
        outcomes: {
          bad: {
            image: { prompt: "Strained factory" },
            narrative: "The factory barely holds together.",
            title: "Hard Lesson",
          },
          good: {
            image: { prompt: "Stable factory" },
            narrative: "Your factory stabilizes.",
            title: "Solid Manager",
          },
          ok: {
            image: { prompt: "Uneven factory" },
            narrative: "Your factory recovers unevenly.",
            title: "Mixed Shift",
          },
          perfect: {
            image: { prompt: "Thriving factory" },
            narrative: "Your factory thrives.",
            title: "Master Manager",
          },
          terrible: {
            image: { prompt: "Falling apart factory" },
            narrative: "Things fell apart.",
            title: "Learning Moment",
          },
        },
        variant: "storyOutcome",
      });

      expect(content.variant).toBe("storyOutcome");
    });

    test("rejects empty metrics", () => {
      expect(() =>
        parseStepContent("static", {
          metrics: [],
          outcomes: {
            bad: { narrative: "Bad.", title: "Bad" },
            good: { narrative: "Good.", title: "Good" },
            ok: { narrative: "Ok.", title: "Ok" },
            perfect: { narrative: "Perfect.", title: "Perfect" },
            terrible: { narrative: "Terrible.", title: "Terrible" },
          },
          variant: "storyOutcome",
        }),
      ).toThrow();
    });

    test("rejects stories with only one metric", () => {
      expect(() =>
        parseStepContent("static", {
          metrics: [{ label: "Production" }],
          outcomes: {
            bad: { narrative: "Bad.", title: "Bad" },
            good: { narrative: "Good.", title: "Good" },
            ok: { narrative: "Ok.", title: "Ok" },
            perfect: { narrative: "Perfect.", title: "Perfect" },
            terrible: { narrative: "Terrible.", title: "Terrible" },
          },
          variant: "storyOutcome",
        }),
      ).toThrow();
    });

    test("rejects missing outcome tiers", () => {
      expect(() =>
        parseStepContent("static", {
          metrics: [{ label: "Production" }, { label: "Morale" }],
          outcomes: {
            bad: { narrative: "Bad.", title: "Bad" },
            good: { narrative: "Good.", title: "Good" },
            ok: { narrative: "Ok.", title: "Ok" },
            perfect: { narrative: "Perfect.", title: "Perfect" },
          },
          variant: "storyOutcome",
        }),
      ).toThrow();
    });
  });

  describe("investigation", () => {
    test("parses problem variant with scenario", () => {
      const content = parseStepContent("investigation", {
        scenario: "A mysterious event occurred at the manor.",
        variant: "problem",
      });

      expect(content.variant).toBe("problem");
    });

    test("rejects problem with extra fields", () => {
      expect(() =>
        parseStepContent("investigation", {
          extra: "field",
          scenario: "A mysterious event.",
          variant: "problem",
        }),
      ).toThrow();
    });

    test("parses action variant with text, quality, and embedded feedback", () => {
      const content = parseStepContent("investigation", {
        options: [
          {
            feedback: "The footage shows movement at 11pm.",
            id: "a1",
            quality: "critical",
            text: "Check the security footage",
          },
          {
            feedback: "The gardener was in the shed.",
            id: "a2",
            quality: "useful",
            text: "Interview the gardener",
          },
          { feedback: "No clues here.", id: "a3", quality: "weak", text: "Check the attic" },
        ],
        variant: "action",
      });

      expect(content.variant).toBe("action");
    });

    test("rejects invalid quality value", () => {
      expect(() =>
        parseStepContent("investigation", {
          options: [
            { feedback: "Something", id: "a1", quality: "excellent", text: "Do something" },
            { feedback: "Something", id: "a2", quality: "critical", text: "Do more" },
            { feedback: "Something", id: "a3", quality: "useful", text: "Do other" },
          ],
          variant: "action",
        }),
      ).toThrow();
    });

    test("parses call variant with explanations and per-explanation feedback", () => {
      const content = parseStepContent("investigation", {
        options: [
          {
            accuracy: "best",
            feedback: "Correct — the butler did it.",
            id: "e1",
            text: "The butler did it",
          },
          {
            accuracy: "partial",
            feedback: "Close, but not quite.",
            id: "e2",
            text: "The maid did it",
          },
          {
            accuracy: "wrong",
            feedback: "Not supported by evidence.",
            id: "e3",
            text: "The dog did it",
          },
        ],
        variant: "call",
      });

      expect(content.variant).toBe("call");
    });

    test("rejects call with extra fields", () => {
      expect(() =>
        parseStepContent("investigation", {
          correctExplanationIndex: 0,
          options: [{ accuracy: "best", feedback: "Correct.", id: "e1", text: "Explanation." }],
          variant: "call",
        }),
      ).toThrow();
    });

    test("rejects unknown variant", () => {
      expect(() =>
        parseStepContent("investigation", {
          scenario: "Something.",
          variant: "unknown",
        }),
      ).toThrow();
    });

    test("rejects missing variant", () => {
      expect(() =>
        parseStepContent("investigation", {
          scenario: "Something.",
        }),
      ).toThrow();
    });
  });
});
