import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { courseBandsFixture } from "@zoonk/testing/fixtures/library-chapters";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildPlan } from "../../../../../packages/core/src/plans/planner/build-plan";
import { getCoursePlanExample } from "./course-plan";

// Count real producer entries on a fresh public course, without replacing persistence or planning.
vi.mock("../../../../../packages/core/src/plans/planner/build-plan", { spy: true });

describe("the public example selects one pace", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-30T12:00:00Z"));
  });

  afterEach(() => vi.useRealTimers());

  it("a public example cache miss computes only its selected default pace", async () => {
    const course = await courseFixture({ isPublished: true, visibility: "public" });

    await courseBandsFixture({
      courseId: course.id,
      levels: ["beginner", "intermediate", "advanced"],
    });

    vi.mocked(buildPlan).mockClear();

    const example = await getCoursePlanExample(course);

    expect(buildPlan).toHaveBeenCalledOnce();
    expect(example.pace?.minutes).toBe(15);
  });
});
