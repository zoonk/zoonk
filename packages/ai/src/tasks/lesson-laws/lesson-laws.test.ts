import { generateText } from "ai";
import { describe, expect, it, vi } from "vitest";
import { readGatewayOptions } from "../_test-utils/gateway-options";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { type LessonLaw, generateLessonLaws, toArticleNumber } from "./lesson-laws";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));
vi.mock("./lesson-laws.prompt.md", () => ({ default: "Name the laws." }));
vi.mock("../research/research-plan.prompt.md", () => ({ default: "Plan the research." }));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

const LESSON = {
  chapterTitle: "Direitos e garantias fundamentais",
  courseTitle: "Direito Constitucional",
  isPrivate: false,
  language: "pt",
  lessonDescription: "Quando cabem habeas corpus e mandado de segurança.",
  lessonTitle: "Remédios constitucionais",
  skills: ["Distinguir habeas corpus de mandado de segurança"],
};

function law(name: string, articles: string[]): LessonLaw {
  return {
    articles,
    country: "BR",
    language: "pt",
    name,
    officialDomains: ["planalto.gov.br"],
    queries: [],
    searchTerms: [],
  };
}

describe(toArticleNumber, () => {
  it.each([
    ["4", "4"],
    ["Art. 5º, LXVIII", "5"],
    ["art. 12, § 1º", "12"],
    ["Artigo 1.º", "1"],
    ["Artículo 24", "24"],
    ["§ 622", "622"],
    ["s. 13", "13"],
    ["Section 4", "4"],
    ["§ 107.51", "107.51"],
    ["5-A", "5-A"],
  ])("reads %j as article %j", (hint, number) => {
    expect(toArticleNumber(hint)).toBe(number);
  });
});

describe(generateLessonLaws, () => {
  it("merges a law named twice and keeps the 3 most central", async () => {
    vi.mocked(generateText).mockResolvedValue(
      createGenerateTextResult({
        laws: [
          law("Constituição Federal de 1988", ["Art. 5º, LXVIII", "5º, LXIX"]),
          law("Lei nº 12.016/2009", ["1"]),
          law("constituição federal de 1988", ["102"]),
          law("Lei nº 9.507/1997", ["7"]),
          law("Lei nº 13.300/2016", ["2"]),
        ],
      }),
    );

    const { data } = await generateLessonLaws(LESSON);

    expect(data.laws.map(({ articles, name }) => ({ articles, name }))).toStrictEqual([
      { articles: ["5", "102"], name: "Constituição Federal de 1988" },
      { articles: ["1"], name: "Lei nº 12.016/2009" },
      { articles: ["7"], name: "Lei nº 9.507/1997" },
    ]);
  });

  it("keeps a private lesson's titles away from providers that train on prompts", async () => {
    const options: unknown[] = [];

    vi.mocked(generateText).mockImplementation(async () => {
      options.push(await readGatewayOptions());
      return createGenerateTextResult({ laws: [] });
    });

    const analytics = { contentScope: "shared" as const };

    await generateLessonLaws({ ...LESSON, analytics });
    await generateLessonLaws({ ...LESSON, analytics, isPrivate: true });

    expect(options).toStrictEqual([undefined, { disallowPromptTraining: true }]);
  });
});
