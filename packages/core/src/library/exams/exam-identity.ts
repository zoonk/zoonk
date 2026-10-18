import "server-only";
import { type ExamBlueprint, prisma } from "@zoonk/db";
import { normalizeIdentityText, scopeIdentityKey } from "@zoonk/utils/identity-key";

/** What makes two exams the same: its name and, for public-service exams, the role. */
export type ExamIdentity = {
  board: string | null;
  country: string;
  language: string;
  name: string;
  /**
   * The learner whose private material the blueprint was read from, such as a
   * teacher's slides for a school exam. Their blueprint is private, lives in
   * their own key space and is deleted with them.
   */
  ownerId: string | null;
  role: string | null;
};

/**
 * One canonical key per exam, such as `enem` or `banco-do-brasil-escriturario`.
 * The board and the year aren't part of it: a board can change between
 * editions, and an edition is metadata on the same blueprint.
 */
export function buildExamIdentityKey({
  name,
  ownerId,
  role,
}: {
  name: string;
  ownerId: string | null;
  role: string | null;
}): string {
  return scopeIdentityKey({
    key: normalizeIdentityText([name, role].filter(Boolean).join(" ")),
    ownerId,
  });
}

export function findExamBlueprintByKey({
  identityKey,
  language,
}: {
  identityKey: string;
  language: string;
}): Promise<ExamBlueprint | null> {
  return prisma.examBlueprint.findUnique({
    where: { languageIdentity: { identityKey, language } },
  });
}

/**
 * The identity of a stored shared blueprint, so a freshness check can read its
 * new notice under the same key. Blueprints from private material have none:
 * they come from uploads, which never change.
 */
export async function getSharedExamIdentity(examBlueprintId: string): Promise<ExamIdentity | null> {
  const blueprint = await prisma.examBlueprint.findUnique({
    select: {
      board: true,
      country: true,
      language: true,
      name: true,
      role: true,
      visibility: true,
    },
    where: { id: examBlueprintId },
  });

  if (!blueprint || blueprint.visibility !== "public") {
    return null;
  }

  return {
    board: blueprint.board,
    country: blueprint.country,
    language: blueprint.language,
    name: blueprint.name,
    ownerId: null,
    role: blueprint.role,
  };
}

/**
 * A shared exam with the notice its stored reading came from, for reading that notice again when
 * an admin asks (the only way a stored reading is redone). Null when the exam isn't shared or was
 * never read from a stored notice.
 */
export async function getSharedExamNotice(
  examBlueprintId: string,
): Promise<{ identity: ExamIdentity; sourceId: string } | null> {
  const [identity, blueprint] = await Promise.all([
    getSharedExamIdentity(examBlueprintId),
    prisma.examBlueprint.findUnique({ select: { sourceId: true }, where: { id: examBlueprintId } }),
  ]);

  return identity && blueprint?.sourceId ? { identity, sourceId: blueprint.sourceId } : null;
}
