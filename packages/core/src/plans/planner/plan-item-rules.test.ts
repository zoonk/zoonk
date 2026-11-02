import { describe, expect, it } from "vitest";
import {
  hasUnwrittenSkill,
  isStandIn,
  isStandInUnit,
  isUnwrittenLesson,
  isWritingItem,
} from "./plan-item-rules";

const standIn = { chapterId: null, kind: "lesson" as const, lessonId: null, skillId: "skill" };

describe("unwritten plan work", () => {
  it("reserves a skill stand-in only before it has a chapter or lesson", () => {
    const contentlessChapter = { ...standIn, kind: "chapter" as const };

    expect(isStandIn(standIn)).toBe(true);
    expect(isStandIn({ ...standIn, lessonId: "lesson" })).toBe(false);
    expect(isStandIn({ ...standIn, chapterId: "chapter" })).toBe(false);
    expect(isStandIn({ ...standIn, skillId: null })).toBe(false);
    expect(isStandIn({ ...standIn, kind: "boss" })).toBe(false);
    expect(hasUnwrittenSkill(contentlessChapter)).toBe(true);
  });

  it("keeps an unwritten lesson distinct from a skill stand-in", () => {
    const chapterLesson = { ...standIn, chapterId: "chapter" };
    const withoutSkill = { ...standIn, skillId: null };

    expect(isUnwrittenLesson(chapterLesson)).toBe(true);
    expect(isStandInUnit(chapterLesson)).toBe(true);
    expect(isWritingItem(chapterLesson)).toBe(false);
    expect(isWritingItem(withoutSkill)).toBe(true);
    expect(isStandIn(withoutSkill)).toBe(false);
    expect(isUnwrittenLesson({ ...standIn, kind: "chapter" })).toBe(false);
    expect(isUnwrittenLesson({ ...standIn, lessonId: "lesson" })).toBe(false);
  });
});
