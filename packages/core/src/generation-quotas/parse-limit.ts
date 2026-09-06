import { getString, isJsonObject } from "@zoonk/utils/json";
import {
  type GenerationQuotaLimit,
  type GenerationQuotaPeriod,
  type GenerationQuotaResource,
  type GenerationQuotaViewer,
} from "./contract";

const GENERATION_QUOTA_PERIODS = new Set<string>(["day", "month"]);

const GENERATION_QUOTA_RESOURCES = new Set<string>([
  "chapter",
  "course",
  "lesson",
  "lessonQuestion",
]);

const GENERATION_QUOTA_VIEWERS = new Set<string>(["authenticated", "guest", "subscriber"]);

/** Narrows the API value to one reset period understood by the quota UI. */
function isGenerationQuotaPeriod(value: string | null): value is GenerationQuotaPeriod {
  return value !== null && GENERATION_QUOTA_PERIODS.has(value);
}

/** Narrows the API value to one generated resource understood by the quota UI. */
function isGenerationQuotaResource(value: string | null): value is GenerationQuotaResource {
  return value !== null && GENERATION_QUOTA_RESOURCES.has(value);
}

/** Narrows the API value to one entitlement understood by the quota UI. */
function isGenerationQuotaViewer(value: string | null): value is GenerationQuotaViewer {
  return value !== null && GENERATION_QUOTA_VIEWERS.has(value);
}

/** Reads the standard API error envelope without trusting an arbitrary JSON object shape. */
function getGenerationLimitDetails(body: unknown): unknown {
  if (!isJsonObject(body) || !isJsonObject(body.error)) {
    return null;
  }

  return getString(body.error, "code") === "GENERATION_LIMIT_REACHED" ? body.error.details : null;
}

/** Narrows a structured 429 response into the quota context needed by the reached-limit UI. */
export function getGenerationLimit(body: unknown): GenerationQuotaLimit | null {
  const details = getGenerationLimitDetails(body);

  if (!isJsonObject(details)) {
    return null;
  }

  const period = getString(details, "period");
  const resource = getString(details, "resource");
  const viewer = getString(details, "viewer");

  if (
    !isGenerationQuotaPeriod(period) ||
    !isGenerationQuotaResource(resource) ||
    !isGenerationQuotaViewer(viewer)
  ) {
    return null;
  }

  return { period, resource, viewer };
}
