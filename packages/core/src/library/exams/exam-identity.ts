import "server-only";
import { type ExamBlueprint, prisma } from "@zoonk/db";
import { normalizeIdentityText, scopeIdentityKey } from "@zoonk/utils/identity-key";

export type ExamIdentity = {
  board: string | null;
  country: string;
  language: string;
  name: string;
  ownerId: string | null;
  role: string | null;
};

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

export async function getSharedExamNotice(
  examBlueprintId: string,
): Promise<{ identity: ExamIdentity; sourceId: string } | null> {
  const [identity, blueprint] = await Promise.all([
    getSharedExamIdentity(examBlueprintId),
    prisma.examBlueprint.findUnique({ select: { sourceId: true }, where: { id: examBlueprintId } }),
  ]);

  return identity && blueprint?.sourceId ? { identity, sourceId: blueprint.sourceId } : null;
}
