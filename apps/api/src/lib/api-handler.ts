import { type NextRequest, type NextResponse } from "next/server";
import { type UserInfo, getUser } from "./_utils/session";
import { errors } from "./api-errors";

type RouteParams = { params: Promise<Record<string, string>> };

export type ApiContext = {
  req: NextRequest;
  params: Record<string, string>;
  user: UserInfo | null;
};

export type ApiContextWithUser = Omit<ApiContext, "user"> & { user: UserInfo };

/**
 * API handler with optional authentication.
 * User is populated if authenticated, null otherwise.
 * Never rejects for missing auth.
 */
export function apiHandler(
  handler: (ctx: ApiContext) => Promise<NextResponse> | NextResponse,
): (req: NextRequest, opts: RouteParams) => Promise<NextResponse> {
  return async (req, { params }) => {
    const user = await getUser(req);

    return handler({
      params: await params,
      req,
      user,
    });
  };
}

/**
 * Handler for protected API routes.
 * Requires authentication.
 */
export function apiHandlerWithAuth(
  handler: (ctx: ApiContextWithUser) => Promise<NextResponse> | NextResponse,
): (req: NextRequest, opts: RouteParams) => Promise<NextResponse> {
  return async (req, { params }) => {
    const user = await getUser(req);

    if (!user) {
      return errors.unauthorized();
    }

    return handler({
      params: await params,
      req,
      user,
    });
  };
}
