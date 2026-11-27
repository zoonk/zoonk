import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { describe, expect, it } from "vitest";
import { readSkillClaims } from "./_utils/skill-claims";
import { readWritingEvidence } from "./written-evidence";

const CRITERION = { id: "argument", name: "Argument", points: null };

async function samplesFixture() {
  const [skill, unrelated] = await Promise.all([skillFixture(), skillFixture()]);

  const makeItem = () =>
    itemFixture({
      content: {
        context: null,
        keyPoints: ["Choose and support a side"],
        question: "Make the argument.",
        rubric: [{ criterion: "Argument", description: "Make the argument", points: null }],
        sampleOutline: "Claim and support",
        writing: {
          aspects: [],
          assessedSkillIds: [skill.id],
          criteria: [CRITERION],
          grading: { criteria: [], language: null, rounding: null, zeroing: [] },
          keySource: "practiceKey",
          lines: 30,
          minimumWords: 30,
          points: null,
          taskKey: "argument",
          title: "Support the claim",
          unit: "answer",
        },
      },
      format: "essay",
      skillId: unrelated.id,
    });

  const [first, second, third] = await Promise.all([makeItem(), makeItem(), makeItem()]);

  function sample({
    block,
    day,
    rewrite = false,
    strong = true,
  }: {
    block: typeof first;
    day: number;
    rewrite?: boolean;
    strong?: boolean;
  }) {
    const localDate = new Date(Date.UTC(2026, 10, day));

    return {
      answer: {
        conditions: {
          admissionId: crypto.randomUUID(),
          estimatedLines: 20,
          origin: "block",
          timed: false,
          version: rewrite ? ("rewrite" as const) : ("firstDraft" as const),
        },
        grade: {
          criteria: [
            {
              ...CRITERION,
              comment: "Feedback",
              level: strong ? ("strong" as const) : ("partial" as const),
              quote: null,
            },
          ],
          errors: [],
          ignoredFrom: null,
          kind: "levels",
          nextStep: null,
          progress: null,
        },
        text: "My argument",
      },
      answeredAt: localDate,
      id: crypto.randomUUID(),
      itemId: block.id,
      localDate,
      prompt: { assessedSkillIds: [skill.id] },
    };
  }

  return { first, sample, second, skill, third, wanted: new Set([skill.id, unrelated.id]) };
}

describe("written evidence", () => {
  it("provisionally skips on a strong answer and confirms only a fresh independent later-day sample", async () => {
    const { first, sample, second, skill, third, wanted } = await samplesFixture();
    const initial = sample({ block: first, day: 20 });

    const ignored = [
      sample({ block: second, day: 20 }),
      sample({ block: first, day: 21 }),
      sample({ block: third, day: 21, rewrite: true }),
    ];

    const provisional = readWritingEvidence([initial, ...ignored], wanted);
    expect(readSkillClaims(provisional)).toStrictEqual(new Map([[skill.id, "toConfirm"]]));

    const confirm = sample({ block: third, day: 22 });

    expect(
      readSkillClaims(readWritingEvidence([initial, ...ignored, confirm], wanted)),
    ).toStrictEqual(new Map([[skill.id, "confirmed"]]));

    const reopen = sample({ block: third, day: 22, strong: false });

    expect(
      readSkillClaims(readWritingEvidence([initial, ...ignored, reopen], wanted)),
    ).toStrictEqual(new Map([[skill.id, "gap"]]));
  });
});
