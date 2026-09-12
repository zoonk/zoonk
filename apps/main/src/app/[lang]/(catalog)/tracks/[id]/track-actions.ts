"use server";

import { getLearningTargetHref } from "@/data/courses/learning-target-href";
import { redirect } from "@/i18n/navigation";
import { type TrackUpdateInput } from "@zoonk/core/courses/track-contract";
import {
  removeCurrentUserTrack,
  startCurrentUserTrack,
  updateCurrentUserTrack,
} from "@zoonk/core/courses/tracks";
import { safeAsync } from "@zoonk/utils/error";
import { getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";

export async function startTrack({ trackId, language }: { trackId: string; language: string }) {
  const locale = getSupportedLocaleFromLanguage(language);
  const { data: result, error } = await safeAsync(() => startCurrentUserTrack({ trackId }));

  if (error) {
    return { status: "unavailable" as const };
  }

  if (result.status === "needsPlan") {
    return redirect({ href: `/b/${result.brandSlug}/c/${result.courseSlug}/start`, locale });
  }

  if (result.status === "generationRequired") {
    const returnTo = encodeURIComponent(`/tracks/${trackId}`);

    const href =
      result.resource === "coursePrompt"
        ? (`/generate/course/${result.resourceId}?returnTo=${returnTo}` as const)
        : (`/generate/curriculum/${result.resourceId}?returnTo=${returnTo}` as const);

    return redirect({ href, locale });
  }

  if (result.status === "ready" && result.nextTarget) {
    return redirect({ href: getLearningTargetHref(result.nextTarget), locale });
  }

  return { status: result.status === "ready" ? ("completed" as const) : result.status };
}

export async function updateTrack({
  trackId,
  input,
  language,
}: {
  trackId: string;
  input: TrackUpdateInput;
  language: string;
}) {
  const locale = getSupportedLocaleFromLanguage(language);
  const { data: result, error } = await safeAsync(() => updateCurrentUserTrack({ input, trackId }));

  if (error || result.status !== "ready") {
    return { status: "unavailable" as const };
  }

  return redirect({ href: `/tracks/${trackId}`, locale });
}

export async function removeTrack({ trackId, language }: { trackId: string; language: string }) {
  const locale = getSupportedLocaleFromLanguage(language);
  const { data: result, error } = await safeAsync(() => removeCurrentUserTrack({ trackId }));

  if (error || result.status !== "removed") {
    return { status: "unavailable" as const };
  }

  return redirect({ href: "/my", locale });
}
