import { prisma } from "@zoonk/db";
import { attemptFixture, learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture, skillPrerequisiteFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { learnerGoalFixture } from "../learner/_test-utils/learner-goal";
import { loadPlacementPlan } from "../learner/_utils/goal-skill-graph";
import { mergeSkillForAdmin } from "../library/skills/merge-skill";
import { getSession } from "../users/get-session";
import { getSyllabusView } from "../view-models/syllabus/get-syllabus-view";
import { getGoalPreparation } from "./get-goal-preparation";

describe("preparation after taking a subject out", () => {
  it.each(["direct", "expanded", "merged", "phaseArea"])(
    "drops removed skills (%s) but keeps subjects still tested",
    async (source) => {
      const user = await userFixture();

      const { goal, plan, planItems, skills } = await learnerGoalFixture({
        phases: [1, 1, 1, 1, 1],
        userId: user.id,
      });

      const subjects = ["Removed", "Kept", "No time", "Past basics", "Skipped base"];

      const [advanced, finer, lesson] = await Promise.all([
        skillFixture(),
        skillFixture(),
        libraryLessonFixture(),
      ]);

      const removed = skills[0]!;
      const now = new Date();
      mockSession(user.id);

      await Promise.all([
        skillPrerequisiteFixture({ prerequisiteId: skills[3]!.id, skillId: advanced.id }),
        prisma.goal.update({ data: { kind: "exam", timezone: "UTC" }, where: { id: goal.id } }),
        prisma.plan.update({
          data: {
            graph: {
              phases: subjects.map((name) => ({ name })),
              skills: [
                ...skills.map((skill, phase) => ({
                  area: source === "phaseArea" && phase === 0 ? undefined : subjects[phase],
                  lessons: 1,
                  name: skill.name,
                  phase,
                  skillId: skill.id,
                  topics: [skill.name],
                })),
                {
                  area: "Past basics",
                  lessons: 1,
                  name: advanced.name,
                  phase: 4,
                  skillId: advanced.id,
                  topics: [advanced.name],
                },
              ],
            },
            settings: {
              baseChoices: [{ choice: "skip", skillId: skills[4]!.id }],
              pastBasicsAreas: ["Past basics"],
              skippedAreas: ["Removed"],
            },
          },
          where: { id: plan.id },
        }),
        prisma.planItem.deleteMany({
          where: { id: { in: planItems.slice(2).map((item) => item.id) } },
        }),
        prisma.planItem.update({
          data: {
            completedAt: now,
            lessonId: lesson.id,
            skillId: source === "direct" ? removed.id : null,
            status: "done",
          },
          where: { id: planItems[0]!.id },
        }),
        ...[removed, finer].flatMap((skill) => [
          lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
          attemptFixture({ answeredAt: now, skillId: skill.id, userId: user.id }),
          learnerSkillFixture({
            lastReviewedAt: now,
            reps: 3,
            skillId: skill.id,
            stability: 100,
            state: "learning",
            userId: user.id,
          }),
        ]),
      ]);

      if (source === "merged") {
        const admin = await userFixture({ role: "admin" });
        const survivor = await skillFixture();

        vi.mocked(getSession).mockResolvedValue(
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The merge reads only the admin identity and role.
          { user: { id: admin.id, role: "admin" } } as Awaited<ReturnType<typeof getSession>>,
        );

        const merged = await mergeSkillForAdmin({
          duplicateId: removed.id,
          survivorId: survivor.id,
        });

        if (merged.status !== "merged") {
          throw new Error(`Expected fixture merge, got ${merged.status}`);
        }

        mockSession(user.id);
      }

      const result = await getGoalPreparation(goal.id);
      expect(result.status).toBe("ready");

      if (result.status !== "ready") {
        throw new Error("Expected owned preparation");
      }

      expect(result.preparation.components.coverage).toMatchObject({
        studiedSkills: 0,
        totalSkills: 5,
      });

      expect(result.preparation.skills.total).toBe(5);
      expect(result.preparation.value).toBe(0);

      expect(
        result.preparation.sections.map((section) => section.section).toSorted(),
      ).toStrictEqual(subjects.slice(1).toSorted());

      const syllabus = await getSyllabusView({ goalId: goal.id });
      expect(syllabus.status).toBe("ready");

      if (syllabus.status !== "ready") {
        throw new Error("Expected owned syllabus");
      }

      expect(
        syllabus.syllabus.subjects.find((subject) => subject.name === "Removed"),
      ).toMatchObject({ notPlannedReason: "skipped", preparation: null });

      expect(
        syllabus.syllabus.subjects.find((subject) => subject.name === "No time"),
      ).toMatchObject({ notPlannedReason: "time", preparation: 0 });

      const pastBasics = syllabus.syllabus.subjects.find(
        (subject) => subject.name === "Past basics",
      );

      // A foundation with later work in the same subject: these basics are still tested.
      const placement = await loadPlacementPlan(goal.id);
      expect(placement.skills.find((skill) => skill.id === skills[3]!.id)?.foundation).toBe(true);

      expect(pastBasics?.preparation).toBe(0);

      expect(
        syllabus.syllabus.subjects
          .filter((subject) => subject.name !== "Removed")
          .every((subject) => subject.preparation === 0),
      ).toBe(true);
    },
  );
});
