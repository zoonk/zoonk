import { type NextRequest, type NextResponse } from "next/server";
import { type z } from "zod";
import { type ApiKeyInfo, resolveApiKey } from "./_utils/api-key";
import { parseBody } from "./_utils/body-parser";
import { type UserInfo, getUser } from "./_utils/session";
import { errors } from "./api-errors";

type ApiContextBase = {
  req: NextRequest;
  params: Record<string, string>;
  apiKey: ApiKeyInfo;
};

type ApiContextWithUser<TBody = never> = ApiContextBase & { user: UserInfo } & BodyContext<TBody>;

type ApiContextOptionalUser<TBody = never> = ApiContextBase & {
  user: UserInfo | null;
} & BodyContext<TBody>;

type BodyContext<TBody> = [TBody] extends [never] ? object : { body: TBody };

type RouteParams = { params: Promise<Record<string, string>> };

type ConfigWithAuth<TBody = never> = {
  skipAuth?: false;
  skipApiKey?: boolean;
  body?: z.ZodType<TBody>;
};

type ConfigWithoutAuth<TBody = never> = {
  skipAuth: true;
  skipApiKey?: boolean;
  body?: z.ZodType<TBody>;
};

export function apiHandler<TBody = never>(
  config: ConfigWithAuth<TBody>,
  handler: (ctx: ApiContextWithUser<TBody>) => Promise<NextResponse> | NextResponse,
): (req: NextRequest, opts: RouteParams) => Promise<NextResponse>;

export function apiHandler<TBody = never>(
  config: ConfigWithoutAuth<TBody>,
  handler: (ctx: ApiContextOptionalUser<TBody>) => Promise<NextResponse> | NextResponse,
): (req: NextRequest, opts: RouteParams) => Promise<NextResponse>;

export function apiHandler<TBody = never>(
  config: ConfigWithAuth<TBody> | ConfigWithoutAuth<TBody>,
  handler:
    | ((ctx: ApiContextWithUser<TBody>) => Promise<NextResponse> | NextResponse)
    | ((ctx: ApiContextOptionalUser<TBody>) => Promise<NextResponse> | NextResponse),
): (req: NextRequest, opts: RouteParams) => Promise<NextResponse> {
  return async (req: NextRequest, { params }: RouteParams): Promise<NextResponse> => {
    const resolvedParams = await params;

    const apiKeyResult = await resolveApiKey(req, config.skipApiKey);

    if ("error" in apiKeyResult) {
      return apiKeyResult.error;
    }

    const { apiKey } = apiKeyResult;

    const user = await getUser(req);

    if (!config.skipAuth && !user) {
      return errors.unauthorized();
    }

    const baseCtx: ApiContextOptionalUser = { apiKey, params: resolvedParams, req, user };

    if (config.body) {
      const bodyResult = await parseBody(req, config.body);

      if (!bodyResult.success) {
        return errors.validation(bodyResult.error);
      }

      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- function overloads ensure type safety at call sites
      return (handler as (ctx: ApiContextOptionalUser<TBody>) => Promise<NextResponse>)({
        ...baseCtx,
        body: bodyResult.data,
      } as ApiContextOptionalUser<TBody>);
    }

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- function overloads ensure type safety at call sites
    const ctx = baseCtx as ApiContextOptionalUser<TBody>;
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- function overloads ensure type safety at call sites
    return (handler as (ctx: ApiContextOptionalUser<TBody>) => Promise<NextResponse>)(ctx);
  };
}
