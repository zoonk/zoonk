"use server";

import { getLearningTargetHref } from "@/data/courses/learning-target-href";
import { redirect } from "@/i18n/navigation";
import {
  answerCurrentUserCourseDiscovery,
  getCurrentUserCourseDiscovery,
  retryCurrentUserCourseDiscovery,
  reviseCurrentUserCourseDiscovery,
  startCurrentUserCourseDiscovery,
} from "@zoonk/core/courses/discovery";
import {
  type DiscoveryAnswerInput,
  type DiscoveryRevisionInput,
} from "@zoonk/core/courses/discovery-contract";
import { safeAsync } from "@zoonk/utils/error";
import { getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";
import { recoverDiscoveryMutation } from "./discovery-recovery";

export async function readDiscovery(discoveryId: string) {
  return getCurrentUserCourseDiscovery({ discoveryId });
}

export async function answerDiscovery(discoveryId: string, input: DiscoveryAnswerInput) {
  return recoverDiscoveryMutation({
    discoveryId,
    expectedRevision: input.expectedRevision,
    mutation: () => answerCurrentUserCourseDiscovery({ ...input, discoveryId }),
  });
}

export async function retryDiscovery(discoveryId: string) {
  return recoverDiscoveryMutation({
    discoveryId,
    mutation: () => retryCurrentUserCourseDiscovery({ discoveryId }),
  });
}

export async function startDiscovery({
  discoveryId,
  expectedRevision,
  language,
}: {
  discoveryId: string;
  expectedRevision: number;
  language: string;
}) {
  const locale = getSupportedLocaleFromLanguage(language);

  const { data: result, error } = await safeAsync(() =>
    startCurrentUserCourseDiscovery({ discoveryId, expectedRevision }),
  );

  if (error) {
    return { status: "unavailable" as const };
  }

  if (result.status === "generationRequired") {
    const returnTo = encodeURIComponent(`/start/discovery/${discoveryId}`);

    const href =
      result.resource === "coursePrompt"
        ? (`/generate/course/${result.resourceId}?returnTo=${returnTo}` as const)
        : (`/generate/curriculum/${result.resourceId}?returnTo=${returnTo}` as const);

    return redirect({ href, locale });
  }

  if (result.status === "ready" && result.nextTarget) {
    return redirect({ href: getLearningTargetHref(result.nextTarget), locale });
  }

  return result.status === "ready" ? { status: "completed" as const } : result;
}

export async function reviseDiscovery(discoveryId: string, input: DiscoveryRevisionInput) {
  return recoverDiscoveryMutation({
    discoveryId,
    expectedRevision: input.expectedRevision,
    mutation: () => reviseCurrentUserCourseDiscovery({ ...input, discoveryId }),
  });
}
