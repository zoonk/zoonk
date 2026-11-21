import { mockOptionsResponseSchema } from "@/lib/openapi/schemas/mocks";
import { ensureMockWritingPrompts } from "@/workflows/sessions/writing-prompt-workflow";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../../../../../../../packages/core/src/_test-utils/mock-session";
import { CGU } from "../../../../../../../../packages/core/src/exams/mocks/_test-utils/cgu-written";
import { POST as generate } from "./generations/route";
import { GET as listMocks, POST as startMock } from "./route";

vi.mock("@zoonk/core/users/session", () => ({ getSession: vi.fn() }));
// Exercise HTTP delivery with a fixed run ID without starting a paid generation.
vi.mock("@/workflows/sessions/writing-prompt-workflow", () => ({
  ensureMockWritingPrompts: vi.fn(),
}));

const WRITTEN = { area: null, day: null, kind: "written" };
const RUN_ID = "run_written_prompt";

function context(goalId: string) {
  return { params: Promise.resolve({ goalId }) };
}

function request(goalId: string, suffix = "") {
  return new NextRequest(`http://localhost/v1/goals/${goalId}/mocks${suffix}`, {
    body: JSON.stringify({ shape: WRITTEN }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

describe("the written mock API", () => {
  it("describes the exam sessions and starts an authorized prompt wait when the bank is empty", async () => {
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
    await expect(waiting.json()).resolves.toStrictEqual({ id: null, status: "needsQuestions" });

    vi.mocked(ensureMockWritingPrompts).mockResolvedValue({ runId: RUN_ID, status: "writing" });
    const generation = await generate(request(goal.id, "/generations"), context(goal.id));
    expect(generation.status).toBe(202);
    expect(generation.headers.get("location")).toBe(`/v1/generations/${RUN_ID}`);

    await expect(generation.json()).resolves.toStrictEqual({
      generationId: RUN_ID,
      status: "generating",
    });

    expect(ensureMockWritingPrompts).toHaveBeenCalledExactlyOnceWith(
      expect.arrayContaining(
        ["short", "long"].map((taskKey) => ({
          count: 1,
          goalId: goal.id,
          taskKey,
          unit: "answer",
          userId: user.id,
        })),
      ),
    );

    await prisma.writingAdmission.createMany({
      data: Array.from({ length: 6 }, () => ({
        extra: true,
        id: crypto.randomUUID(),
        itemIds: [],
        localDate: new Date(new Date().toISOString().slice(0, 10)),
        userId: user.id,
      })),
    });

    const refused = await generate(request(goal.id, "/generations"), context(goal.id));
    expect(refused.status).toBe(429);
    expect(ensureMockWritingPrompts).toHaveBeenCalledOnce();
    await expect(prisma.mockExam.count({ where: { goalId: goal.id } })).resolves.toBe(0);
  });
});
