const POSTHOG_DEFAULTS = "2026-05-30" as const;

export const POSTHOG_SYSTEM_DISTINCT_ID = "zoonk-system";

type PostHogConfig = { defaults: typeof POSTHOG_DEFAULTS; host: string; projectToken: string };

export function getPostHogConfig(): PostHogConfig | null {
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

  if (!host || !projectToken) {
    return null;
  }

  return { defaults: POSTHOG_DEFAULTS, host, projectToken };
}
