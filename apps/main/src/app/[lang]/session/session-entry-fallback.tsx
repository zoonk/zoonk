"use client";

import { useRouter } from "@/i18n/navigation";
import { type DayEntry } from "@/lib/session/day-entry";
import { useDayEntry, useDayTap } from "@/lib/session/use-day-entry";
import { useDayTaps } from "@/lib/session/use-day-taps";
import { useStudyNavigation } from "@/lib/session/use-study-navigation";
import { WorkflowRunFollower } from "@/lib/workflow/workflow-run-follower";
import { GenerationFollowerProvider } from "@zoonk/learn/generation/follower";
import { NextStop } from "@zoonk/learn/session/next-stop";
import { SessionShell } from "@zoonk/learn/session/shell";
import { useCallback } from "react";

const EXIT_HREF = "/today";

/** Only for the identity, page and day the tap was made for. It applies nothing; the screen's content does. */
function HeldStep({ entry }: { entry: DayEntry }) {
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);
  const taps = useDayTaps({ day: entry.day, refresh });
  const navigation = useStudyNavigation(entry.day.sessionId ?? "");
  const { shown } = entry.day;

  const held = useDayTap({
    blocks: shown.day.blocks,
    goalId: shown.goalId,
    localDate: shown.day.localDate,
  });

  if (!held) {
    return <SessionShell exitHref={EXIT_HREF} />;
  }

  return (
    <GenerationFollowerProvider follower={WorkflowRunFollower}>
      <NextStop
        actions={{
          refresh,
          start: () => (entry.next ? taps.next(entry.step) : taps.open(entry.step)),
          stop: navigation.stop,
        }}
        alternative={null}
        block={held.step}
        blocks={shown.day.blocks}
        exitHref={EXIT_HREF}
        generationId={null}
        lesson="ready"
        lessonsComing={shown.day.lessonsComing}
        notWritten={null}
        sessionBar={shown.day.sessionBar}
        tap={held.tap}
      />
    </GenerationFollowerProvider>
  );
}

export function SessionEntryFallback() {
  const entry = useDayEntry();
  return entry ? <HeldStep entry={entry} /> : <SessionShell exitHref={EXIT_HREF} />;
}
