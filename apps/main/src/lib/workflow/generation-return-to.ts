export type GenerationReturnTo = `/start/discovery/${string}` | `/tracks/${string}`;

/** Only the two owner-bound setup flows can resume after generation; arbitrary redirect URLs are rejected. */
export function parseGenerationReturnTo(value: unknown): GenerationReturnTo | null {
  if (typeof value !== "string") {
    return null;
  }

  const match =
    /^\/(?<route>start\/discovery|tracks)\/(?<id>[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/u.exec(
      value,
    );

  const id = match?.groups?.id;

  if (!id) {
    return null;
  }

  return match.groups?.route === "tracks" ? `/tracks/${id}` : `/start/discovery/${id}`;
}

export type GenerationBackTo = `/b/${string}/c/${string}/ch/${string}#optional-${string}`;

/** Activity failures can return to their source without changing the successful lesson destination. */
export function parseGenerationBackTo(value: unknown): GenerationBackTo | null {
  if (typeof value !== "string") {
    return null;
  }

  const groups =
    /^\/b\/(?<brand>[a-z0-9-]+)\/c\/(?<course>[a-z0-9-]+)\/ch\/(?<chapter>[a-z0-9-]+)#optional-(?<id>[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/u.exec(
      value,
    )?.groups;

  return groups
    ? `/b/${groups.brand}/c/${groups.course}/ch/${groups.chapter}#optional-${groups.id}`
    : null;
}

export function getGenerationNavigationQuery({
  returnTo,
  backTo,
}: {
  returnTo: GenerationReturnTo | null;
  backTo?: GenerationBackTo | null;
}) {
  if (returnTo) {
    return `?returnTo=${encodeURIComponent(returnTo)}`;
  }

  return backTo ? `?backTo=${encodeURIComponent(backTo)}` : "";
}
