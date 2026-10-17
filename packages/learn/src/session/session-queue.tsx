"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import {
  ListGroup,
  ListRow,
  ListRowContent,
  ListRowLeading,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import { TaskAsideContent, TaskAsideHeader } from "../_components/task-layout";
import { useFormatDuration } from "../_utils/time-format";
import { type TaskFrameAside } from "../shell/task-frame";
import { BlockMark } from "./block-mark";
import { type SessionQueueRow, type getSessionQueue } from "./session-queue-rows";
import { useBlockTitle } from "./use-block-copy";

/**
 * The day's blocks as Today lists them: each one's mark (`BlockMark`), its name and its minutes in
 * the mono face; the done ones with the done mark and a quiet name, the next one highlighted.
 */
function SessionQueue({ rows }: { rows: readonly SessionQueueRow[] }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const blockTitle = useBlockTitle();

  return (
    <ListGroup role="list">
      {rows.map(({ block, state }) => (
        <ListRow
          aria-current={state === "next" ? "step" : undefined}
          data-state={state}
          key={block.position}
          role="listitem"
        >
          <ListRowLeading className="w-3 justify-center">
            <BlockMark block={block} done={state === "done"} />
          </ListRowLeading>
          <ListRowContent>
            <ListRowTitle className={cn(state === "done" && "text-muted-foreground")}>
              {blockTitle(block)}
              {state === "done" && <span className="sr-only">{t(", done")}</span>}
            </ListRowTitle>
          </ListRowContent>
          <ListRowTrailing>{formatDuration(block.estimatedMinutes)}</ListRowTrailing>
        </ListRow>
      ))}
    </ListGroup>
  );
}

/**
 * The aside of the session's screens from `lg`: today's queue (`getSessionQueue`), with the
 * minutes still to go. It keeps the learner's place in the day beside a question or between
 * blocks, as Today shows it.
 */
export function useSessionQueueAside(queue: ReturnType<typeof getSessionQueue>): TaskFrameAside {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const { minutesLeft, rows } = queue;

  return {
    children: <SessionQueue rows={rows} />,
    label: t("Today's session"),
    meta: minutesLeft > 0 ? t("{time} left", { time: formatDuration(minutesLeft) }) : undefined,
    title: t("Today"),
  };
}

/**
 * The day's queue placed in the aside of a screen whose frame isn't the session's (a lesson's end,
 * in the lesson player): drawn like the aside's own header and body, from its top. Wide screens
 * only; phones have the "Up next" row.
 */
export function SessionQueueAsideContent({ queue }: { queue: ReturnType<typeof getSessionQueue> }) {
  const aside = useSessionQueueAside(queue);

  return (
    <TaskAsideContent className="max-lg:hidden lg:top-0 lg:group-data-aside/task:px-0">
      <TaskAsideHeader meta={aside.meta} title={aside.title} />
      <div className="px-6">{aside.children}</div>
    </TaskAsideContent>
  );
}
