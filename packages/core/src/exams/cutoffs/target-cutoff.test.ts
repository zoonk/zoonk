import { prisma } from "@zoonk/db";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { SESSION_NOW, sessionGoalFixture } from "../../sessions/_test-utils/session-goal";
import { getExamView } from "../view/get-exam-view";
import { getCutoffTarget } from "./cutoff-target";
import { loadTargetCutoff } from "./load-target-cutoff";
import { findTargetCutoffLookup, recordTargetCutoff } from "./target-cutoff-research";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

const PROVENANCE = { model: "google/gemini-3.8-flash", promptVersion: "test", runId: "test" };
const SOURCE = { title: "Notas de corte", url: "https://sisu.mec.gov.br/notas-de-corte" };
const MEDICINA_UFMG = { institution: "UFMG", targetCourse: "Medicina", targetScore: "750" };

const UNKNOWN = {
  edition: null,
  quota: null,
  score: null,
  source: null,
  status: "unknown",
} as const;

const FOUND = {
  edition: "Sisu 2025",
  quota: "ampla concorrência",
  score: 790.8,
  source: SOURCE,
  status: "found",
} as const;

/** A learner's exam goal on a shared exam, aiming at what `details` says. */
async function examGoal({
  blueprintId,
  details,
}: {
  blueprintId: string;
  details: Record<string, string>;
}) {
  const user = await userFixture();

  const { goal } = await sessionGoalFixture({
    goal: { examBlueprintId: blueprintId, kind: "exam" },
    userId: user.id,
  });

  await prisma.goal.update({ data: { details }, where: { id: goal.id } });
  return { goal, user };
}

describe("a target's cut-off", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is looked up once a year for everyone aiming there, and shown only when found", async () => {
    const blueprint = await examBlueprintFixture({ name: "ENEM" });

    const [first, second] = await Promise.all([
      examGoal({ blueprintId: blueprint.id, details: MEDICINA_UFMG }),
      examGoal({ blueprintId: blueprint.id, details: { ...MEDICINA_UFMG, targetScore: "800" } }),
    ]);

    const lookup = await findTargetCutoffLookup({ goalId: first.goal.id, year: 2026 });

    expect(lookup).toMatchObject({
      course: "Medicina",
      exam: "ENEM",
      institution: "UFMG",
      position: null,
      year: 2026,
    });

    // Found nothing this year: nothing shows, nothing is guessed, and no one looks it up again.
    await recordTargetCutoff({ finding: UNKNOWN, lookup: lookup!, provenance: PROVENANCE });

    await expect(
      loadTargetCutoff({ details: MEDICINA_UFMG, examBlueprintId: blueprint.id }),
    ).resolves.toBeNull();

    await expect(
      findTargetCutoffLookup({ goalId: second.goal.id, year: 2026 }),
    ).resolves.toBeNull();

    // Next year it's looked up again, for the other learner too.
    const nextYear = await findTargetCutoffLookup({ goalId: second.goal.id, year: 2027 });
    await recordTargetCutoff({ finding: FOUND, lookup: nextYear!, provenance: PROVENANCE });

    mockSession(second.user.id);
    const view = await getExamView({ goalId: second.goal.id });

    expect(view).toMatchObject({
      exam: {
        cutoff: {
          course: "Medicina",
          edition: "Sisu 2025",
          institution: "UFMG",
          position: null,
          quota: "ampla concorrência",
          score: 790.8,
          source: SOURCE,
        },
        targetScore: "800",
      },
      status: "ready",
    });
  });

  it("is never looked up for a learner's own exam, or a course without its institution", async () => {
    const owner = await userFixture();

    const [own, shared] = await Promise.all([
      examBlueprintFixture({ ownerId: owner.id }),
      examBlueprintFixture(),
    ]);

    const [ownGoal, courseOnly] = await Promise.all([
      examGoal({ blueprintId: own.id, details: MEDICINA_UFMG }),
      examGoal({ blueprintId: shared.id, details: { targetCourse: "Medicina" } }),
    ]);

    await expect(
      findTargetCutoffLookup({ goalId: ownGoal.goal.id, year: 2026 }),
    ).resolves.toBeNull();

    await expect(
      findTargetCutoffLookup({ goalId: courseOnly.goal.id, year: 2026 }),
    ).resolves.toBeNull();
  });
});

describe(getCutoffTarget, () => {
  it("names a course at an institution, or a position by the exam's own role first", () => {
    expect(getCutoffTarget({ details: MEDICINA_UFMG, role: null })).toStrictEqual({
      course: "Medicina",
      institution: "UFMG",
      key: "course:medicina|ufmg",
      position: null,
    });

    // Two learners who write the position differently share the exam's own name for it.
    expect(
      getCutoffTarget({
        details: { institution: "Câmara dos Deputados", targetPosition: "analista legislativo" },
        role: "Analista Legislativo - Registro e Redação",
      }),
    ).toMatchObject({ course: null, position: "Analista Legislativo - Registro e Redação" });

    expect(getCutoffTarget({ details: { targetScore: "40 pontos" }, role: null })).toBeNull();

    // An exam's role alone can be a phase that passes everyone above a mark, not a target.
    expect(getCutoffTarget({ details: {}, role: "1ª fase" })).toBeNull();
  });
});
