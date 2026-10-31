import { prisma } from "@zoonk/db";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import {
  NET_SCORED_EXAM_STRUCTURE,
  SESSION_NOW,
  sessionGoalFixture,
} from "../../sessions/_test-utils/session-goal";
import { getExamView } from "../view/get-exam-view";
import { getCutoffTarget } from "./cutoff-target";
import { loadTargetCutoff } from "./load-target-cutoff";
import { findTargetCutoffLookup, recordTargetCutoff } from "./target-cutoff-research";

const PROVENANCE = { model: "google/gemini-3.8-flash", promptVersion: "test", runId: "test" };
const SOURCE = { title: "Notas de corte", url: "https://sisu.mec.gov.br/notas-de-corte" };
const MEDICINA_UFMG = { institution: "UFMG", targetCourse: "Medicina", targetScore: "750" };

const UNKNOWN = {
  edition: null,
  maxScore: null,
  quota: null,
  score: null,
  source: null,
  status: "unknown",
} as const;

const FOUND = {
  edition: "Sisu 2025",
  maxScore: 1000,
  quota: "ampla concorrência",
  score: 790.8,
  source: SOURCE,
  status: "found",
} as const;

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

    await recordTargetCutoff({ finding: UNKNOWN, lookup: lookup!, provenance: PROVENANCE });

    await expect(
      loadTargetCutoff({ details: MEDICINA_UFMG, examBlueprintId: blueprint.id }),
    ).resolves.toBeNull();

    await expect(
      findTargetCutoffLookup({ goalId: second.goal.id, year: 2026 }),
    ).resolves.toBeNull();

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
          maxScore: 1000,
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

  it("shows only on a scale the learner can read: the source's, else the notice's", async () => {
    const role = "Escrevente Técnico Judiciário";
    const position = { targetPosition: role };
    const tenPoints = { fromPercent: null, max: 10, min: 0, name: null, passScore: 5, step: null };

    const tenPointStructure = {
      ...NET_SCORED_EXAM_STRUCTURE,
      mock: {
        ...NET_SCORED_EXAM_STRUCTURE.mock,
        scoring: { ...NET_SCORED_EXAM_STRUCTURE.mock.scoring, scale: tenPoints },
      },
    };

    const [unscaled, scaled, other] = await Promise.all([
      examBlueprintFixture({ role }),
      examBlueprintFixture({ role, structure: tenPointStructure }),
      examBlueprintFixture({ role, structure: tenPointStructure }),
    ]);

    const record = async ({ blueprintId, score }: { blueprintId: string; score: number }) => {
      const { goal } = await examGoal({ blueprintId, details: position });
      const lookup = await findTargetCutoffLookup({ goalId: goal.id, year: 2026 });
      const finding = { ...FOUND, edition: "Concurso TJ SP 2024", maxScore: null, score };

      await recordTargetCutoff({ finding, lookup: lookup!, provenance: PROVENANCE });
    };

    await Promise.all([
      record({ blueprintId: unscaled.id, score: 7 }),
      record({ blueprintId: scaled.id, score: 7 }),
      record({ blueprintId: other.id, score: 70 }),
    ]);

    await expect(
      loadTargetCutoff({ details: position, examBlueprintId: unscaled.id }),
    ).resolves.toBeNull();

    await expect(
      loadTargetCutoff({ details: position, examBlueprintId: scaled.id }),
    ).resolves.toMatchObject({ maxScore: 10, score: 7 });

    await expect(
      loadTargetCutoff({ details: position, examBlueprintId: other.id }),
    ).resolves.toBeNull();
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

    expect(
      getCutoffTarget({
        details: { institution: "Câmara dos Deputados", targetPosition: "analista legislativo" },
        role: "Analista Legislativo - Registro e Redação",
      }),
    ).toMatchObject({ course: null, position: "Analista Legislativo - Registro e Redação" });

    expect(getCutoffTarget({ details: { targetScore: "40 pontos" }, role: null })).toBeNull();

    expect(getCutoffTarget({ details: {}, role: "1ª fase" })).toBeNull();
  });
});
