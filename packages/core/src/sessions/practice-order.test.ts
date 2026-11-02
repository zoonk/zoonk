import { learnerSkillFixture, mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { type AreaShare } from "../plans/_utils/exam-subject-shares";
import { loadPracticeItems } from "./_utils/load-practice";

const NOW = new Date("2026-10-18T12:00:00Z");

async function studiedSkillsFixture({
  questions,
  stabilities,
}: {
  questions: number | number[];
  stabilities: number[];
}) {
  const user = await userFixture();
  const skills = await Promise.all(stabilities.map(() => skillFixture()));

  const items = await Promise.all(
    skills.flatMap((skill, index) =>
      Array.from({ length: Array.isArray(questions) ? (questions[index] ?? 0) : questions }, () =>
        itemFixture({ skillId: skill.id }),
      ),
    ),
  );

  await Promise.all(
    skills.map((skill, index) =>
      learnerSkillFixture({
        difficulty: 5,
        lastReviewedAt: new Date("2026-10-14T12:00:00Z"),
        reps: 3,
        skillId: skill.id,
        stability: stabilities[index] ?? 10,
        userId: user.id,
      }),
    ),
  );

  return { items, skills, user };
}

function loadPractice({
  maxMinutes,
  skillIds,
  skillAreaShares,
  userId,
}: {
  maxMinutes: number;
  skillIds: string[];
  skillAreaShares?: Map<string, AreaShare>;
  userId: string;
}) {
  return loadPracticeItems({
    difficultyBias: "standard",
    examBlueprintId: null,
    excludeItemIds: new Set(),
    field: null,
    maxMinutes,
    now: NOW,
    skillAreaShares,
    skillIds,
    typed: false,
    userId,
  });
}

function countBySkill(practice: { skillId: string }[], skillId: string | undefined): number {
  return practice.filter((item) => item.skillId === skillId).length;
}

describe(loadPracticeItems, () => {
  it("keeps the caller's skill order when studied skills have the same recall risk", async () => {
    const { items, skills, user } = await studiedSkillsFixture({
      questions: 1,
      stabilities: [10, 10, 10],
    });

    const load = (skillIds: string[]) =>
      loadPractice({ maxMinutes: 45, skillIds, userId: user.id });

    const [forward, reversed] = await Promise.all([
      load(skills.map((skill) => skill.id)),
      load(skills.toReversed().map((skill) => skill.id)),
    ]);

    expect(forward.map((item) => item.itemId)).toStrictEqual(items.map((item) => item.id));

    expect(reversed.map((item) => item.itemId)).toStrictEqual(
      items.toReversed().map((item) => item.id),
    );
  });

  it("asks as many questions as the time holds, not a fixed number", async () => {
    const { skills, user } = await studiedSkillsFixture({ questions: 30, stabilities: [10, 10] });
    const skillIds = skills.map((skill) => skill.id);

    const [long, short] = await Promise.all([
      loadPractice({ maxMinutes: 75, skillIds, userId: user.id }),
      loadPractice({ maxMinutes: 12, skillIds, userId: user.id }),
    ]);

    expect(long).toHaveLength(50);
    expect(short).toHaveLength(8);
  });

  it("gives a topic worth more of the exam more of the questions", async () => {
    const { skills, user } = await studiedSkillsFixture({ questions: 20, stabilities: [10, 10] });
    const [light, heavy] = skills.map((skill) => skill.id);

    const practice = await loadPractice({
      maxMinutes: 18,
      skillAreaShares: new Map([
        [light ?? "", { area: "Light", share: 0.2 }],
        [heavy ?? "", { area: "Heavy", share: 0.6 }],
      ]),
      skillIds: [light ?? "", heavy ?? ""],
      userId: user.id,
    });

    expect(practice[0]?.skillId).toBe(heavy);
    expect(countBySkill(practice, heavy)).toBe(3 * countBySkill(practice, light));
  });

  it("gives the topic the learner is more likely to miss now more of the questions", async () => {
    const { skills, user } = await studiedSkillsFixture({ questions: 20, stabilities: [100, 1] });
    const [known, fading] = skills.map((skill) => skill.id);

    const practice = await loadPractice({
      maxMinutes: 18,
      skillIds: [known ?? "", fading ?? ""],
      userId: user.id,
    });

    expect(practice[0]?.skillId).toBe(fading);
    expect(countBySkill(practice, fading)).toBeGreaterThan(3 * countBySkill(practice, known));
  });

  it("treats a topic with an unfixed mistake as one the learner doesn't know yet", async () => {
    const { skills, user } = await studiedSkillsFixture({ questions: 20, stabilities: [10, 10] });
    const [steady, missed] = skills.map((skill) => skill.id);

    await mistakeFixture({ skillId: missed, userId: user.id });

    const practice = await loadPractice({
      maxMinutes: 18,
      skillIds: [steady ?? "", missed ?? ""],
      userId: user.id,
    });

    expect(practice[0]?.skillId).toBe(missed);
    expect(countBySkill(practice, missed)).toBeGreaterThan(3 * countBySkill(practice, steady));
  });

  it("splits an area's share among the topics it can practice now, so a sparse bank doesn't shrink it", async () => {
    const { skills, user } = await studiedSkillsFixture({
      questions: [20, 20, 20, 20, 0, 0, 0, 0, 0, 0],
      stabilities: Array.from({ length: 10 }, () => 10),
    });

    const [alone, ...crowded] = skills.map((skill) => skill.id);
    const area = (skillId: string | undefined) => (skillId === alone ? "A" : "B");

    const practice = await loadPractice({
      maxMinutes: 36,
      skillAreaShares: new Map(
        skills.map((skill) => [skill.id, { area: area(skill.id), share: 0.5 }]),
      ),
      skillIds: skills.map((skill) => skill.id),
      userId: user.id,
    });

    expect(practice).toHaveLength(24);
    expect(countBySkill(practice, alone)).toBe(12);
    expect(crowded.reduce((sum, skillId) => sum + countBySkill(practice, skillId), 0)).toBe(12);
  });
});
