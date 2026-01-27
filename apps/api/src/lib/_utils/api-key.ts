import { auth } from "@zoonk/auth";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { safeAsync } from "@zoonk/utils/error";
import { type NextRequest, type NextResponse } from "next/server";
import { z } from "zod";
import { errors } from "../api-errors";

export type ApiKeyInfo = {
  key: string;
  orgSlug: string | null;
  isSystemKey: boolean;
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

export async function resolveApiKey(
  req: NextRequest,
  skip?: boolean,
): Promise<{ apiKey: ApiKeyInfo } | { error: NextResponse }> {
  if (skip) {
    return { apiKey: { isSystemKey: false, key: "", orgSlug: null } };
  }

  const apiKey = await validateApiKey(req);

  return apiKey ? { apiKey } : { error: errors.invalidApiKey() };
}
