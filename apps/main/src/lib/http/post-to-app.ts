import { checkIdentity } from "@/lib/learner/learner-identity";
import { safeAsync } from "@zoonk/utils/error";
import { noteAppWrite } from "./app-write-ledger";

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
  // A page that no longer belongs to the learner the browser holds sends nothing: it's reloading.
  if (!checkIdentity()) {
    return null;
  }

  const { data } = await safeAsync(async () => {
    const response = await fetch(path, toRequest(body));

    if (!response.ok) {
      return null;
    }

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Main's own route answers with this shape.
    return (await response.json()) as Outcome;
  });

  // An answer that arrives after another learner signed in reaches nothing: the page is reloading.
  return checkIdentity() ? (data ?? null) : null;
}

/**
 * Posts to one of this app's own routes (`appPostRoute`) from the browser and reads the outcome it
 * answers with. These run alongside each other instead of queuing like Server Actions, and never
 * re-render the page (the screen refreshes once when it closes: `useRefreshAfterAppWrites`). Null
 * when the request didn't get through (offline, a server error), or when the page no longer belongs
 * to the learner the browser holds, before it sends or once its answer is in.
 */
export function postToApp<Outcome>({
  body,
  path,
}: {
  body: unknown;
  path: `/api/${string}`;
}): Promise<Outcome | null> {
  return noteAppWrite(send<Outcome>({ body, path }));
}
