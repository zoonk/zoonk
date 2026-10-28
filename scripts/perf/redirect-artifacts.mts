export type PageMeta = { headers?: Record<string, string | string[]>; status?: number };

const TEMPORARY_REDIRECT = 307;
const PERMANENT_REDIRECT = 308;
const STATUS_FROM_END = -2;

export function hasSetCookie(headers: PageMeta["headers"]): boolean {
  return Object.keys(headers ?? {}).some((name) => name.toLowerCase() === "set-cookie");
}

function redirectDigest(flight: string): string | null {
  const errors = flight.matchAll(/^[\da-f]+:E(?<error>\{.*\})$/gmu);

  for (const error of errors) {
    const payload: unknown = JSON.parse(error.groups?.error ?? "{}");

    if (
      typeof payload === "object" &&
      payload !== null &&
      "digest" in payload &&
      typeof payload.digest === "string" &&
      payload.digest.startsWith("NEXT_REDIRECT;")
    ) {
      return payload.digest;
    }
  }

  return null;
}

function validTarget(target: string): boolean {
  if (!target || !URL.canParse(target, "https://artifact.zoonk.test")) {
    return false;
  }

  const url = new URL(target, "https://artifact.zoonk.test");
  return ["http:", "https:"].includes(url.protocol);
}

export function getRedirectProblems({
  flight,
  meta,
}: {
  flight: string;
  meta: PageMeta;
}): string[] {
  const digest = redirectDigest(flight);

  if (!digest) {
    return ["redirect missing from RSC"];
  }

  const parts = digest.split(";");
  const target = parts.slice(2, STATUS_FROM_END).join(";");
  const status = Number(parts.at(STATUS_FROM_END));

  const location = Object.entries(meta.headers ?? {}).find(
    ([name]) => name.toLowerCase() === "location",
  )?.[1];

  return [
    ![TEMPORARY_REDIRECT, PERMANENT_REDIRECT].includes(meta.status ?? 0) &&
      "invalid redirect status",
    status !== meta.status && "redirect status differs from RSC",
    !["push", "replace"].includes(parts[1] ?? "") && "invalid redirect type",
    (typeof location !== "string" || location !== target) && "redirect target differs from RSC",
    !validTarget(target) && "invalid redirect target",
  ].filter((problem) => problem !== false);
}
