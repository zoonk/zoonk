import "server-only";
import { type CourseLevel, type Skill, prisma } from "@zoonk/db";
import { assertIdentityKeyScope } from "@zoonk/utils/identity-key";
import { normalizeString } from "@zoonk/utils/string";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getSkillCacheTag } from "../../cache/tags";
import {
  type LibraryProvenance,
  createOrFindByIdentity,
  toLibraryVisibility,
  toProvenanceData,
} from "../_utils/library-rows";
import { writePlanInputs } from "../_utils/plan-input-write";
import { lockSkillPlanInputs } from "./_utils/skill-input-write";

export type CreateSkillInput = {
  identityKey: string;
  language: string;
  targetLanguage: string | null;
  name: string;
  description: string;
  example: string | null;
  level: CourseLevel | null;
  ownerId: string | null;
  provenance: LibraryProvenance;
};

/** Internal workflow bridge: derive the owner from the authenticated public boundary. */
export async function createSkill(
  input: CreateSkillInput,
): Promise<{ created: boolean; skill: Skill }> {
  assertIdentityKeyScope({ key: input.identityKey, ownerId: input.ownerId });

  const { created, row } = await createOrFindByIdentity({
    create: () =>
      prisma.skill.create({
        data: {
          description: input.description,
          example: input.example,
          identityKey: input.identityKey,
          language: input.language,
          level: input.level,
          name: input.name,
          normalizedName: normalizeString(input.name),
          targetLanguage: input.targetLanguage,
          ...toLibraryVisibility(input.ownerId),
          ...toProvenanceData(input.provenance),
        },
      }),
    findExisting: () =>
      prisma.skill.findUnique({
        where: { languageIdentity: { identityKey: input.identityKey, language: input.language } },
      }),
  });

  return { created, skill: row };
}

export async function setSkillsPrerequisites({
  among,
  prerequisitesBySkill,
}: {
  among: ReadonlySet<string>;
  prerequisitesBySkill: ReadonlyMap<string, readonly string[]>;
}): Promise<void> {
  const updates = [...prerequisitesBySkill].map(([skillId, prerequisiteIds]) => {
    const kept = new Set(prerequisiteIds.filter((prerequisiteId) => prerequisiteId !== skillId));
    return { kept: [...kept], skillId };
  });

  if (updates.length === 0) {
    return;
  }

  await writePlanInputs(async (tx) => {
    await lockSkillPlanInputs({
      referencedSkillIds: updates.flatMap((update) => update.kept),
      skillIds: updates.map((update) => update.skillId),
      tx,
    });

    await tx.skillPrerequisite.deleteMany({
      where: {
        NOT: {
          OR: updates.map(({ kept, skillId }) => ({ prerequisiteId: { in: kept }, skillId })),
        },
        prerequisiteId: { in: [...among] },
        skillId: { in: updates.map((update) => update.skillId) },
      },
    });

    await tx.skillPrerequisite.createMany({
      data: updates.flatMap(({ kept, skillId }) =>
        kept.map((prerequisiteId) => ({ prerequisiteId, skillId })),
      ),
      skipDuplicates: true,
    });
  });

  revalidateCacheTags(updates.map(({ skillId }) => getSkillCacheTag(skillId)));
}
