import { generateText } from "ai";
import { describe, expect, it, vi } from "vitest";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { findTeachingChapters } from "./teaching-chapters";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));

vi.mock("./teaching-chapters.prompt.md", () => ({ default: "" }));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

const CHAPTERS = [
  { lessons: ["Disponibilidade de quartos", "Check-in"], title: "Reserva e hospedagem" },
  { lessons: ["Partes do corpo"], title: "Sintomas e pedidos de ajuda" },
];

function skill(key: string) {
  return { description: `O que ${key} pede`, key, name: `Habilidade ${key}` };
}

describe(findTeachingChapters, () => {
  it("answers every skill once, in order, sending a skill the model skipped or misplaced after the band", async () => {
    vi.mocked(generateText).mockResolvedValue(
      createGenerateTextResult({
        skills: [
          { after: 2, chapter: null, key: "complain" },
          { after: 1, chapter: 1, key: "stay" },
          { after: 9, chapter: 7, key: "call" },
          { after: 1, chapter: 2, key: "unknown" },
        ],
      }) as never,
    );

    const { data } = await findTeachingChapters({
      chapters: CHAPTERS,
      courseTitle: "Italiano",
      language: "pt",
      level: "beginner",
      skills: ["stay", "complain", "call", "travel"].map((key) => skill(key)),
    });

    expect(data).toStrictEqual([
      { after: 1, chapter: 1, key: "stay" },
      { after: 2, chapter: null, key: "complain" },
      { after: 2, chapter: null, key: "call" },
      { after: 2, chapter: null, key: "travel" },
    ]);
  });
});
