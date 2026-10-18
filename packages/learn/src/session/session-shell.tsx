"use client";

import { TaskBody } from "../_components/task-layout";
import { SessionFrame } from "./session-frame";
import { SessionHeader } from "./session-header";
import { useSessionQueueAside } from "./session-queue";

const NO_QUEUE = { minutesLeft: 0, rows: [] };

/**
 * The session screen before its step is known: leave on the left, "Today's session" as its title,
 * and the aside's place from `lg`, with no bar and nothing in the column. A hard load paints it
 * until the day streams into the same response, and a tap made where no day was shown (the
 * palette's Continue) until its step arrives. Never a placeholder: what arrives takes the column
 * without moving the title.
 */
export function SessionShell({ exitHref }: { exitHref: string }) {
  const aside = useSessionQueueAside(NO_QUEUE);

  return (
    <SessionFrame aside={aside}>
      <SessionHeader exitHref={exitHref} />
      <TaskBody />
    </SessionFrame>
  );
}
