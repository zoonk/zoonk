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

export type CreateSkillInput = {
  /** The key `resolveLibraryIdentity` returned with its `generate` outcome. */
  identityKey: string;
  language: string;
  targetLanguage: string | null;
  name: string;
  /** The idea in one sentence: the front of the skill's study card. */
  description: string;
  /** A worked example: the back of the study card. */
  example: string | null;
  level: CourseLevel | null;
  /** The owner of a private course's skill: the skill is private to them and never reused. */
  ownerId: string | null;
  provenance: LibraryProvenance;
};

/**
 * Creates a skill for a curriculum workflow, or returns the one a concurrent
 * request created under the same identity, so two curricula that need the same
 * ability share one skill and its lessons.
 *
 * This is a workflow bridge, not an app authorization boundary: it accepts an
 * owner id only because the public core boundary that started the workflow
 * derived it from the authenticated session.
 */
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

/**
 * Records skills learned before `skillId`. Existing edges are kept, and a
 * skill never becomes its own prerequisite.
 */
export async function addSkillPrerequisites({
  prerequisiteIds,
  skillId,
}: {
  prerequisiteIds: string[];
  skillId: string;
}): Promise<void> {
  const edges = [...new Set(prerequisiteIds)]
    .filter((prerequisiteId) => prerequisiteId !== skillId)
    .map((prerequisiteId) => ({ prerequisiteId, skillId }));

  await prisma.skillPrerequisite.createMany({ data: edges, skipDuplicates: true });

  revalidateCacheTags([getSkillCacheTag(skillId)]);
}
