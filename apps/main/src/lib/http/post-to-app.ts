import { safeAsync } from "@zoonk/utils/error";

function toRequest(body: unknown): RequestInit {
  if (body instanceof FormData) {
    return { body, method: "POST" };
  }

  return {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  };
}

/** Null when the request didn't get through: offline, or a server error. */
export async function postToApp<Outcome>({
  body,
  keepalive,
  path,
}: {
  body: unknown;
  keepalive?: boolean;
  path: `/api/${string}`;
}): Promise<Outcome | null> {
  const { data } = await safeAsync(async () => {
    const response = await fetch(path, { ...toRequest(body), keepalive });

    if (!response.ok) {
      return null;
    }

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Main's own route answers with this shape.
    return (await response.json()) as Outcome;
  });

  return data ?? null;
}
