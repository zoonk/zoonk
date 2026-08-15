import { withApiErrorBoundary } from "@/lib/api-handler";
import { deleteCurrentSession } from "@zoonk/auth/native-sessions";
import { safeAsync } from "@zoonk/utils/error";
import { type NextRequest } from "next/server";

function getCookieDeletionHeaders(headers: Headers) {
  const responseHeaders = new Headers();

  for (const cookie of headers.getSetCookie()) {
    responseHeaders.append("Set-Cookie", cookie);
  }

  return responseHeaders;
}

async function deleteCurrentSessionRoute(request: NextRequest) {
  const { data: session, error } = await safeAsync(() =>
    deleteCurrentSession({ headers: request.headers }),
  );

  if (error) {
    throw error;
  }

  return new Response(null, { headers: getCookieDeletionHeaders(session.headers), status: 204 });
}

export const DELETE = withApiErrorBoundary(deleteCurrentSessionRoute);
