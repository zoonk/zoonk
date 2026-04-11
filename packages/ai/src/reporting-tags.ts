const TASK_TAG_PREFIX = "task:";
const DEFAULT_MODEL_TAG_PREFIX = "default-model:";

/**
 * Gateway reporting filters use one task tag per generation so every admin view
 * can group requests by the logical AI task instead of by prompt file names or
 * call sites spread across the app.
 */
export function buildGatewayTaskTag(taskName: string): string {
  return `${TASK_TAG_PREFIX}${taskName}`;
}

/**
 * Fallback-enabled requests always carry the task tag and the default-model tag.
 * Keeping this pair in one helper prevents the two call sites from drifting.
 */
export function buildGatewayReportingTags({
  model,
  taskName,
}: {
  model: string;
  taskName: string;
}): string[] {
  return [buildGatewayTaskTag(taskName), `${DEFAULT_MODEL_TAG_PREFIX}${model}`];
}

/**
 * Admin reporting receives raw Gateway tag strings. This parser extracts only
 * task tags and ignores every other reporting dimension that might be added.
 */
export function extractGatewayTaskName(tag?: string): string | null {
  if (!tag?.startsWith(TASK_TAG_PREFIX)) {
    return null;
  }

  return tag.slice(TASK_TAG_PREFIX.length);
}

/**
 * The admin fallback view compares the actual model row against the configured
 * default-model tag. This parser keeps that comparison logic independent from
 * the raw tag prefix.
 */
export function extractGatewayDefaultModel(tag?: string): string | null {
  if (!tag?.startsWith(DEFAULT_MODEL_TAG_PREFIX)) {
    return null;
  }

  return tag.slice(DEFAULT_MODEL_TAG_PREFIX.length);
}
