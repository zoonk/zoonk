import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { generateCourseDetails, getCourseDetailsPromptVersion } from "./course-details";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));
vi.mock("./course-details.prompt.md", () => ({ default: "Categories: {{CATEGORIES}}" }));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

const chapters = [
  { description: "How antibodies find germs", level: "overview", title: "Antibodies" },
];

describe(generateCourseDetails, () => {
  beforeEach(() => {
    vi.mocked(generateText).mockResolvedValue(
      createGenerateTextResult({
        audience: [" Parents deciding on vaccines ", "parents deciding on vaccines", ""],
        categories: ["health", "science", "health", "society"],
        description: " Immunology is how the body tells friend from foe. ",
        outcomes: ["Explain how a vaccine trains memory cells", "", "Read a vaccine leaflet"],
        valueProposition: " Make sense of vaccine news. ",
      }),
    );
  });

  it("keeps the page's lists short, clean and free of repeats, with at most two categories", async () => {
    const { data } = await generateCourseDetails({
      chapters,
      courseTitle: "Immunology",
      language: "en",
    });

    expect(data).toStrictEqual({
      categories: ["health", "science"],
      description: "Immunology is how the body tells friend from foe.",
      landingPage: {
        audience: ["Parents deciding on vaccines"],
        outcomes: ["Explain how a vaccine trains memory cells", "Read a vaccine leaflet"],
        valueProposition: "Make sense of vaccine news.",
      },
    });
  });

  it("never offers the model the categories language and exam courses get from what they are", async () => {
    const { systemPrompt, userPrompt } = await generateCourseDetails({
      chapters,
      courseTitle: "Espanhol",
      language: "pt",
      targetLanguage: "es",
    });

    expect(systemPrompt).toContain("health");
    expect(systemPrompt).not.toContain("languages");
    expect(systemPrompt).not.toContain("exams");
    expect(userPrompt).toContain("TARGET_LANGUAGE: Español de España");
    expect(userPrompt).toContain("- [overview] Antibodies: How antibodies find germs");
  });

  it("asks each language for the verb form its course pages list outcomes in", async () => {
    const forms = await Promise.all(
      ["en", "pt-BR", "de"].map(async (language) => {
        const { userPrompt } = await generateCourseDetails({
          chapters,
          courseTitle: "Immunology",
          language,
        });

        return /VERB_FORM: (?<form>.+)/u.exec(userPrompt)?.groups?.form;
      }),
    );

    expect(forms).toStrictEqual([
      "the verb's base form at the start",
      "the infinitive at the start",
      "an infinitive phrase with the verb at the end, as German learning goals are written",
    ]);
  });

  it("records the deployed selection version across languages while varying per-call input", async () => {
    const results = await Promise.all(
      ["en", "pt", "es", "fr"].map((language) =>
        generateCourseDetails({ chapters, courseTitle: "Immunology", language }),
      ),
    );

    expect(results.map((result) => result.provenance.promptVersion)).toStrictEqual(
      Array.from({ length: 4 }, () => getCourseDetailsPromptVersion()),
    );

    expect(new Set(results.map((result) => result.systemPrompt)).size).toBe(1);
    expect(new Set(results.map((result) => result.userPrompt)).size).toBe(4);
  });
});
