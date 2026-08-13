import { type GenerationQuotaLimit } from "@zoonk/core/generation-quotas/contract";
import { type Page, type Route } from "@zoonk/e2e/fixtures";
import { isJsonObject } from "@zoonk/utils/json";

type GenerationRouteHandler = (route: Route) => Promise<void>;
type GenerationTargetType = "chapter" | "coursePrompt" | "lesson";

export type GenerationTriggerResponse = {
  body?: unknown;
  error?: string;
  id?: string;
  status?: number;
};

/** Builds the public API error envelope that drives the reached-limit experience. */
export function getGenerationLimitResponse(limit: GenerationQuotaLimit): GenerationTriggerResponse {
  return {
    body: {
      error: {
        code: "GENERATION_LIMIT_REACHED",
        details: limit,
        message: "Generation limit reached",
      },
    },
    status: 429,
  };
}

/**
 * Identifies a generation command for one target type. Inspecting the body is
 * necessary because every generation now shares the same canonical collection.
 */
export function isGenerationTrigger({
  request,
  targetType,
}: {
  request: ReturnType<Route["request"]>;
  targetType: GenerationTargetType;
}) {
  if (request.method() !== "POST" || new URL(request.url()).pathname !== "/v1/generations") {
    return false;
  }

  const body: unknown = request.postDataJSON();

  return isJsonObject(body) && isJsonObject(body.target) && body.target.type === targetType;
}

/**
 * Identifies the canonical generation event stream independently of its target.
 */
export function isGenerationEvents(url: string) {
  return /^\/v1\/generations\/[^/]+\/events$/u.test(new URL(url).pathname);
}

/**
 * Intercepts the generation collection and its child resources with one
 * handler, matching the single public resource exposed by the API.
 */
export async function routeGenerationApis({
  handler,
  page,
}: {
  handler: GenerationRouteHandler;
  page: Page;
}) {
  await Promise.all([
    page.route("**/v1/generations", handler),
    page.route("**/v1/generations/**", handler),
  ]);
}
