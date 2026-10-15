"use client";

import { useRouter } from "@/i18n/navigation";
import { getFromBrowser, postFromBrowser, readJsonForThisLearner } from "@/lib/api/browser-api";
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

/** Asks the API for a far topic's lessons: `POST .../outline/generations`, on the learner's tap. */
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

  const body = await readJsonForThisLearner(response);
  const limit = readRefusedLimit({ body, status: response.status });

  if (limit) {
    return { limit, status: "refused" };
  }

  if (response.status === HTTP_UNPROCESSABLE) {
    return { status: "unavailable" };
  }

  // No body is no answer: the route always says the status, and a body read once the page
  // belonged to someone else is dropped.
  if (!response.ok || body === null) {
    return { status: "failed" };
  }

  return getString(body, "status") === "ready" ? { status: "ready" } : { status: "writing" };
}

/** A far topic's lesson plan from the API, for the sheet that waits while it's written. */
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

  const parsed = skillOutlineSchema.safeParse(await readJsonForThisLearner(response));
  return parsed.success ? parsed.data : null;
}

/**
 * A goal's far topics as main's screens open them: through the public API from the browser (a
 * topic's first chapter takes about half a minute, so it never holds up the page's Server
 * Actions), then the page is read again to show its chapters in the plan.
 */
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
