import { type SkillLevelsParams, classifySkillLevels } from "@zoonk/ai/tasks/language/skill-levels";
import { tagSkillLevels } from "@zoonk/core/library/skills/tag-levels";
import { prisma } from "@zoonk/db";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { taskResult } from "../_test-utils/recorded-outputs";
import { skillLevelsWorkflow } from "./skill-levels-workflow";

const MAX_ATTEMPTS = 8;
const STALE_CLAIM_MS = 10 * 60 * 1000;

/** Places every skill at its band's upper level, except the ones the model skips. */
function mockLevels({ skipped = [] }: { skipped?: string[] } = {}) {
  vi.mocked(classifySkillLevels).mockImplementation(async ({ skills }: SkillLevelsParams) =>
    taskResult({
      levels: skills
        .filter((skill) => !skipped.includes(skill.id))
        .map((skill) => ({ id: skill.id, level: skill.band[1] })),
    }),
  );
}

function readSkills(ids: readonly string[]) {
  return prisma.skill.findMany({
    orderBy: { id: "asc" },
    select: { cefrAttempts: true, cefrLevel: true, id: true },
    where: { id: { in: [...ids] } },
  });
}

function sentSkillIds(): string[][] {
  return vi
    .mocked(classifySkillLevels)
    .mock.calls.map(([params]) => params.skills.map((skill) => skill.id));
}

describe(skillLevelsWorkflow, () => {
  it("tags each language skill without a level in its band, one call per target language, and leaves one the model skipped for the next run", async () => {
    const owner = await userFixture();

    const [rent, meeting, skipped, spanish, tagged, privateSkill, unbanded] = await Promise.all([
      skillFixture({ level: "beginner", targetLanguage: "en" }),
      skillFixture({ level: "intermediate", targetLanguage: "en" }),
      skillFixture({ level: "beginner", targetLanguage: "en" }),
      skillFixture({ level: "beginner", targetLanguage: "es" }),
      skillFixture({ cefrLevel: "A1", level: "beginner", targetLanguage: "en" }),
      skillFixture({
        level: "beginner",
        ownerId: owner.id,
        targetLanguage: "en",
        visibility: "private",
      }),
      skillFixture({ targetLanguage: "en" }),
    ]);

    const skillIds = [rent, meeting, skipped, spanish, tagged, privateSkill, unbanded].map(
      (skill) => skill.id,
    );

    mockLevels({ skipped: [skipped.id] });

    await expect(skillLevelsWorkflow({ skillIds, wait: "soon" })).resolves.toBe(3);

    expect(sentSkillIds()).toHaveLength(2);

    expect(sentSkillIds()).toStrictEqual(
      expect.arrayContaining([[rent.id, meeting.id, skipped.id], [spanish.id]]),
    );

    expect(classifySkillLevels).toHaveBeenCalledWith(
      expect.objectContaining({
        skills: [
          expect.objectContaining({ band: ["A1", "A2"], id: rent.id }),
          expect.objectContaining({ band: ["B1", "B2"], id: meeting.id }),
          expect.objectContaining({ band: ["A1", "A2"], id: skipped.id }),
        ],
        targetLanguage: "en",
      }),
    );

    await expect(readSkills(skillIds)).resolves.toStrictEqual(
      [
        { cefrAttempts: 1, cefrLevel: "A2", id: rent.id },
        { cefrAttempts: 1, cefrLevel: "B2", id: meeting.id },
        { cefrAttempts: 1, cefrLevel: null, id: skipped.id },
        { cefrAttempts: 1, cefrLevel: "A2", id: spanish.id },
        { cefrAttempts: 0, cefrLevel: "A1", id: tagged.id },
        { cefrAttempts: 0, cefrLevel: null, id: privateSkill.id },
        { cefrAttempts: 0, cefrLevel: null, id: unbanded.id },
      ].toSorted((a, b) => a.id.localeCompare(b.id)),
    );

    vi.mocked(classifySkillLevels).mockClear();
    mockLevels();

    await expect(skillLevelsWorkflow({ skillIds, wait: "later" })).resolves.toBe(1);
    expect(sentSkillIds()).toStrictEqual([[skipped.id]]);
    await expect(readSkills([skipped.id])).resolves.toMatchObject([{ cefrLevel: "A2" }]);
  });

  it("counts a failed call as a try and stops sending a skill whose tries reached the cap", async () => {
    const [failing, exhausted] = await Promise.all([
      skillFixture({ level: "beginner", targetLanguage: "en" }),
      skillFixture({ cefrAttempts: MAX_ATTEMPTS, level: "beginner", targetLanguage: "en" }),
    ]);

    vi.mocked(classifySkillLevels).mockRejectedValue(new Error("Provider unavailable"));

    await expect(
      skillLevelsWorkflow({ skillIds: [failing.id, exhausted.id], wait: "later" }),
    ).resolves.toBe(0);

    expect(sentSkillIds()).toStrictEqual([[failing.id]]);

    await expect(readSkills([failing.id])).resolves.toMatchObject([
      { cefrAttempts: 1, cefrLevel: null },
    ]);
  });

  it("leaves a skill another run is tagging to that run", async () => {
    const skill = await skillFixture({ level: "beginner", targetLanguage: "en" });
    const batch = { skillIds: [skill.id], targetLanguage: "en" };
    const gate = Promise.withResolvers<null>();

    vi.mocked(classifySkillLevels)
      .mockImplementationOnce(async () => {
        await gate.promise;
        return taskResult({ levels: [{ id: skill.id, level: "A1" as const }] });
      })
      .mockResolvedValue(taskResult({ levels: [{ id: skill.id, level: "A2" as const }] }));

    const curriculum = tagSkillLevels({ batch, workflowRunId: "curriculum-run" });
    await vi.waitFor(() => expect(classifySkillLevels).toHaveBeenCalledOnce());

    const sweep = await tagSkillLevels({ batch, workflowRunId: "sweep-run" }).finally(() =>
      gate.resolve(null),
    );

    expect(classifySkillLevels).toHaveBeenCalledOnce();
    expect(sweep).toBe(0);
    await expect(curriculum).resolves.toBe(1);

    await expect(readSkills([skill.id])).resolves.toMatchObject([
      { cefrAttempts: 1, cefrLevel: "A1" },
    ]);
  });

  it("lets the run holding a skill retry it, and another run take a claim left for over ten minutes", async () => {
    const [held, abandoned] = await Promise.all([
      skillFixture({ level: "beginner", targetLanguage: "en" }),
      skillFixture({
        cefrAttempts: 1,
        cefrClaimedAt: new Date(Date.now() - STALE_CLAIM_MS - 1000),
        cefrRunId: "stopped-run",
        level: "beginner",
        targetLanguage: "en",
      }),
    ]);

    const batch = { skillIds: [held.id], targetLanguage: "en" };

    vi.mocked(classifySkillLevels).mockRejectedValueOnce(new Error("Provider unavailable"));

    await expect(tagSkillLevels({ batch, workflowRunId: "first-run" })).rejects.toThrow();

    mockLevels();

    await expect(tagSkillLevels({ batch, workflowRunId: "other-run" })).resolves.toBe(0);
    await expect(tagSkillLevels({ batch, workflowRunId: "first-run" })).resolves.toBe(1);

    await expect(
      tagSkillLevels({
        batch: { skillIds: [abandoned.id], targetLanguage: "en" },
        workflowRunId: "other-run",
      }),
    ).resolves.toBe(1);

    expect(sentSkillIds()).toStrictEqual([[held.id], [held.id], [abandoned.id]]);
  });
});
