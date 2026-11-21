import { mockOptionsResponseSchema } from "@/lib/openapi/schemas/mocks";
import { ensureMockWritingPrompts } from "@/workflows/sessions/writing-prompt-workflow";
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

function request(goalId: string, suffix = "", kind = WRITTEN.kind) {
  return new NextRequest(`http://localhost/v1/goals/${goalId}/mocks${suffix}`, {
    body: JSON.stringify({ shape: { ...WRITTEN, kind } }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

describe("the written mock API", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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
  });

  it.each([
    { kind: "written", path: "/mocks", post: startMock, suffix: "" },
    { kind: "full", path: "/mocks", post: startMock, suffix: "" },
    { kind: "written", path: "/mocks/generations", post: generate, suffix: "/generations" },
  ])("returns the next date when $path refuses $kind writing", async ({ kind, post, suffix }) => {
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

    const refused = await post(request(goal.id, suffix, kind), context(goal.id));
    expect(refused.status).toBe(429);

    await expect(refused.json()).resolves.toMatchObject({
      error: { code: "USAGE_LIMIT_REACHED", details: { returnsOn: "2026-10-01" } },
      ...(suffix === "" && { returnsOn: "2026-10-01", status: "limitReached" }),
    });

    expect(ensureMockWritingPrompts).not.toHaveBeenCalled();
    await expect(prisma.mockExam.count({ where: { goalId: goal.id } })).resolves.toBe(0);
  });

  it("returns the waiting choice on the written option and refuses both start and generation", async () => {
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

    const responses = await Promise.all([
      startMock(request(goal.id), context(goal.id)),
      generate(request(goal.id, "/generations"), context(goal.id)),
    ]);

    expect(responses.map(({ status }) => status)).toStrictEqual([409, 409]);

    await expect(Promise.all(responses.map((response) => response.json()))).resolves.toMatchObject(
      Array.from({ length: 2 }, () => ({
        error: { code: "EXAM_CHOICE_REQUIRED", details: { choiceGroups: ["Specialty"] } },
      })),
    );

    expect(ensureMockWritingPrompts).not.toHaveBeenCalled();
  });
});
