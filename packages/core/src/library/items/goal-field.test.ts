import { randomUUID } from "node:crypto";
import { type WorkFieldResult, classifyWorkField } from "@zoonk/ai/tasks/v2/items/work-field";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveGoalField } from "./goal-field";

function mockField(field: WorkFieldResult["field"]) {
  vi.mocked(classifyWorkField).mockResolvedValueOnce({
    data: { field },
    provenance: {
      generatedAt: new Date().toISOString(),
      latencyMs: 1,
      model: "google/gemini-3.5-flash-lite",
      promptVersion: "test",
      provider: "test",
      requestedModel: "google/gemini-3.5-flash-lite",
      runId: randomUUID(),
      usage: {},
    },
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  });
}

async function goalWith(details: Record<string, unknown>) {
  const user = await userFixture();
  return goalFixture({ details, title: "Statistics for my job", userId: user.id });
}

async function readDetails(goalId: string) {
  const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });
  return goal.details as Record<string, unknown>;
}

describe(resolveGoalField, () => {
  beforeEach(() => {
    vi.mocked(classifyWorkField).mockReset();
  });

  it("sorts a work goal's role into a field once and keeps it on the goal", async () => {
    const goal = await goalWith({ purpose: "work", role: "Enfermeira de UTI", tasks: "Escalas" });
    mockField("nursing");

    const revisionBefore = await readRevision(goal.userId);

    await expect(resolveGoalField({ goalId: goal.id })).resolves.toBe("nursing");
    await expect(resolveGoalField({ goalId: goal.id })).resolves.toBe("nursing");

    await expect(readRevision(goal.userId)).resolves.toBe(revisionBefore + 1n);

    expect(classifyWorkField).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        goal: "Statistics for my job",
        purpose: "work",
        role: "Enfermeira de UTI",
        targetRole: null,
        tasks: "Escalas",
      }),
    );

    await expect(readDetails(goal.id)).resolves.toMatchObject({
      field: "nursing",
      purpose: "work",
      role: "Enfermeira de UTI",
    });
  });

  it("keeps the planning version when new role wording resolves to the same field", async () => {
    const goal = await goalWith({ purpose: "work", role: "Store manager" });
    const plan = await planFixture({ goalId: goal.id });
    mockField("retail");
    await resolveGoalField({ goalId: goal.id });
    const before = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    const details = await readDetails(goal.id);

    await prisma.goal.update({
      data: { details: { ...details, role: "Retail manager" } },
      where: { id: goal.id },
    });

    mockField("retail");
    await resolveGoalField({ goalId: goal.id });
    const after = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(after.inputVersion).toBe(before.inputVersion);
    expect(after.inputVersion).toBe(plan.inputVersion + 1);
  });

  it("sorts a career change by the role the learner wants", async () => {
    const goal = await goalWith({
      purpose: "careerChange",
      role: "Teacher",
      targetPosition: "Data analyst",
    });

    mockField("data-analysis");

    await expect(resolveGoalField({ goalId: goal.id })).resolves.toBe("data-analysis");

    expect(classifyWorkField).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: "careerChange", targetRole: "Data analyst" }),
    );
  });

  it("sorts the role again after the learner changes it", async () => {
    const goal = await goalWith({ purpose: "work", role: "Store manager" });
    mockField("retail");
    await resolveGoalField({ goalId: goal.id });

    const details = await readDetails(goal.id);

    await prisma.goal.update({
      data: { details: { ...details, role: "Paralegal" } },
      where: { id: goal.id },
    });

    mockField("law");

    await expect(resolveGoalField({ goalId: goal.id })).resolves.toBe("law");
    expect(classifyWorkField).toHaveBeenCalledTimes(2);
  });

  it("remembers a role that names no field, without asking again", async () => {
    const goal = await goalWith({ purpose: "work", role: "Employee" });
    mockField("none");

    await expect(resolveGoalField({ goalId: goal.id })).resolves.toBeNull();
    await expect(resolveGoalField({ goalId: goal.id })).resolves.toBeNull();

    expect(classifyWorkField).toHaveBeenCalledOnce();
    await expect(readDetails(goal.id)).resolves.toMatchObject({ field: null });
  });

  it("has no field for other purposes or a skipped role screen", async () => {
    const [deep, skipped, noTarget] = await Promise.all([
      goalWith({ purpose: "deep", role: "Nurse" }),
      goalWith({ purpose: "work" }),
      goalWith({ purpose: "careerChange", role: "Teacher" }),
    ]);

    await expect(resolveGoalField({ goalId: deep.id })).resolves.toBeNull();
    await expect(resolveGoalField({ goalId: skipped.id })).resolves.toBeNull();
    await expect(resolveGoalField({ goalId: noTarget.id })).resolves.toBeNull();

    expect(classifyWorkField).not.toHaveBeenCalled();
  });
});

async function readRevision(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return user.learnerRevision;
}
