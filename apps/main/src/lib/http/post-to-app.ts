import { safeAsync } from "@zoonk/utils/error";

/** A recording goes as multipart (the browser sets its boundary), anything else as JSON. */
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

async function send<Outcome>({ body, path }: { body: unknown; path: string }) {
  const { data } = await safeAsync(async () => {
    const response = await fetch(path, toRequest(body));

    if (!response.ok) {
      return null;
    }

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Main's own route answers with this shape.
    return (await response.json()) as Outcome;
  });

  return data ?? null;
}

/**
 * Posts to one of this app's own routes (`appPostRoute`) from the browser and reads the outcome it
 * answers with. These run alongside each other instead of queuing like Server Actions, and never
 * re-render the page (the pages read again once the learner leaves it: `noteAppWritesSent`). Null
 * when the request didn't get through: offline, or a server error.
 */
export function postToApp<Outcome>({
  body,
  path,
}: {
  body: unknown;
  path: `/api/${string}`;
}): Promise<Outcome | null> {
  return send<Outcome>({ body, path });
}
