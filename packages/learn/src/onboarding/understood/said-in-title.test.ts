import { describe, expect, it } from "vitest";
import { isSaidInTitle } from "./said-in-title";

const TITLE = "Passar no concurso da Câmara dos Deputados para registro e redação";

describe(isSaidInTitle, () => {
  it("finds a fact the title already names, whatever its accents and case", () => {
    expect(isSaidInTitle({ title: TITLE, value: "Câmara dos Deputados" })).toBe(true);
    expect(isSaidInTitle({ title: TITLE, value: "Registro e Redação" })).toBe(true);

    expect(isSaidInTitle({ title: "Speak English for a job interview", value: "english" })).toBe(
      true,
    );
  });

  it("ignores punctuation around the words", () => {
    expect(isSaidInTitle({ title: "Pass the SAT (2027)", value: "2027" })).toBe(true);
  });

  it("keeps a fact the title doesn't say, or only says inside a longer word", () => {
    expect(isSaidInTitle({ title: TITLE, value: "Analista legislativo" })).toBe(false);
    expect(isSaidInTitle({ title: "Learn web development", value: "dev" })).toBe(false);
    expect(isSaidInTitle({ title: TITLE, value: " " })).toBe(false);
  });
});
