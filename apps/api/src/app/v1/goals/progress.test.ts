import { goalSchema } from "@/lib/openapi/schemas/goals";
import { planResponseSchema } from "@/lib/openapi/schemas/plans";
import { syllabusViewSchema } from "@zoonk/core/view-models/syllabus/contract";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../../../../../packages/core/src/_test-utils/mock-session";
import { GET as listCertificates } from "../me/certificates/progress/route";
import { GET as getPlan } from "./[goalId]/plan/route";
import { GET as getGoal } from "./[goalId]/route";
import { GET as getSyllabus } from "./[goalId]/syllabus/route";
import { GET as listGoals } from "./route";

vi.mock("@zoonk/core/users/session", () => ({ getSession: vi.fn() }));

describe("goal progress serialization", () => {
  it.each([0, 1])(
    "serializes Plan credit separately from %i studied certificate lessons",
    async (studied) => {
      const user = await userFixture();
      const [goal, skill] = await Promise.all([goalFixture({ userId: user.id }), skillFixture()]);

      const plan = await planFixture({
        goalId: goal.id,
        graph: {
          skills: [
            { area: "Science", lessons: 400, name: skill.name, phase: 0, skillId: skill.id },
          ],
        },
      });

      await Promise.all(
        [
          { lessons: 1, status: studied ? ("done" as const) : ("testedOut" as const) },
          { lessons: 11, status: "testedOut" as const },
          { lessons: 388, status: "todo" as const },
        ].map((item, position) =>
          planItemFixture({ ...item, planId: plan.id, position, skillId: skill.id }),
        ),
      );

      mockSession(user.id);

      const context = { params: Promise.resolve({ goalId: goal.id }) };
      const request = new NextRequest(`http://localhost/v1/goals/${goal.id}`);

      const [detail, listed, syllabus, phasePlan, certificates] = await Promise.all([
        getGoal(request, context),
        listGoals(),
        getSyllabus(request, context),
        getPlan(request, context),
        listCertificates(),
      ]);

      expect([detail.status, listed.status, syllabus.status]).toStrictEqual([200, 200, 200]);
      const goalDetail = goalSchema.parse(await detail.json());
      const goalList = await listed.json();

      const listedGoal = goalSchema.parse(
        goalList.goals.find((row: { id: string }) => row.id === goal.id),
      );

      const planView = syllabusViewSchema.parse(await syllabus.json());
      expect(planView.lessons).toStrictEqual({ done: 12, known: 12 - studied, total: 400 });

      expect(phasePlan.status).toBe(200);
      const phases = planResponseSchema.parse(await phasePlan.json()).phases;
      expect(phases[0]).toMatchObject({ lessonsDone: 12, lessonsTotal: 400 });

      expect(certificates.status).toBe(200);
      const certificateProgress = await certificates.json();

      expect(certificateProgress.upNext).toMatchObject([{ id: goal.id, progress: studied / 400 }]);

      for (const row of [goalDetail, listedGoal]) {
        expect(row.plan).toMatchObject({
          lessonsDone: planView.lessons.done,
          lessonsTotal: planView.lessons.total,
        });
      }
    },
  );
});
