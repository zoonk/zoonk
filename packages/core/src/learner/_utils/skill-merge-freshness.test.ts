import { type Skill } from "@zoonk/db";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mergeSkillForAdmin } from "../../library/skills/merge-skill";
import { getSession } from "../../users/get-session";
import { readSurvivorOf } from "./plan-library-rows";

// Model a retained shared merge entry: Admin's tag expiry cannot reach Main. Persistence and the
// merge capability stay real; Vitest does not otherwise retain Next's cache entries.
vi.mock("../../library/_utils/shared-rows", async (importOriginal) => {
  const actual = await importOriginal<{
    getMergedSkillRows: (ids: string[]) => Promise<Pick<Skill, "id" | "mergedIntoId">[]>;
  }>();

  const entries = new Map<string, ReturnType<typeof actual.getMergedSkillRows>>();

  return {
    ...actual,
    getMergedSkillRows: (ids: string[]) => {
      const key = JSON.stringify(ids);
      const entry = entries.get(key) ?? actual.getMergedSkillRows(ids);
      entries.set(key, entry);
      return entry;
    },
  };
});

describe("skill merges across apps", () => {
  it("resolves a planned skill to its survivor after Admin merges it", async () => {
    const [duplicate, survivor, admin] = await Promise.all([
      skillFixture(),
      skillFixture(),
      userFixture({ role: "admin" }),
    ]);

    const before = await readSurvivorOf([duplicate.id], "shared");
    expect(before(duplicate.id)).toBe(duplicate.id);

    vi.mocked(getSession).mockResolvedValue(
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- This capability only reads the session's trusted identity and role.
      { user: { id: admin.id, role: "admin" } } as Awaited<ReturnType<typeof getSession>>,
    );

    await expect(
      mergeSkillForAdmin({ duplicateId: duplicate.id, survivorId: survivor.id }),
    ).resolves.toMatchObject({ status: "merged" });

    const after = await readSurvivorOf([duplicate.id], "shared");
    expect(after(duplicate.id)).toBe(survivor.id);
  });
});
