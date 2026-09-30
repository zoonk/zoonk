import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { courseChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { signedInCourseGoal } from "../_test-utils/course-goal";
import { getFieldMapView } from "./get-field-map-view";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));

/** A skill studied long ago with a short memory: its chance of recall is low now. */
function fadingSkill({ skillId, userId }: { skillId: string; userId: string }) {
  return learnerSkillFixture({
    difficulty: 5,
    lastReviewedAt: new Date(Date.now() - 20 * MS_PER_DAY),
    reps: 2,
    skillId,
    stability: 2,
    state: "learning",
    userId,
  });
}

describe(getFieldMapView, () => {
  it("requires a session, the learner's own goal, and says when there's no goal yet", async () => {
    const { goal } = await signedInCourseGoal();

    mockSession(null);
    await expect(getFieldMapView()).resolves.toStrictEqual({ status: "unauthorized" });

    const other = await userFixture();
    mockSession(other.id);

    await expect(getFieldMapView({ goalId: goal.id })).resolves.toStrictEqual({
      status: "notFound",
    });

    await expect(getFieldMapView()).resolves.toStrictEqual({ status: "noGoal" });
  });

  it("draws every skill by chapter and phase with its state, links and where the learner is", async () => {
    const { chapters, course, skills, user } = await signedInCourseGoal({
      statuses: ["done", "done", "todo", "todo"],
    });

    await learnerSkillFixture({
      lastReviewedAt: new Date(),
      recallDays: 3,
      reps: 4,
      skillId: skills[0]?.id ?? "",
      stability: 30,
      state: "mastered",
      userId: user.id,
    });

    const result = await getFieldMapView();
    const map = result.status === "ready" ? result.map : null;

    expect(
      map?.areas.map((area) => [area.chapterId, area.phase, area.state, area.current]),
    ).toStrictEqual([
      [chapters[0]?.id, 0, "done", false],
      [chapters[1]?.id, 1, "current", true],
    ]);

    expect(map?.areas[0]?.skills.map((skill) => [skill.name, skill.state])).toStrictEqual([
      ["Atom", "mastered"],
      ["Nucleus", "new"],
    ]);

    expect(map?.areas[0]?.skills[1]).toMatchObject({
      description: "Nucleus in one sentence",
      prerequisiteIds: [skills[0]?.id],
    });

    expect(map?.phases.map((phase) => [phase.name, phase.state, phase.counts.total])).toStrictEqual(
      [
        ["The very small", "done", 2],
        ["The atom", "current", 2],
      ],
    );

    expect(map?.counts).toMatchObject({ mastered: 1, total: 4 });
    expect(map?.courses).toStrictEqual([{ courseId: course.id, title: "Quantum physics" }]);
    expect(map?.areas.every((area) => area.courseId === course.id)).toBe(true);
    expect(map?.next).toBeNull();
  });

  it("shows the course the plan is built from, with the plan's level marked", async () => {
    const { course, organization } = await signedInCourseGoal();

    const result = await getFieldMapView();
    const map = result.status === "ready" ? result.map : null;

    expect(map?.course).toMatchObject({
      brandSlug: organization.slug,
      chapterCount: 3,
      courseId: course.id,
      courseSlug: course.slug,
      nextLevel: "beginner",
      planChapterCount: 2,
    });

    expect(
      map?.course?.levels.map((level) => [level.level, level.inPlan, level.chapterCount]),
    ).toStrictEqual([
      ["overview", true, 2],
      ["beginner", false, 1],
      ["intermediate", false, 0],
      ["advanced", false, 0],
    ]);
  });

  it("lists fading skills most faded first, and leads with them for a refresh goal", async () => {
    const { skills, user } = await signedInCourseGoal({
      details: { purpose: "refresh" },
      statuses: ["done", "done", "done", "todo"],
    });

    await Promise.all(
      skills.slice(0, 2).map((skill) => fadingSkill({ skillId: skill.id, userId: user.id })),
    );

    const result = await getFieldMapView();
    const refresh = result.status === "ready" ? result.map.refresh : null;

    expect(refresh?.emphasized).toBe(true);

    expect(refresh?.skills.map((skill) => skill.name).toSorted()).toStrictEqual([
      "Atom",
      "Nucleus",
    ]);

    expect(refresh?.skills.every((skill) => (skill.retrievability ?? 1) < 0.9)).toBe(true);
  });

  it("suggests the next level and the other courses once every lesson is done", async () => {
    const { chapters, course, goal } = await signedInCourseGoal({
      statuses: ["done", "done", "testedOut", "done"],
    });

    const organization = await organizationFixture();

    const other = await courseFixture({
      organizationId: organization.id,
      title: "Math for physics",
      visibility: "public",
    });

    await courseChapterFixture({
      chapterId: chapters[1]?.id ?? "",
      courseId: other.id,
      level: "overview",
    });

    const result = await getFieldMapView({ goalId: goal.id });
    const map = result.status === "ready" ? result.map : null;

    expect(map?.next).toStrictEqual({
      nextLevel: {
        chapterCount: 1,
        courseId: course.id,
        level: "beginner",
        title: "Quantum physics",
      },
      related: [
        {
          brandSlug: expect.any(String),
          courseId: other.id,
          courseSlug: other.slug,
          title: "Math for physics",
        },
      ],
    });

    // A chapter that's also in another course stays with the plan's own course on the map.
    expect(map?.areas.map((area) => area.courseId)).toStrictEqual([course.id, course.id]);
  });
});
