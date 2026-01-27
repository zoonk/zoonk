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

type ApiContextWithUser = {
  req: NextRequest;
  params: Record<string, string>;
  apiKey: ApiKeyInfo;
  user: UserInfo;
};

type ApiContextOptionalUser = {
  req: NextRequest;
  params: Record<string, string>;
  apiKey: ApiKeyInfo;
  user: UserInfo | null;
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

  return {
    isSystemKey: orgSlug === AI_ORG_SLUG,
    key,
    orgSlug,
  };
}

async function getUser(req: NextRequest): Promise<UserInfo | null> {
  const { data: session } = await safeAsync(() => auth.api.getSession({ headers: req.headers }));
  if (!session?.user) {
    return null;
  }

  return {
    id: Number(session.user.id),
    sessionId: Number(session.session.id),
  };
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
  if (!result.success) {
    return { error: result.error, success: false };
  }
  return { data: result.data, success: true };
}

type RouteParams = { params: Promise<Record<string, string>> };

type ConfigWithAuth = {
  skipAuth?: false;
  skipApiKey?: boolean;
};

type ConfigWithoutAuth = {
  skipAuth: true;
  skipApiKey?: boolean;
};

export function apiHandler(
  config: ConfigWithAuth,
  handler: (ctx: ApiContextWithUser) => Promise<NextResponse> | NextResponse,
): (req: NextRequest, opts: RouteParams) => Promise<NextResponse>;

export function apiHandler(
  config: ConfigWithoutAuth,
  handler: (ctx: ApiContextOptionalUser) => Promise<NextResponse> | NextResponse,
): (req: NextRequest, opts: RouteParams) => Promise<NextResponse>;

export function apiHandler(
  config: ConfigWithAuth | ConfigWithoutAuth,
  handler:
    | ((ctx: ApiContextWithUser) => Promise<NextResponse> | NextResponse)
    | ((ctx: ApiContextOptionalUser) => Promise<NextResponse> | NextResponse),
): (req: NextRequest, opts: RouteParams) => Promise<NextResponse> {
  return async (req: NextRequest, { params }: RouteParams): Promise<NextResponse> => {
    const resolvedParams = await params;

    let apiKey: ApiKeyInfo = { isSystemKey: false, key: "", orgSlug: null };
    if (!config.skipApiKey) {
      const validatedKey = await validateApiKey(req);
      if (!validatedKey) {
        return errors.invalidApiKey();
      }
      apiKey = validatedKey;
    }

    const user = await getUser(req);
    if (!config.skipAuth && !user) {
      return errors.unauthorized();
    }

    const ctx: ApiContextOptionalUser = {
      apiKey,
      params: resolvedParams,
      req,
      user,
    };

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- function overloads ensure type safety at call sites
    return (handler as (ctx: ApiContextOptionalUser) => Promise<NextResponse> | NextResponse)(ctx);
  };
}

export function apiHandlerWithBody<TBody>(
  config: ConfigWithAuth & { body: z.ZodType<TBody> },
  handler: (ctx: ApiContextWithUser & { body: TBody }) => Promise<NextResponse> | NextResponse,
): (req: NextRequest, opts: RouteParams) => Promise<NextResponse>;

export function apiHandlerWithBody<TBody>(
  config: ConfigWithoutAuth & { body: z.ZodType<TBody> },
  handler: (ctx: ApiContextOptionalUser & { body: TBody }) => Promise<NextResponse> | NextResponse,
): (req: NextRequest, opts: RouteParams) => Promise<NextResponse>;

export function apiHandlerWithBody<TBody>(
  config: (ConfigWithAuth | ConfigWithoutAuth) & { body: z.ZodType<TBody> },
  handler:
    | ((ctx: ApiContextWithUser & { body: TBody }) => Promise<NextResponse> | NextResponse)
    | ((ctx: ApiContextOptionalUser & { body: TBody }) => Promise<NextResponse> | NextResponse),
): (req: NextRequest, opts: RouteParams) => Promise<NextResponse> {
  return async (req: NextRequest, { params }: RouteParams): Promise<NextResponse> => {
    const resolvedParams = await params;

    let apiKey: ApiKeyInfo = { isSystemKey: false, key: "", orgSlug: null };
    if (!config.skipApiKey) {
      const validatedKey = await validateApiKey(req);
      if (!validatedKey) {
        return errors.invalidApiKey();
      }
      apiKey = validatedKey;
    }

    const user = await getUser(req);
    if (!config.skipAuth && !user) {
      return errors.unauthorized();
    }

    const bodyResult = await parseBody(req, config.body);
    if (!bodyResult.success) {
      return errors.validation(bodyResult.error);
    }

    const ctx: ApiContextOptionalUser & { body: TBody } = {
      apiKey,
      body: bodyResult.data,
      params: resolvedParams,
      req,
      user,
    };

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- function overloads ensure type safety at call sites
    return (handler as (ctx: ApiContextOptionalUser & { body: TBody }) => Promise<NextResponse>)(
      ctx,
    );
  };
}
