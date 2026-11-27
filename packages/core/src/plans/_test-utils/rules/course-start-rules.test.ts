import { expect, it } from "vitest";
import { mixCourseStartPractice } from "../../../sessions/_utils/course-start-practice";
import { type PracticeItem } from "../../../sessions/session-builder";

test.each([2, 4, 6, 10])(
  "covers the next lesson's prerequisites first, then a 30-topic skip with %i questions per weekly session",
  (room) => {
    const starts = Array.from({ length: 30 }, (_, i) => String(i));
    const prerequisites = [starts[29]!, starts[28]!];
    const done = new Set<string>();
    const studied = new Set(["current"]);
    let weeks = 0;

    while (done.size < starts.length && weeks < 31) {
      const remaining = [...new Set([...prerequisites, ...starts])].filter(
        (skill) => !done.has(skill),
      );

      const unit = (skillId: string, i: number) => ({
        questions: [{ itemId: String(i), skillId }] as PracticeItem[],
      });

      const units = [
        ...remaining.map(unit),
        ...Array.from({ length: room }, (_, i) => unit("current", 100 + i)),
      ];

      const block = mixCourseStartPractice({ courseStarts: remaining, studied, units }).slice(
        0,
        room,
      );

      const newSkills = block.filter((item) => item.skillId !== "current");
      expect(newSkills.length).toBeGreaterThanOrEqual(1);
      expect(newSkills.length).toBeLessThanOrEqual(Math.floor(room / 2));
      for (const item of newSkills) {done.add(item.skillId);}
      weeks++;
      if (weeks === 2) {expect(prerequisites.every((id) => done.has(id))).toBe(true);}
    }

    expect(done.size).toBe(30);
    expect(weeks).toBe(Math.ceil(30 / (room / 2)));
  },
);
