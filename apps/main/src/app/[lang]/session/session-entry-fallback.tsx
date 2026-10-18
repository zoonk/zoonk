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

/**
 * The step the learner just tapped on another screen, drawn from what that screen held while the
 * session screen's own content is on its way: the day's segments, "Up next", the step's title and
 * minutes, and its Start busy (with the focus the tapped control had, and its wait line counting
 * from the tap). Only for the identity, the page and the day the tap was made for; the bare frame
 * otherwise. It applies nothing: the screen's content does, once it arrives.
 */
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
          // After a failed tap, Start taps again from here, the same way.
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

/**
 * The session screen's frame while its content is on its way: the tapped step when a tap brought
 * the learner here (`HeldStep`), otherwise the frame itself (a hard load, or a tap where no day
 * was shown), with no placeholder either way. The server and a fresh document hold no tap.
 */
export function SessionEntryFallback() {
  const entry = useDayEntry();
  return entry ? <HeldStep entry={entry} /> : <SessionShell exitHref={EXIT_HREF} />;
}
