import { describe, expect, test } from "vitest";
import { assertStepContent, parseStepContent } from "./content";

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

  describe("story", () => {
    const baseChoice = {
      alignment: "strong" as const,
      consequence: "Things improve.",
      id: "1a",
      metricEffects: [{ effect: "positive" as const, metric: "Production" }],
      text: "Do the right thing",
    };

    test("parses step with situation and choices", () => {
      const content = parseStepContent("story", {
        choices: [baseChoice, { ...baseChoice, alignment: "weak", id: "1b" }],
        situation: "You face a decision.",
      });

      expect(content.situation).toBe("You face a decision.");
      expect(content.choices).toHaveLength(2);
    });

    test("accepts more than 4 choices", () => {
      const choices = Array.from({ length: 5 }, (_, i) => ({
        ...baseChoice,
        id: `choice-${i}`,
      }));

      const content = parseStepContent("story", {
        choices,
        situation: "Many options available.",
      });

      expect(content.choices).toHaveLength(5);
    });

    test("rejects fewer than 2 choices", () => {
      expect(() =>
        parseStepContent("story", {
          choices: [baseChoice],
          situation: "Only one option.",
        }),
      ).toThrow();
    });

    test("rejects extra fields on step content", () => {
      expect(() =>
        parseStepContent("story", {
          choices: [baseChoice, { ...baseChoice, id: "1b" }],
          intro: "Not allowed here.",
          situation: "Test.",
        }),
      ).toThrow();
    });

    test("rejects extra fields on choice", () => {
      expect(() =>
        parseStepContent("story", {
          choices: [{ ...baseChoice, extra: "field" }],
          situation: "Test.",
        }),
      ).toThrow();
    });

    test("rejects missing situation", () => {
      expect(() =>
        parseStepContent("story", {
          choices: [baseChoice, { ...baseChoice, id: "1b" }],
        }),
      ).toThrow();
    });
  });

  describe("static storyIntro", () => {
    test("parses intro with metrics", () => {
      const content = parseStepContent("static", {
        intro: "You are a factory manager in 1950.",
        metrics: ["Production", "Morale", "Cash"],
        variant: "storyIntro",
      });

      expect(content.variant).toBe("storyIntro");
    });

    test("rejects empty metrics", () => {
      expect(() =>
        parseStepContent("static", {
          intro: "You are a factory manager.",
          metrics: [],
          variant: "storyIntro",
        }),
      ).toThrow();
    });
  });

  describe("static storyOutcome", () => {
    test("parses outcome with metrics", () => {
      const content = parseStepContent("static", {
        metrics: ["Production", "Morale"],
        outcomes: [
          { minStrongChoices: 4, narrative: "Your factory thrives.", title: "Master Manager" },
          { minStrongChoices: 0, narrative: "Things fell apart.", title: "Learning Moment" },
        ],
        variant: "storyOutcome",
      });

      expect(content.variant).toBe("storyOutcome");
    });

    test("rejects negative minStrongChoices", () => {
      expect(() =>
        parseStepContent("static", {
          metrics: ["Production"],
          outcomes: [{ minStrongChoices: -1, narrative: "Bad.", title: "Bad" }],
          variant: "storyOutcome",
        }),
      ).toThrow();
    });
  });

  describe("investigation", () => {
    const baseVisual = { kind: "image" as const, prompt: "A crime scene photo" };

    test("parses problem variant with scenario, explanations, and visual", () => {
      const content = parseStepContent("investigation", {
        explanations: [
          { accuracy: "best", text: "The butler did it" },
          { accuracy: "partial", text: "The maid did it" },
          { accuracy: "wrong", text: "The dog did it" },
        ],
        scenario: "A mysterious event occurred at the manor.",
        variant: "problem",
        visual: baseVisual,
      });

      expect(content.variant).toBe("problem");
    });

    test("rejects problem with extra fields", () => {
      expect(() =>
        parseStepContent("investigation", {
          explanations: [{ accuracy: "best", text: "The butler did it" }],
          extra: "field",
          scenario: "A mysterious event.",
          variant: "problem",
          visual: baseVisual,
        }),
      ).toThrow();
    });

    test("parses action variant with labels and quality tiers", () => {
      const content = parseStepContent("investigation", {
        actions: [
          { label: "Check the security footage", quality: "critical" },
          { label: "Interview the gardener", quality: "useful" },
          { label: "Inspect the flower beds", quality: "weak" },
        ],
        variant: "action",
      });

      expect(content.variant).toBe("action");
    });

    test("rejects invalid quality value", () => {
      expect(() =>
        parseStepContent("investigation", {
          actions: [{ label: "Do something", quality: "excellent" }],
          variant: "action",
        }),
      ).toThrow();
    });

    test("parses evidence variant with findings, interpretations, and visuals", () => {
      const content = parseStepContent("investigation", {
        findings: [
          {
            interpretations: [
              {
                best: {
                  feedback:
                    "The careful reading acknowledges both what the footage shows and its limits.",
                  text: "The footage shows movement but doesn't identify who.",
                },
                dismissive: {
                  feedback: "Dismissing the footage entirely ignores relevant evidence.",
                  text: "The footage doesn't show anything useful.",
                },
                overclaims: {
                  feedback: "The footage alone doesn't prove identity.",
                  text: "The footage proves the butler was there.",
                },
              },
            ],
            text: "The security footage shows movement at 11pm.",
            visual: { kind: "image" as const, prompt: "Security camera still" },
          },
        ],
        variant: "evidence",
      });

      expect(content.variant).toBe("evidence");
    });

    test("rejects evidence with extra fields on findings", () => {
      expect(() =>
        parseStepContent("investigation", {
          findings: [
            {
              correctTag: "supports",
              interpretations: [],
              text: "Some text.",
              visual: baseVisual,
            },
          ],
          variant: "evidence",
        }),
      ).toThrow();
    });

    test("parses call variant with explanations and fullExplanation", () => {
      const content = parseStepContent("investigation", {
        explanations: [
          { accuracy: "best", text: "The butler did it" },
          { accuracy: "partial", text: "The maid did it" },
          { accuracy: "wrong", text: "The dog did it" },
        ],
        fullExplanation:
          "The security footage and fingerprint evidence both pointed to the butler.",
        variant: "call",
      });

      expect(content.variant).toBe("call");
    });

    test("rejects call with extra fields", () => {
      expect(() =>
        parseStepContent("investigation", {
          correctExplanationIndex: 0,
          explanations: [{ accuracy: "best", text: "Explanation." }],
          fullExplanation: "Full explanation.",
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

  describe("static investigationScore", () => {
    test("parses investigationScore variant", () => {
      const content = parseStepContent("static", {
        variant: "investigationScore",
      });

      expect(content.variant).toBe("investigationScore");
    });

    test("rejects extra fields", () => {
      expect(() =>
        parseStepContent("static", {
          extra: "field",
          variant: "investigationScore",
        }),
      ).toThrow();
    });
  });
});
