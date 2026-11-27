import { describe, expect, it } from "vitest";
import { findNextQuestion } from "./_utils/next-placement-skill";
import { type SubjectProgress, getAreaOrder } from "./focus-test-progress";
import { type PlacementEvidence } from "./placement-beliefs";
import { type PlacementItemCandidate } from "./placement-item-choice";

describe("the first Focus sitting", () => {
  it("reaches six ready subjects with six correct answers even when confirming taps are ready", () => {
    const keys = Array.from({ length: 6 }, (_, index) => String(index));

    const subjects: SubjectProgress[] = keys.map((key) => ({
      areaAnswers: [0],
      areas: [key],
      asked: 0,
      dontKnow: 0,
      key,
      minimumScore: false,
      missed: false,
      name: key,
      part: null,
      right: 0,
      share: 1,
      shortName: null,
      sittingAnswers: 0,
    }));

    const skills = keys.map((id, order) => ({
      id,
      order,
      phase: 0,
      prerequisiteIds: [],
      sectionTitle: id,
    }));

    const items: PlacementItemCandidate[] = keys.flatMap((skillId) => [
      { format: "multipleChoice", id: skillId, seen: false, skillId },
      { format: "multipleChoice", id: `more${skillId}`, seen: false, skillId },
      {
        content: { steps: ["a", "b", "c", "d"] },
        format: "order",
        id: `tap${skillId}`,
        seen: false,
        skillId,
      },
    ]);

    const evidence: PlacementEvidence[] = [];

    for (const key of keys) {
      const picked = findNextQuestion({
        choice: { areaOrder: getAreaOrder(subjects, true), evidence, skills, statuses: new Map() },
        firstSitting: true,
        items,
        preparingSkillIds: new Set(),
        quickFormat: "multipleChoice",
        waitsForExam: false,
      });

      expect(picked.item?.skillId).toBe(key);

      if (!picked.item) {
        throw new Error("Expected a ready subject");
      }

      evidence.push({
        format: "multipleChoice",
        itemId: picked.item.id,
        outcome: "correct",
        skillId: key,
      });

      const subject = subjects.find((entry) => entry.key === key);

      if (subject) {
        subject.asked += 1;
        subject.sittingAnswers += 1;
      }

      picked.item.seen = true;
    }

    expect(new Set(evidence.map((answer) => answer.skillId)).size).toBe(6);
  });
});
