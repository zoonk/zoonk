import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

function answer(skills: Record<string, { after: number; chapter: number | null }>) {
  return createGenerateTextResult({ skills }) as never;
}

function find(keys: string[]) {
  return findTeachingChapters({
    chapters: CHAPTERS,
    courseTitle: "Italiano",
    language: "pt",
    level: "beginner",
    skills: keys.map((key) => skill(key)),
  });
}

describe(findTeachingChapters, () => {
  beforeEach(() => {
    vi.mocked(generateText).mockReset();
  });

  it("answers every skill in order, with a new chapter's place in the band", async () => {
    vi.mocked(generateText).mockResolvedValue(
      answer({ complain: { after: 1, chapter: null }, stay: { after: 0, chapter: 1 } }),
    );

    const { data } = await find(["stay", "complain"]);

    expect(data).toStrictEqual([
      { after: 1, chapter: 1, key: "stay" },
      { after: 1, chapter: null, key: "complain" },
    ]);

    expect(generateText).toHaveBeenCalledOnce();
  });

  it("asks again when a chapter doesn't exist, and keeps the answer that names real ones", async () => {
    vi.mocked(generateText)
      .mockResolvedValueOnce(
        answer({ call: { after: 0, chapter: 7 }, stay: { after: 9, chapter: null } }),
      )
      .mockResolvedValueOnce(
        answer({ call: { after: 2, chapter: null }, stay: { after: 0, chapter: 1 } }),
      );

    const { data } = await find(["stay", "call"]);

    expect(generateText).toHaveBeenCalledTimes(2);

    expect(data).toStrictEqual([
      { after: 1, chapter: 1, key: "stay" },
      { after: 2, chapter: null, key: "call" },
    ]);
  });

  it("fails instead of writing a chapter when no draft names a real one", async () => {
    vi.mocked(generateText).mockResolvedValue(
      answer({ call: { after: 0, chapter: 5 }, stay: { after: 0, chapter: 1 } }),
    );

    await expect(find(["stay", "call"])).rejects.toThrow(/doesn't have/u);
    expect(generateText).toHaveBeenCalledTimes(2);
  });
});
