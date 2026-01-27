import { type NextRequest, type NextResponse } from "next/server";
import { type ApiKeyInfo, resolveApiKey } from "./_utils/api-key";
import { type UserInfo, getUser } from "./_utils/session";
import { errors } from "./api-errors";

type RouteParams = { params: Promise<Record<string, string>> };

export type ApiContext = {
  req: NextRequest;
  params: Record<string, string>;
  apiKey: ApiKeyInfo;
};

export type ApiContextWithUser = ApiContext & { user: UserInfo };

/**
 * Handler for public API routes.
 * Requires API key only.
 */
export function apiHandler(
  handler: (ctx: ApiContext) => Promise<NextResponse> | NextResponse,
): (req: NextRequest, opts: RouteParams) => Promise<NextResponse> {
  return async (req, { params }) => {
    const apiKeyResult = await resolveApiKey(req);

    if ("error" in apiKeyResult) {
      return apiKeyResult.error;
    }

    return handler({
      apiKey: apiKeyResult.apiKey,
      params: await params,
      req,
    });
  };
}

/**
 * Handler for protected API routes.
 * Requires API key AND auth.
 */
export function apiHandlerWithAuth(
  handler: (ctx: ApiContextWithUser) => Promise<NextResponse> | NextResponse,
): (req: NextRequest, opts: RouteParams) => Promise<NextResponse> {
  return async (req, { params }) => {
    const apiKeyResult = await resolveApiKey(req);

    if ("error" in apiKeyResult) {
      return apiKeyResult.error;
    }

    const user = await getUser(req);

    if (!user) {
      return errors.unauthorized();
    }

    return handler({
      apiKey: apiKeyResult.apiKey,
      params: await params,
      req,
      user,
    });
  };
}
