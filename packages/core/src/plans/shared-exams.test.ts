import { type Goal } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getSyllabusView } from "../view-models/syllabus/get-syllabus-view";

type GoalAttrs = Partial<
  Pick<Goal, "examBlueprintId" | "kind" | "status" | "targetLanguage" | "title">
>;

async function goalWithSkills({
  areas,
  userId,
  ...attrs
}: GoalAttrs & { areas: Record<string, { id: string }[]>; userId: string }) {
  const goal = await goalFixture({ kind: "exam", ...attrs, userId });

  await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "Everything" }],
      skills: Object.entries(areas).flatMap(([area, skills]) =>
        skills.map((skill) => ({
          area,
          lessons: 2,
          name: `Skill ${skill.id}`,
          phase: 0,
          skillId: skill.id,
          weight: null,
        })),
      ),
    },
  });

  return goal;
}

async function readSharing(goalId: string) {
  const result = await getSyllabusView({ goalId });

  if (result.status !== "ready") {
    throw new Error(`Expected the syllabus, got ${result.status}`);
  }

  return {
    exams: result.syllabus.sharedExams,
    subjects: Object.fromEntries(
      result.syllabus.subjects.map((subject) => [subject.name, subject.sharedWith]),
    ),
  };
}

describe("the subjects a plan shares with the learner's other exams", () => {
  it("names each exam whose plan holds some of a subject's skills, on those subjects only", async () => {
    const [user, cguNotice, portuguese, grammar, constitution, computing, other] =
      await Promise.all([
        userFixture(),
        examBlueprintFixture({ name: "CGU" }),
        skillFixture(),
        skillFixture(),
        skillFixture(),
        skillFixture(),
        skillFixture(),
      ]);

    const camara = await goalWithSkills({
      areas: {
        Computing: [computing],
        Constitution: [constitution],
        Portuguese: [portuguese, grammar],
      },
      title: "Pass the Chamber of Deputies exam",
      userId: user.id,
    });

    const cgu = await goalWithSkills({
      areas: { Law: [constitution, other], Portuguese: [portuguese] },
      examBlueprintId: cguNotice.id,
      title: "Pass the CGU exam",
      userId: user.id,
    });

    const court = await goalWithSkills({
      areas: { Language: [grammar] },
      title: "TJ-SP",
      userId: user.id,
    });

    await goalWithSkills({ areas: { Ethics: [other] }, title: "OAB", userId: user.id });

    mockSession(user.id);

    await expect(readSharing(camara.id)).resolves.toStrictEqual({
      exams: [
        { goalId: cgu.id, name: "CGU" },
        { goalId: court.id, name: "TJ-SP" },
      ],
      subjects: { Computing: [], Constitution: [cgu.id], Portuguese: [cgu.id, court.id] },
    });
  });

  it("counts a paused exam and a skill merged into one the plan holds, never a finished or archived one", async () => {
    const user = await userFixture();
    const survivor = await skillFixture();

    const [merged, done] = await Promise.all([
      skillFixture({ mergedIntoId: survivor.id }),
      skillFixture(),
    ]);

    const camara = await goalWithSkills({
      areas: { Portuguese: [survivor], Statistics: [done] },
      userId: user.id,
    });

    const [paused] = await Promise.all([
      goalWithSkills({
        areas: { Portuguese: [merged] },
        status: "paused",
        title: "CGU",
        userId: user.id,
      }),
      goalWithSkills({ areas: { Statistics: [done] }, status: "completed", userId: user.id }),
      goalWithSkills({ areas: { Statistics: [done] }, status: "archived", userId: user.id }),
    ]);

    mockSession(user.id);

    await expect(readSharing(camara.id)).resolves.toStrictEqual({
      exams: [{ goalId: paused.id, name: "CGU" }],
      subjects: { Portuguese: [paused.id], Statistics: [] },
    });
  });

  it("never counts a language goal, on its plan or an exam's", async () => {
    const user = await userFixture();
    const skill = await skillFixture();
    const areas = { Reading: [skill] };

    const [exam, language] = await Promise.all([
      goalWithSkills({ areas, userId: user.id }),
      goalWithSkills({ areas, kind: "language", targetLanguage: "es", userId: user.id }),
    ]);

    mockSession(user.id);

    const nothing = { exams: [], subjects: { Reading: [] } };

    await expect(readSharing(exam.id)).resolves.toStrictEqual(nothing);
    await expect(readSharing(language.id)).resolves.toStrictEqual(nothing);
  });

  it("shows nothing when the other exams share no skill", async () => {
    const user = await userFixture();
    const [law, math] = await Promise.all([skillFixture(), skillFixture()]);

    const [exam] = await Promise.all([
      goalWithSkills({ areas: { Law: [law] }, userId: user.id }),
      goalWithSkills({ areas: { Math: [math] }, userId: user.id }),
    ]);

    mockSession(user.id);

    await expect(readSharing(exam.id)).resolves.toStrictEqual({ exams: [], subjects: { Law: [] } });
  });
});
