import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { generateCourseDetails } from "./course-details";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));

vi.mock("./course-details.prompt.md", () => ({
  default:
    "Categories: {{CATEGORIES}}\nWrite in {{LEARNER_LANGUAGE}}.{{#languageCourse}} Teach {{TARGET_LANGUAGE}}.{{/languageCourse}}",
}));

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
        audience: [" Parents deciding on vaccines. ", "parents deciding on vaccines", ""],
        categories: ["health", "science", "health", "society"],
        description: " Immunology is how the body tells friend from foe. ",
        outcomes: [
          "Read a vaccine leaflet.",
          "",
          "Tell a cold from the flu",
          "Explain how a vaccine trains memory cells",
          "Spot a misleading vaccine headline",
          "Explain why outbreaks stop",
        ],
        valueProposition: " Make sense of vaccine news. ",
      }),
    );
  });

  it("keeps the page's lists to their size, as phrases free of repeats, with at most two categories", async () => {
    const { data } = await generateCourseDetails({
      chapters,
      country: null,
      courseTitle: "Immunology",
      language: "en",
    });

    expect(data).toStrictEqual({
      categories: ["health", "science"],
      description: "Immunology is how the body tells friend from foe.",
      landingPage: {
        audience: ["Parents deciding on vaccines"],
        outcomes: [
          "Read a vaccine leaflet",
          "Tell a cold from the flu",
          "Explain how a vaccine trains memory cells",
          "Spot a misleading vaccine headline",
        ],
        valueProposition: "Make sense of vaccine news.",
      },
    });
  });

  it("never offers the model the categories language and exam courses get from what they are", async () => {
    const { systemPrompt, userPrompt } = await generateCourseDetails({
      chapters,
      country: null,
      courseTitle: "Espanhol",
      language: "pt",
      targetLanguage: "es",
    });

    expect(systemPrompt).toContain("health");
    expect(systemPrompt).not.toContain("languages");
    expect(systemPrompt).not.toContain("exams");
    expect(systemPrompt).toContain("Write in Português Brasileiro. Teach Español de México.");
    expect(userPrompt).toContain("TARGET_LANGUAGE: Español de México");
    expect(userPrompt).toContain("- [overview] Antibodies: How antibodies find germs");
  });

  it("asks each language for the verb form its course pages list outcomes in", async () => {
    const forms = await Promise.all(
      ["en", "pt-BR", "de"].map(async (language) => {
        const { userPrompt } = await generateCourseDetails({
          chapters,
          country: null,
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

  it("names each reader's language in the instructions, and no practiced language outside a language course", async () => {
    const results = await Promise.all(
      ["en", "pt", "es", "fr"].map((language) =>
        generateCourseDetails({ chapters, country: null, courseTitle: "Immunology", language }),
      ),
    );

    expect(results.map((result) => result.systemPrompt.split("\n").at(-1))).toStrictEqual([
      "Write in US English.",
      "Write in Português Brasileiro.",
      "Write in Español de México.",
      "Write in Français.",
    ]);
  });
});
