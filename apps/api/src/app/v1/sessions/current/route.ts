import { withApiErrorBoundary } from "@/lib/api-handler";
import { deleteCurrentSession } from "@zoonk/auth/native-sessions";
import { safeAsync } from "@zoonk/utils/error";
import { type NextRequest } from "next/server";

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

export const DELETE = withApiErrorBoundary(deleteCurrentSessionRoute);
