"use client";

import { ContentFeedback } from "@/components/feedback/content-feedback";
import { ClientLink } from "@/i18n/client-link";
import { useRouter } from "next/navigation";
import { type SerializedActivity } from "@zoonk/player/prepare-activity-data";
import { PlayerProvider } from "@zoonk/player/provider";
import { PlayerShell } from "@zoonk/player/shell";
import { submitCompletion } from "./submit-completion-action";

export function ActivityPlayerClient({
  activity,
  lessonHref,
  nextActivityHref,
}: {
  activity: SerializedActivity;
  lessonHref: string;
  nextActivityHref: string | null;
}) {
  const router = useRouter();

  return (
    <PlayerProvider
      activity={activity}
      completionFooter={
        <ContentFeedback
          className="pt-8"
          contentId={activity.id}
          kind="activity"
          variant="minimal"
        />
      }
      lessonHref={lessonHref}
      levelHref="/level"
      linkComponent={ClientLink}
      loginHref="/login"
      nextActivityHref={nextActivityHref}
      onComplete={submitCompletion}
      onEscape={() => router.push(lessonHref)}
      onNext={nextActivityHref ? () => router.push(nextActivityHref) : undefined}
    >
      <PlayerShell />
    </PlayerProvider>
  );
}
