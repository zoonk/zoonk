import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { courseBandsFixture } from "@zoonk/testing/fixtures/library-chapters";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCourseExamDays } from "./course-exam-days";
import { getCourseExamDaysByRoute } from "./course-exam-days-by-route";

const NOW = new Date("2020-09-28T12:00:00Z");

const EDITION = {
  check: null,
  citations: [],
  dates: ["2020-10-11", "2020-10-18"].map((date) => ({
    citation: { passage: "Exam day", sourceId: "notice" },
    date,
    kind: "exam",
    label: "Exam",
    startTime: null,
  })),
  noticeUrl: null,
  questionCount: null,
  sourceHash: null,
  timeZone: "America/Sao_Paulo",
  year: 2020,
};

async function brandExamCourse() {
  const organization = await organizationFixture();

  const [course, blueprint] = await Promise.all([
    courseFixture({
      format: "exam",
      isPublished: true,
      organizationId: organization.id,
      visibility: "public",
    }),
    examBlueprintFixture({ edition: EDITION }),
  ]);

  const [band] = await courseBandsFixture({ courseId: course.id, levels: ["beginner"] });

  await prisma.examSkillGraph.create({
    data: {
      examBlueprintId: blueprint.id,
      generatedAt: NOW,
      graph: {
        phases: [{ milestone: null, name: "Exam" }],
        skills: [
          {
            area: null,
            courseIds: [course.id],
            lessons: 1,
            name: band?.skill.name ?? "",
            phase: 0,
            skillId: band?.skill.id ?? "",
            weight: null,
          },
        ],
      },
      model: "fixture",
      primaryCourseId: course.id,
      promptVersion: "fixture",
      runId: "fixture",
    },
  });

  return { course, organization };
}

describe(getCourseExamDaysByRoute, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("reads the same next sitting as the course's id does", async () => {
    const { course, organization } = await brandExamCourse();
    const byId = await getCourseExamDays(course.id);

    expect(byId?.days).toStrictEqual(["2020-10-11", "2020-10-18"]);

    await expect(
      getCourseExamDaysByRoute({ brandSlug: organization.slug, courseSlug: course.slug }),
    ).resolves.toStrictEqual(byId);
  });

  it("returns null for a route no published course has", async () => {
    const { course, organization } = await brandExamCourse();

    await expect(
      getCourseExamDaysByRoute({ brandSlug: organization.slug, courseSlug: `${course.slug}-x` }),
    ).resolves.toBeNull();

    await prisma.course.update({ data: { isPublished: false }, where: { id: course.id } });

    await expect(
      getCourseExamDaysByRoute({ brandSlug: organization.slug, courseSlug: course.slug }),
    ).resolves.toBeNull();
  });
});
