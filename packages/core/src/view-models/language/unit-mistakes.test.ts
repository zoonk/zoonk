import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { lessonSkillFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getLanguageUnitView } from "./get-language-unit-view";
import { LANGUAGE_MISTAKE_SKILLS } from "./language-view-contract";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

const snapshot = (format: string, question: string) => ({ answer: "x", format, question });

describe("a language unit's mistakes", () => {
  it("are every open mistake on its lessons and skills, each under one of its filters", async () => {
    const { arriving, lessons, renting, user } = await languageGoalFixture();
    mockSession(user.id);
    const [arrivingLesson, , rentingLesson] = lessons;

    const [rentingSkill, arrivingSkill] = await Promise.all([skillFixture(), skillFixture()]);

    const [typed, reading, review, elsewhere] = await Promise.all([
      libraryStepFixture({ kind: "typedAnswer", lessonId: rentingLesson?.id ?? "", position: 0 }),
      libraryStepFixture({ kind: "reading", lessonId: rentingLesson?.id ?? "", position: 1 }),
      itemFixture({ skillId: rentingSkill.id }),
      libraryStepFixture({ kind: "listening", lessonId: arrivingLesson?.id ?? "" }),
      lessonSkillFixture({ lessonId: rentingLesson?.id ?? "", skillId: rentingSkill.id }),
      lessonSkillFixture({ lessonId: arrivingLesson?.id ?? "", skillId: arrivingSkill.id }),
    ]);

    await Promise.all([
      mistakeFixture({
        snapshot: snapshot("typedAnswer", "In a lesson"),
        stepId: typed.id,
        userId: user.id,
      }),
      mistakeFixture({
        snapshot: snapshot("reading", "About a text"),
        stepId: reading.id,
        userId: user.id,
      }),
      // A review question on the unit's skill: no lesson screen behind it.
      mistakeFixture({
        itemId: review.id,
        skillId: rentingSkill.id,
        snapshot: snapshot("multipleChoice", "In a review"),
        userId: user.id,
      }),
      mistakeFixture({
        snapshot: snapshot("listening", "Another unit"),
        stepId: elsewhere.id,
        userId: user.id,
      }),
      mistakeFixture({
        skillId: arrivingSkill.id,
        snapshot: snapshot("multipleChoice", "Another unit's review"),
        userId: user.id,
      }),
      mistakeFixture({
        skillId: rentingSkill.id,
        snapshot: snapshot("typed", "Fixed already"),
        status: "fixed",
        userId: user.id,
      }),
    ]);

    const result = await getLanguageUnitView({ chapterId: renting.id });
    const mistakes = result.status === "ready" ? result.unit.mistakes : [];

    expect(mistakes.map((mistake) => mistake.question).toSorted()).toStrictEqual([
      "About a text",
      "In a lesson",
      "In a review",
    ]);

    expect(
      Object.fromEntries(mistakes.map((mistake) => [mistake.question, mistake.skill])),
    ).toStrictEqual({ "About a text": "words", "In a lesson": "writing", "In a review": "words" });

    const byFilter = LANGUAGE_MISTAKE_SKILLS.map(
      (skill) => mistakes.filter((mistake) => mistake.skill === skill).length,
    );

    expect(byFilter.reduce((total, count) => total + count, 0)).toBe(mistakes.length);

    const other = await getLanguageUnitView({ chapterId: arriving.id });

    expect(
      other.status === "ready" && other.unit.mistakes.map((mistake) => mistake.question).toSorted(),
    ).toStrictEqual(["Another unit", "Another unit's review"]);
  });
});
