"use client";

import { useRouter } from "@/i18n/navigation";
import { getFromBrowser, postFromBrowser } from "@/lib/api/browser-api";
import { readRefusedLimit } from "@/lib/api/refused-limit";
import {
  type SkillOutline,
  skillOutlineSchema,
} from "@zoonk/core/lookahead/skill-outline-contract";
import {
  type TopicOutlineActions,
  type TopicOutlineRequestOutcome,
} from "@zoonk/learn/topic-outline";
import { getString } from "@zoonk/utils/json";
import { useMemo } from "react";

const HTTP_UNPROCESSABLE = 422;

function outlinePath({ goalId, skillId }: { goalId: string; skillId: string }) {
  return `/v1/goals/${encodeURIComponent(goalId)}/skills/${encodeURIComponent(skillId)}/outline` as const;
}

async function requestOutline({
  goalId,
  skillId,
}: {
  goalId: string;
  skillId: string;
}): Promise<TopicOutlineRequestOutcome> {
  const response = await postFromBrowser({
    path: `${outlinePath({ goalId, skillId })}/generations`,
  });

  if (!response) {
    return { status: "failed" };
  }

  const body: unknown = await response.json().catch(() => null);
  const limit = readRefusedLimit({ body, status: response.status });

  if (limit) {
    return { limit, status: "refused" };
  }

  if (response.status === HTTP_UNPROCESSABLE) {
    return { status: "unavailable" };
  }

  if (!response.ok) {
    return { status: "failed" };
  }

  return getString(body, "status") === "ready" ? { status: "ready" } : { status: "writing" };
}

async function readOutline({
  goalId,
  skillId,
}: {
  goalId: string;
  skillId: string;
}): Promise<SkillOutline | null> {
  const response = await getFromBrowser(outlinePath({ goalId, skillId }));

  if (!response?.ok) {
    return null;
  }

  const parsed = skillOutlineSchema.safeParse(await response.json().catch(() => null));
  return parsed.success ? parsed.data : null;
}

/** From the browser: a topic's first chapter takes about half a minute, which would hold up the page's Server Actions. */
export function useTopicOutlineActions(goalId: string): TopicOutlineActions {
  const router = useRouter();

  return useMemo(
    () => ({
      read: (skillId) => readOutline({ goalId, skillId }),
      refresh: () => router.refresh(),
      request: (skillId) => requestOutline({ goalId, skillId }),
    }),
    [goalId, router],
  );
}
