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
    label: t("Today's session"),
    meta: left > 0 ? t("{time} left", { time: formatDuration(left) }) : undefined,
    title: t("Today"),
  };
}

export function SessionQueueAsideContent({ queue }: { queue: SessionQueueView }) {
  const aside = useSessionQueueAside(queue);

  return (
    <TaskAsideContent className="max-lg:hidden lg:top-0 lg:group-data-aside/task:px-0">
      <TaskAsideHeader meta={aside.meta} title={aside.title} />
      <div className="px-5">{aside.children}</div>
    </TaskAsideContent>
  );
}
