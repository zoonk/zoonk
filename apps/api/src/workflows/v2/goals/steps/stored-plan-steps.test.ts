import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { getRun } from "workflow/api";
import { loadStoredCurriculumStep } from "./stored-plan-steps";

// Runs live in the workflow runtime: each test says how the research run reads.
vi.mock("workflow/api", () => ({ getRun: vi.fn() }));

function researchRun(run: { createdAt?: Promise<Date>; exists: Promise<boolean> }) {
  vi.mocked(getRun).mockReturnValue(run as unknown as ReturnType<typeof getRun>);
}

describe(loadStoredCurriculumStep, () => {
  it("throws when the research run can't be read, so the runtime retries the step", async () => {
    const unavailable = new Error("The workflow backend didn't answer");
    const createdAt = Promise.reject(unavailable);
    createdAt.catch(() => null);

    researchRun({ createdAt, exists: Promise.resolve(true) });

    await expect(
      loadStoredCurriculumStep({ goalId: randomUUID(), researchId: "research-run" }),
    ).rejects.toBe(unavailable);
  });

  it("has nothing to reconcile with research that never ran", async () => {
    researchRun({ exists: Promise.resolve(false) });

    await expect(
      loadStoredCurriculumStep({ goalId: randomUUID(), researchId: "seeded-research" }),
    ).resolves.toBeNull();
  });
});
