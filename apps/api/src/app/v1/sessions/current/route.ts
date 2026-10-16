import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { deleteCurrentSession, renewCurrentSession } from "@zoonk/auth/native-sessions";
import { safeAsync } from "@zoonk/utils/error";
import { type NextRequest } from "next/server";

/** Only a client signed in with cookies has any to change; a bearer app gets none to keep. */
function getClientCookieHeaders({ headers, request }: { headers: Headers; request: NextRequest }) {
  if (!request.headers.has("cookie")) {
    return;
  }

  const responseHeaders = new Headers();

  for (const cookie of headers.getSetCookie()) {
    responseHeaders.append("Set-Cookie", cookie);
  }

  return responseHeaders;
}

async function deleteCurrentSessionRoute(request: NextRequest) {
  const { data: session, error } = await safeAsync(() =>
    deleteCurrentSession({ headers: request.headers, requestURL: request.url }),
  );

  if (error) {
    throw error;
  }

  return new Response(null, {
    headers: getClientCookieHeaders({ headers: session.headers, request }),
    status: 204,
  });
}

/**
 * Keeps an app's session going while it's used: the app asks once a day, and the session slides
 * forward when it's at least a day old. Reads never renew a session, so this write is
 * the only way an app's session lasts past its first 30 days.
 */
async function renewCurrentSessionRoute(request: NextRequest) {
  const renewal = await renewCurrentSession({ headers: request.headers, requestURL: request.url });

  if (!renewal) {
    return errors.unauthorized();
  }

  return new Response(null, {
    headers: getClientCookieHeaders({ headers: renewal.headers, request }),
    status: 204,
  });
}

export const DELETE = withApiErrorBoundary(deleteCurrentSessionRoute);
export const PATCH = withApiErrorBoundary(renewCurrentSessionRoute);
