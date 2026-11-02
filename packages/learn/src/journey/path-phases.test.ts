import { describe, expect, it } from "vitest";
import { findOpenPhase, findOwnChapter, isNamedLikeAChapter } from "./path-phases";

function chapter(
  title: string,
  overrides: Partial<{
    chapterId: string | null;
    far: boolean;
    state: "current" | "done" | "upcoming";
    writing: boolean;
  }> = {},
) {
  return {
    chapterId: `id-${title}`,
    far: false,
    state: "upcoming" as const,
    title,
    writing: false,
    ...overrides,
  };
}

describe(findOwnChapter, () => {
  it("opens a phase that is one chapter named like it straight to that chapter", () => {
    const unit = chapter("Renting an apartment", { state: "current" });

    expect(
      findOwnChapter({ name: "Renting an apartment", phase: { chapters: [unit] } }),
    ).toStrictEqual(unit);
  });

  it("leaves lessons still being written out, so the unit stays one row", () => {
    const unit = chapter("Renting an apartment");
    const writing = chapter("More lessons", { chapterId: null, writing: true });

    expect(
      findOwnChapter({ name: "Renting an apartment", phase: { chapters: [unit, writing] } }),
    ).toStrictEqual(unit);
  });

  it("matches the chapter's title without case, accents or extra spaces", () => {
    const unit = chapter("Alugando um apartamento");

    expect(
      findOwnChapter({ name: "alugando um  Apartamento", phase: { chapters: [unit] } }),
    ).toStrictEqual(unit);
  });

  it("keeps a phase of several chapters as a phase", () => {
    const chapters = [chapter("Inside the atom"), chapter("Ions")];

    expect(findOwnChapter({ name: "Inside the atom", phase: { chapters } })).toBeNull();
  });

  it("keeps a phase whose one chapter has another name as a phase", () => {
    expect(
      findOwnChapter({ name: "Foundations", phase: { chapters: [chapter("Inside the atom")] } }),
    ).toBeNull();
  });

  it("keeps a phase whose one chapter has no page yet as a phase", () => {
    const later = chapter("Inside the atom", { chapterId: null, far: true, writing: true });

    expect(findOwnChapter({ name: "Inside the atom", phase: { chapters: [later] } })).toBeNull();
  });
});

describe(isNamedLikeAChapter, () => {
  it("names a phase by its place when one of its chapters has its name", () => {
    const chapters = [chapter("Renting an apartment"), chapter("Paying the rent")];

    expect(isNamedLikeAChapter({ name: "Renting an apartment", phase: { chapters } })).toBe(true);
  });

  it("finds the chapter's name in other case, accents or spacing", () => {
    const chapters = [chapter("Banco e Celular"), chapter("Dentro do átomo")];

    expect(isNamedLikeAChapter({ name: "Banco e celular", phase: { chapters } })).toBe(true);
    expect(isNamedLikeAChapter({ name: "Dentro do  atomo", phase: { chapters } })).toBe(true);
  });

  it("keeps the name of a phase whose chapters are named otherwise", () => {
    const chapters = [chapter("Vectors"), chapter("Derivatives")];

    expect(isNamedLikeAChapter({ name: "The math physics uses", phase: { chapters } })).toBe(false);
  });
});

describe(findOpenPhase, () => {
  it("opens the phase holding the plan's next chapter", () => {
    const phases = [
      { chapters: [chapter("A", { state: "done" })], index: 0, state: "done" as const },
      { chapters: [chapter("B", { state: "current" })], index: 1, state: "current" as const },
      { chapters: [chapter("C")], index: 2, state: "upcoming" as const },
    ];

    expect(findOpenPhase(phases)).toBe(1);
  });

  it("opens the later phase with the next chapter while the current one waits for its challenge", () => {
    const phases = [
      { chapters: [chapter("A", { state: "done" })], index: 0, state: "current" as const },
      { chapters: [chapter("B", { state: "current" })], index: 1, state: "upcoming" as const },
    ];

    expect(findOpenPhase(phases)).toBe(1);
  });

  it("opens the current phase when no chapter is next", () => {
    const phases = [
      { chapters: [chapter("A", { state: "done" })], index: 0, state: "done" as const },
      { chapters: [], index: 1, state: "current" as const },
    ];

    expect(findOpenPhase(phases)).toBe(1);
  });

  it("opens nothing once the plan is over", () => {
    expect(
      findOpenPhase([
        { chapters: [chapter("A", { state: "done" })], index: 0, state: "done" as const },
      ]),
    ).toBeNull();
  });
});
