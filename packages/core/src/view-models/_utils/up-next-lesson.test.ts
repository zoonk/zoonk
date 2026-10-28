import { describe, expect, it } from "vitest";
import { findUpNextLessonId } from "./up-next-lesson";

const UNIT = [
  { done: false, lessonId: "apresentacao" },
  { done: true, lessonId: "perguntas" },
  { done: true, lessonId: "pedidos" },
  { done: false, lessonId: "resumo" },
];

describe(findUpNextLessonId, () => {
  it("takes the lesson today's session opens next, as Today shows it", () => {
    expect(
      findUpNextLessonId({
        lessons: UNIT,
        planLessonIds: ["apresentacao", "resumo"],
        sessionLessonIds: ["resumo", "apresentacao"],
      }),
    ).toBe("resumo");
  });

  it("follows the plan's order when today's session doesn't reach the page", () => {
    expect(
      findUpNextLessonId({
        lessons: UNIT,
        planLessonIds: ["other-chapter", "resumo", "apresentacao"],
        sessionLessonIds: ["other-chapter"],
      }),
    ).toBe("resumo");
  });

  it("skips a lesson done since the session listed it", () => {
    expect(
      findUpNextLessonId({
        lessons: UNIT,
        planLessonIds: [],
        sessionLessonIds: ["pedidos", "apresentacao"],
      }),
    ).toBe("apresentacao");
  });

  it("takes the first lesson not done when neither the session nor the plan has one here", () => {
    expect(findUpNextLessonId({ lessons: UNIT, planLessonIds: [], sessionLessonIds: [] })).toBe(
      "apresentacao",
    );

    expect(
      findUpNextLessonId({
        lessons: UNIT.map((lesson) => ({ ...lesson, done: true })),
        planLessonIds: [],
        sessionLessonIds: [],
      }),
    ).toBeNull();
  });
});
