import "server-only";
import { isPrismaUniqueConstraintError } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";

/**
 * What every generated Library row stores about the AI task run that wrote it
 * (the task's provenance, not the workflow's claim run id).
 */
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

/** Content made for one learner's too-specific goal is private to that learner. */
export function toLibraryVisibility(ownerId: string | null) {
  return { ownerId, visibility: ownerId ? ("private" as const) : ("public" as const) };
}

/**
 * Slugs only need to be unique inside their home (an owner, course or chapter), so a repeated
 * title gets the first free numbered suffix there.
 */
export function pickAvailableSlug({
  base,
  taken,
}: {
  base: string;
  taken: readonly string[];
}): string {
  const takenSlugs = new Set(taken);

  if (!takenSlugs.has(base)) {
    return base;
  }

  const suffix = Array.from({ length: takenSlugs.size + 1 }, (_, index) => index + 2).find(
    (candidate) => !takenSlugs.has(`${base}-${candidate}`),
  );

  return `${base}-${suffix}`;
}

/** One retry covers a slug taken by a different item between reading free slugs and inserting. */
const CREATE_ATTEMPTS = 2;

/**
 * Creates a row under its identity key, or returns the row another request
 * created first. The unique `(language, identityKey)` constraint is the lock:
 * two workflows racing on one key both end up with the same row, and `created`
 * tells the caller whether it owns generating that row's content.
 */
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
