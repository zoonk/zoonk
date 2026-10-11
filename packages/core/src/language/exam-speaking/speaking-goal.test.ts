import { describe, expect, it } from "vitest";
import { getSpeakingExamGoal } from "./speaking-goal";

function goal({
  details = {},
  kind = "exam",
  prompt = "",
  targetLanguage,
  title,
}: {
  details?: Record<string, string>;
  kind?: "exam" | "language";
  prompt?: string;
  targetLanguage: string;
  title: string;
}) {
  return { details, kind, prompt, targetLanguage, title };
}

describe(getSpeakingExamGoal, () => {
  it("reads the exam and its level from the goal's title", () => {
    expect(
      getSpeakingExamGoal({
        fallbackLevel: "A2",
        goal: goal({ targetLanguage: "es", title: "DELE B2" }),
      }),
    ).toStrictEqual({ exam: "dele", level: "B2" });
  });

  it("reads the level from what the learner said when the title has none", () => {
    expect(
      getSpeakingExamGoal({
        fallbackLevel: "A2",
        goal: goal({
          details: { examName: "DELF", reason: "Je passe le DELF B1 en juin" },
          targetLanguage: "fr",
          title: "DELF",
        }),
      }),
    ).toStrictEqual({ exam: "delf", level: "B1" });
  });

  it("takes the target score onboarding understood when no text names a level", () => {
    expect(
      getSpeakingExamGoal({
        fallbackLevel: "A2",
        goal: goal({
          details: { examName: "Goethe-Zertifikat", targetScore: "C1" },
          targetLanguage: "de",
          title: "Goethe-Zertifikat",
        }),
      }),
    ).toStrictEqual({ exam: "goethe", level: "C1" });
  });

  it("knows Cambridge's exams by their names", () => {
    expect(
      getSpeakingExamGoal({
        fallbackLevel: "B1",
        goal: goal({
          prompt: "I'm taking Cambridge Advanced (CAE) in March",
          targetLanguage: "en",
          title: "Cambridge",
        }),
      }),
    ).toStrictEqual({ exam: "cambridge", level: "C1" });

    expect(
      getSpeakingExamGoal({
        fallbackLevel: "B1",
        goal: goal({ targetLanguage: "en", title: "FCE" }),
      }),
    ).toStrictEqual({ exam: "cambridge", level: "B2" });
  });

  it("takes the level named with the exam over the learner's own level", () => {
    expect(
      getSpeakingExamGoal({
        fallbackLevel: "A2",
        goal: goal({
          prompt: "i think i'm A2, and in november i'm taking the B2 First",
          targetLanguage: "en",
          title: "Inglês para Toronto",
        }),
      }),
    ).toStrictEqual({ exam: "cambridge", level: "B2" });

    expect(
      getSpeakingExamGoal({
        fallbackLevel: "A2",
        goal: goal({
          details: { targetLevel: "B2" },
          prompt: "Quero fazer o DELE, acho que sou A2",
          targetLanguage: "es",
          title: "Espanhol",
        }),
      }),
    ).toStrictEqual({ exam: "dele", level: "B2" });
  });

  it("practices a language goal at the learner's own target, in the format of the exam it names", () => {
    expect(
      getSpeakingExamGoal({
        fallbackLevel: "A2",
        goal: goal({
          details: { targetScore: "B1+" },
          kind: "language",
          prompt: "Inglês para morar em Toronto, quero fazer o Cambridge B2 First um dia",
          targetLanguage: "en",
          title: "Inglês para Toronto",
        }),
      }),
    ).toStrictEqual({ exam: "cambridge", level: "B1" });
  });

  it("gives a language goal that names no exam its language's certificate at the target level", () => {
    expect(
      getSpeakingExamGoal({
        fallbackLevel: "A2",
        goal: goal({
          details: { targetLevel: "B1+" },
          kind: "language",
          prompt: "i need to speak english, moving to toronto in 6 months. my first time abroad",
          targetLanguage: "en",
          title: "Inglês para Toronto",
        }),
      }),
    ).toStrictEqual({ exam: "cambridge", level: "B1" });

    expect(
      getSpeakingExamGoal({
        fallbackLevel: "A2",
        goal: goal({
          details: { targetScore: "C1" },
          kind: "language",
          targetLanguage: "fr",
          title: "Francês para o trabalho",
        }),
      }),
    ).toStrictEqual({ exam: "delf", level: "C1" });

    expect(
      getSpeakingExamGoal({
        fallbackLevel: "B1",
        goal: goal({
          details: { targetLevel: "A1" },
          kind: "language",
          targetLanguage: "de",
          title: "Alemão",
        }),
      }),
    ).toStrictEqual({ exam: "goethe", level: "A1" });
  });

  it("practices a language goal with no target at the learner's own level, without reading levels into its words", () => {
    // "i think i'm A2" is where the learner was at onboarding; the speaking level is where they are now.
    expect(
      getSpeakingExamGoal({
        fallbackLevel: "B1",
        goal: goal({
          kind: "language",
          prompt: "espanhol para viajar, acho que sou A2",
          targetLanguage: "es",
          title: "Espanhol para viajar",
        }),
      }),
    ).toStrictEqual({ exam: "dele", level: "B1" });
  });

  it("leaves out language goals naming an exam without a paper here, and languages without one", () => {
    expect(
      getSpeakingExamGoal({
        fallbackLevel: "B1",
        goal: goal({
          details: { reason: "Vou fazer o IELTS em março", targetLevel: "B2" },
          kind: "language",
          targetLanguage: "en",
          title: "Inglês",
        }),
      }),
    ).toBeNull();

    expect(
      getSpeakingExamGoal({
        fallbackLevel: "B1",
        goal: goal({
          details: { targetLevel: "B2" },
          kind: "language",
          targetLanguage: "it",
          title: "Italiano",
        }),
      }),
    ).toBeNull();
  });

  it("takes DALF without a level as C1 and Start Deutsch as A1", () => {
    expect(
      getSpeakingExamGoal({
        fallbackLevel: "B1",
        goal: goal({ targetLanguage: "fr", title: "DALF" }),
      }),
    ).toStrictEqual({ exam: "delf", level: "C1" });

    expect(
      getSpeakingExamGoal({
        fallbackLevel: "B1",
        goal: goal({ targetLanguage: "de", title: "Goethe Start Deutsch 1" }),
      }),
    ).toStrictEqual({ exam: "goethe", level: "A1" });
  });

  it("falls back to the learner's level, kept inside the exam's levels", () => {
    expect(
      getSpeakingExamGoal({
        fallbackLevel: "B1",
        goal: goal({ targetLanguage: "es", title: "DELE" }),
      }),
    ).toStrictEqual({ exam: "dele", level: "B1" });

    // Cambridge has no A1 exam.
    expect(
      getSpeakingExamGoal({
        fallbackLevel: "A1",
        goal: goal({ targetLanguage: "en", title: "Cambridge English" }),
      }),
    ).toStrictEqual({ exam: "cambridge", level: "A2" });
  });

  it("needs an exam goal's own language and one of its exams", () => {
    expect(
      getSpeakingExamGoal({
        fallbackLevel: "B1",
        goal: goal({ targetLanguage: "en", title: "DELE B2" }),
      }),
    ).toBeNull();

    expect(
      getSpeakingExamGoal({
        fallbackLevel: "B1",
        goal: goal({ targetLanguage: "en", title: "IELTS" }),
      }),
    ).toBeNull();

    expect(
      getSpeakingExamGoal({
        fallbackLevel: "B1",
        goal: goal({ targetLanguage: "es", title: "Espanhol para viajar" }),
      }),
    ).toBeNull();
  });
});
