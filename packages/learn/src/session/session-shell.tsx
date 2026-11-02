"use client";

import { TaskBody } from "../_components/task-layout";
import { SessionFrame } from "./session-frame";
import { SessionHeader } from "./session-header";
import { useSessionQueueAside } from "./session-queue";

const NO_QUEUE = { minutesLeft: 0, rows: [] };

export function SessionShell({ exitHref }: { exitHref: string }) {
  const aside = useSessionQueueAside(NO_QUEUE);

  return (
    <SessionFrame aside={aside}>
      <SessionHeader exitHref={exitHref} />
      <TaskBody />
    </SessionFrame>
  );
}
