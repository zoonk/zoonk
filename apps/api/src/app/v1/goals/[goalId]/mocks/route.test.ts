import { mockOptionsResponseSchema } from "@/lib/openapi/schemas/mocks";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../../../../../../../packages/core/src/_test-utils/mock-session";
import { CGU } from "../../../../../../../../packages/core/src/exams/mocks/_test-utils/cgu-written";
import {
  SESSION_NOW,
  SESSION_TODAY,
} from "../../../../../../../../packages/core/src/sessions/_test-utils/session-goal";
import { GET as listMocks, POST as startMock } from "./route";

vi.mock("@zoonk/core/users/session", () => ({ getSession: vi.fn() }));
const WRITTEN = { area: null, day: null, kind: "written" };

function context(goalId: string) {
  return { params: Promise.resolve({ goalId }) };
}

function request(goalId: string, kind = WRITTEN.kind) {
  return new NextRequest(`http://localhost/v1/goals/${goalId}/mocks`, {
    body: JSON.stringify({ shape: { ...WRITTEN, kind } }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

describe("the written mock API", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("describes the exam sessions and starts the mock supply wait when the bank is empty", async () => {
    const [user, blueprint] = await Promise.all([
      userFixture(),
      examBlueprintFixture({ structure: CGU }),
    ]);

    const goal = await goalFixture({
      examBlueprintId: blueprint.id,
      kind: "exam",
      timezone: "UTC",
      userId: user.id,
    });

    mockSession(user.id);

    const list = await listMocks(
      new Request(`http://localhost/v1/goals/${goal.id}/mocks`),
      context(goal.id),
    );

    const data = mockOptionsResponseSchema.parse(await list.json());

    expect(data).toMatchObject({
      access: "plusRequired",
      options: [
        { kind: "objective", sections: [{ questions: 170, session: "Morning" }] },
        { kind: "written", minutes: 210, sections: [{ questions: 2, session: "Afternoon" }] },
        { kind: "full", minutes: 510 },
        { kind: "half", objectiveOnly: true },
      ],
    });

    await expect(startMock(request(goal.id), context(goal.id))).resolves.toMatchObject({
      status: 402,
    });

    await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    });

    const waiting = await startMock(request(goal.id), context(goal.id));
    expect(waiting.status).toBe(200);
    await expect(waiting.json()).resolves.toStrictEqual({ id: null, status: "preparing" });

    const pending = await listMocks(
      new Request(`http://localhost/v1/goals/${goal.id}/mocks`),
      context(goal.id),
    );

    expect(mockOptionsResponseSchema.parse(await pending.json()).requested).toStrictEqual({
      shape: WRITTEN,
      status: "preparing",
    });
  });

  it.each(["written", "full"])(
    "returns the next date when Start refuses %s writing",
    async (kind) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(SESSION_NOW);

      const [user, blueprint] = await Promise.all([
        userFixture(),
        examBlueprintFixture({ structure: CGU }),
      ]);

      const [goal] = await Promise.all([
        goalFixture({
          examBlueprintId: blueprint.id,
          kind: "exam",
          timezone: "UTC",
          userId: user.id,
        }),
        prisma.subscription.create({
          data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
        }),
        prisma.writingAdmission.createMany({
          data: Array.from({ length: 6 }, () => ({
            extra: true,
            id: crypto.randomUUID(),
            itemIds: [],
            localDate: SESSION_TODAY,
            userId: user.id,
          })),
        }),
      ]);

      mockSession(user.id);

      const refused = await startMock(request(goal.id, kind), context(goal.id));
      expect(refused.status).toBe(429);

      await expect(refused.json()).resolves.toMatchObject({
        error: { code: "USAGE_LIMIT_REACHED", details: { returnsOn: "2026-10-01" } },
        returnsOn: "2026-10-01",
        status: "limitReached",
      });

      await expect(prisma.goal.findUnique({ where: { id: goal.id } })).resolves.toMatchObject({
        requestedMock: null,
      });

      await expect(prisma.mockExam.count({ where: { goalId: goal.id } })).resolves.toBe(0);
    },
  );

  it("returns the waiting choice on the written option and refuses Start before preparing", async () => {
    const structure = structuredClone(CGU);
    const written = structure.mock?.sections.find(({ kind }) => kind === "written");
    const subject = structure.subjects[0];

    if (!written?.tasks?.[0] || !subject) {
      throw new Error("Expected the written test");
    }

    written.tasks[0].subjects = ["Systems", "Accounting"];

    structure.subjects.push(
      { ...subject, choiceGroup: "Specialty", name: "Systems", questions: null },
      { ...subject, choiceGroup: "Specialty", name: "Accounting", questions: null },
    );

    const [user, blueprint] = await Promise.all([
      userFixture(),
      examBlueprintFixture({ structure }),
    ]);

    const [goal] = await Promise.all([
      goalFixture({ examBlueprintId: blueprint.id, kind: "exam", userId: user.id }),
      prisma.subscription.create({
        data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
      }),
    ]);

    mockSession(user.id);

    const list = await listMocks(
      new Request(`http://localhost/v1/goals/${goal.id}/mocks`),
      context(goal.id),
    );

    const data = mockOptionsResponseSchema.parse(await list.json());

    expect(data.options.find(({ kind }) => kind === "written")).toMatchObject({
      availability: { choiceGroups: ["Specialty"], status: "needsChoice" },
      minutes: 210,
      sections: [{ questions: 2 }],
    });

    const response = await startMock(request(goal.id), context(goal.id));
    expect(response.status).toBe(409);

    await expect(response.json()).resolves.toMatchObject({
      error: { code: "EXAM_CHOICE_REQUIRED", details: { choiceGroups: ["Specialty"] } },
    });

    await expect(prisma.goal.findUnique({ where: { id: goal.id } })).resolves.toMatchObject({
      requestedMock: null,
    });
  });
});
