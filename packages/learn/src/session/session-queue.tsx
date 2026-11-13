"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import {
  ListGroup,
  ListRow,
  ListRowBody,
  ListRowContent,
  ListRowLeading,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import { TaskAsideContent, TaskAsideHeader } from "../_components/task-layout";
import { useFormatDuration } from "../_utils/time-format";
import { type TaskFrameAside } from "../shell/task-frame";
import { BlockMark } from "./block-mark";
import { type SessionQueueRow } from "./session-queue-rows";
import { useBlockTitle } from "./use-block-copy";

/** One block as a list row; the next one is highlighted. */
export function BlockRow({ block, state }: SessionQueueRow) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const blockTitle = useBlockTitle();

  return (
    <ListRow aria-current={state === "next" ? "step" : undefined} data-state={state} role="listitem">
      <ListRowLeading>
        <BlockMark block={block} done={state === "done"} />
      </ListRowLeading>
      <ListRowBody>
        <ListRowContent>
          <ListRowTitle className={cn(state === "done" && "text-muted-foreground")}>
            {blockTitle(block)}
            {state === "done" && <span className="sr-only">{t(", done")}</span>}
          </ListRowTitle>
        </ListRowContent>
        <ListRowTrailing>{formatDuration(block.estimatedMinutes)}</ListRowTrailing>
      </ListRowBody>
    </ListRow>
  );
}

function SessionQueue({ rows }: { rows: readonly SessionQueueRow[] }) {
  return (
    <ListGroup role="list">
      {rows.map((row) => (
        <BlockRow key={row.block.position} {...row} />
      ))}
    </ListGroup>
  );
}

type SessionQueueView = { left: number; rows: readonly SessionQueueRow[] };

export function useSessionQueueAside({ left, rows }: SessionQueueView): TaskFrameAside {
  const t = useExtracted();
  const formatDuration = useFormatDuration();

  return {
    children: <SessionQueue rows={rows} />,
    label: t("Today"),
    meta: left > 0 ? t("{time} left", { time: formatDuration(left) }) : undefined,
    title: t("Today"),
  };
}

export function SessionQueueAsideContent({ queue }: { queue: SessionQueueView }) {
  const aside = useSessionQueueAside(queue);

  return (
    <TaskAsideContent className="without-aside:hidden with-aside:top-0 with-aside:group-data-aside/task:px-0">
      <TaskAsideHeader meta={aside.meta} title={aside.title} />
      <div className="px-6">{aside.children}</div>
    </TaskAsideContent>
  );
}
