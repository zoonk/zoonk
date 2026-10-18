import { prisma } from "@zoonk/db";
import { listeningGoalFixture } from "@zoonk/testing/fixtures/listening";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { describe, expect, it } from "vitest";
import { readBlueprintContent } from "../library/exams/save-exam-blueprint";
import { pickExamFormatSkills } from "./exam-format-skills";
import { pickItemSetTargets } from "./item-set-targets";
import { pickPlacementItemSkills } from "./placement-item-skills";
import { getShortPlanPracticeNeed } from "./short-plan-practice";

const citation = { passage: "…", sourceId: "notice" };

/**
 * A language certificate whose Listening area's skills are practiced only with recordings, with a
 * second Reading skill so its area could take a text set, and a "select all" format.
 */
async function listeningCertificate() {
  const [fixture, detail] = await Promise.all([
    listeningGoalFixture(),
    skillFixture({ name: "Read for detail" }),
  ]);

  const { blueprint, graph, plan, reading } = fixture;
  const { structure } = readBlueprintContent(blueprint);

  const secondReading = {
    area: "Reading",
    lessons: 2,
    name: detail.name,
    phase: 0,
    skillId: detail.id,
    weight: null,
  };

  await Promise.all([
    prisma.plan.update({
      data: { graph: { ...graph, skills: [...graph.skills, secondReading] } },
      where: { id: plan.id },
    }),
    prisma.examBlueprint.update({
      data: {
        structure: {
          ...structure,
          formats: [
            {
              citation,
              description: "Choose all the right answers.",
              kind: "multipleChoice",
              options: 5,
              select: "all",
            },
          ],
        },
      },
      where: { id: blueprint.id },
    }),
  ]);

  return { ...fixture, readingIds: [reading.id, detail.id] };
}

describe("item writers on a listening exam", () => {
  it("write no text questions for a Listening area's skills, which only recordings practice", async () => {
    const { goal, listeningSkills, readingIds } = await listeningCertificate();
    const allSkillIds = [...listeningSkills.map((skill) => skill.id), ...readingIds];

    const [placement, formats, sets] = await Promise.all([
      pickPlacementItemSkills({ goalId: goal.id, skillIds: allSkillIds }),
      pickExamFormatSkills({ goalId: goal.id }),
      pickItemSetTargets({ goalId: goal.id }),
    ]);

    expect(placement.skills.map((skill) => skill.id).toSorted()).toStrictEqual(
      readingIds.toSorted(),
    );

    expect(formats.map((pick) => pick.skill.id).toSorted()).toStrictEqual(readingIds.toSorted());

    expect(sets.map((target) => target.skills.map((skill) => skill.id).toSorted())).toStrictEqual([
      readingIds.toSorted(),
    ]);
  });

  it("sizes a certificate days away to its text skills only", async () => {
    const { goal, readingIds } = await listeningCertificate();
    const inThreeDays = new Date(Date.now() + 3 * 86_400_000);

    await prisma.goal.update({
      data: { dailyMinutes: 30, targetDate: inThreeDays, timezone: "UTC" },
      where: { id: goal.id },
    });

    const need = await getShortPlanPracticeNeed(goal.id);
    expect(need?.skillIds.toSorted()).toStrictEqual(readingIds.toSorted());
  });
});
