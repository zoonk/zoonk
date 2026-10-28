import "server-only";
import { isPrismaUniqueConstraintError } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";

export type LibraryProvenance = {
  model: string;
  promptVersion: string;
  runId: string;
  generatedAt: Date | string;
};

export function toProvenanceData(provenance: LibraryProvenance) {
  return {
    generatedAt: new Date(provenance.generatedAt),
    model: provenance.model,
    promptVersion: provenance.promptVersion,
    runId: provenance.runId,
  };
}

export function toLibraryVisibility(ownerId: string | null) {
  return { ownerId, visibility: ownerId ? ("private" as const) : ("public" as const) };
}

const CREATE_ATTEMPTS = 2;

/** `created: true` gives the caller ownership of generating the row's content. */
export async function createOrFindByIdentity<T>({
  attempt = 1,
  create,
  findExisting,
}: {
  attempt?: number;
  create: () => Promise<T>;
  findExisting: () => Promise<T | null>;
}): Promise<{ created: boolean; row: T }> {
  const existing = await findExisting();

  if (existing) {
    return { created: false, row: existing };
  }

  const result = await safeAsync(create);

  if (!result.error) {
    return { created: true, row: result.data };
  }

  if (!isPrismaUniqueConstraintError(result.error)) {
    throw result.error;
  }

  const winner = await findExisting();

  if (winner) {
    return { created: false, row: winner };
  }

  if (attempt >= CREATE_ATTEMPTS) {
    throw result.error;
  }

  return createOrFindByIdentity({ attempt: attempt + 1, create, findExisting });
}
