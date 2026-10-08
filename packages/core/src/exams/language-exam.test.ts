import { describe, expect, it } from "vitest";
import { detectLanguageExam, getSpeakingMockExam } from "./language-exam";

describe(detectLanguageExam, () => {
  it.each([
    ["vou fazer o IELTS em março", "IELTS"],
    ["I need the TOEFL for grad school", "TOEFL"],
    ["preciso do TOEFL ITP da faculdade", "TOEFL ITP"],
    ["prepararme para el DELE B2", "DELE"],
    ["passer le DELF", "DELF"],
    ["Celpe-Bras para trabalhar no Brasil", "Celpe-Bras"],
  ])("finds the certificate in %s", (reason, exam) => {
    expect(detectLanguageExam(reason)).toBe(exam);
  });

  it("finds nothing in a reason without an exam", () => {
    expect(detectLanguageExam("to travel to Toronto and talk to people")).toBeNull();
    expect(detectLanguageExam("delete my old habits")).toBeNull();
  });
});

describe(getSpeakingMockExam, () => {
  const englishGoal = {
    details: {},
    prompt: "Quero falar inglês melhor",
    targetLanguage: "en",
    title: "Inglês para o trabalho",
  };

  it.each([
    [{ title: "IELTS" }, "ielts"],
    [{ title: "TOEFL" }, "toefl"],
    [{ prompt: "I need the TOEFL iBT for grad school" }, "toefl"],
    [{ details: { reason: "vou fazer o toefl em março" } }, "toefl"],
    [{ details: { examName: "IELTS Academic" } }, "ielts"],
  ])("finds the speaking mock's exam in %o", (goal, exam) => {
    expect(getSpeakingMockExam({ ...englishGoal, ...goal })).toBe(exam);
  });

  it("offers none for TOEFL tests with other formats", () => {
    for (const title of ["TOEFL ITP", "TOEFL Essentials", "TOEFL Junior", "toefl-primary"]) {
      expect(getSpeakingMockExam({ ...englishGoal, prompt: "the TOEFL", title })).toBeNull();
    }
  });

  it("lets the first certificate named decide", () => {
    expect(
      getSpeakingMockExam({ ...englishGoal, details: { reason: "IELTS" }, title: "TOEFL" }),
    ).toBe("toefl");

    expect(
      getSpeakingMockExam({ ...englishGoal, prompt: "or the IELTS", title: "TOEIC" }),
    ).toBeNull();
  });

  it("offers none without an exam with a speaking mock or outside English", () => {
    expect(getSpeakingMockExam(englishGoal)).toBeNull();

    expect(
      getSpeakingMockExam({ ...englishGoal, targetLanguage: "es", title: "TOEFL" }),
    ).toBeNull();

    expect(getSpeakingMockExam({ ...englishGoal, title: "DELE B2" })).toBeNull();
  });
});
