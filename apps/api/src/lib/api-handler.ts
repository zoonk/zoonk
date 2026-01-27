import { auth } from "@zoonk/auth";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { safeAsync } from "@zoonk/utils/error";
import { type NextRequest, type NextResponse } from "next/server";
import { z } from "zod";
import { errors } from "./api-errors";

type ApiKeyInfo = {
  key: string;
  orgSlug: string | null;
  isSystemKey: boolean;
};

type UserInfo = {
  id: number;
  sessionId: number;
};

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

const apiKeyMetadataSchema = z.object({ orgSlug: z.string().optional() }).optional();

async function validateApiKey(req: NextRequest): Promise<ApiKeyInfo | null> {
  const key = req.headers.get("x-api-key");

  if (!key) {
    return null;
  }

  const { data: result } = await safeAsync(() => auth.api.verifyApiKey({ body: { key } }));
  if (!result?.valid || !result.key) {
    return null;
  }

  const parseResult = apiKeyMetadataSchema.safeParse(result.key.metadata);
  const orgSlug = parseResult.success ? (parseResult.data?.orgSlug ?? null) : null;

  return { isSystemKey: orgSlug === AI_ORG_SLUG, key, orgSlug };
}

async function resolveApiKey(
  req: NextRequest,
  skip?: boolean,
): Promise<{ apiKey: ApiKeyInfo } | { error: NextResponse }> {
  if (skip) {
    return { apiKey: { isSystemKey: false, key: "", orgSlug: null } };
  }

  const apiKey = await validateApiKey(req);

  return apiKey ? { apiKey } : { error: errors.invalidApiKey() };
}

async function getUser(req: NextRequest): Promise<UserInfo | null> {
  const { data: session } = await safeAsync(() => auth.api.getSession({ headers: req.headers }));

  if (!session?.user) {
    return null;
  }

  return { id: Number(session.user.id), sessionId: Number(session.session.id) };
}

async function parseBody<TBody>(
  req: NextRequest,
  schema: z.ZodType<TBody>,
): Promise<{ data: TBody; success: true } | { error: z.ZodError; success: false }> {
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- JSON parsing returns unknown
  const { data: json, error } = await safeAsync(() => req.json());

  if (error) {
    return {
      error: new z.ZodError([{ code: "custom", message: "Invalid JSON body", path: [] }]),
      success: false,
    };
  }

  const result = schema.safeParse(json);

  return result.success
    ? { data: result.data, success: true }
    : { error: result.error, success: false };
}

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
