"use client";

import { useExtracted } from "next-intl";
import { TaskClose } from "../../_components/task-close";
import {
  TaskHeader,
  TaskHeaderBar,
  TaskHeaderSegments,
  TaskHeaderSide,
  TaskHeaderTitle,
  type TaskSegment,
} from "../../_components/task-header";

const PERCENT = 100;

export function QuestionBlockClose({ href }: { href: string }) {
  const t = useExtracted();
  return <TaskClose href={href} label={t("Leave. Your answers are saved.")} prefetch={false} />;
}

export function QuestionBlockHeader({
  close,
  index,
  menu,
  segments,
  title,
  total,
}: {
  close: React.ReactNode;
  index: number;
  menu?: React.ReactNode;
  segments: readonly TaskSegment[];
  title: string;
  total: number;
}) {
  const t = useExtracted();
  const current = Math.min(index + 1, total);

  return (
    <TaskHeader className="bg-background sticky top-0">
      <TaskHeaderBar>
        <TaskHeaderSide align="start">{close}</TaskHeaderSide>
        <TaskHeaderTitle title={title} />
        <TaskHeaderSide align="end">{menu}</TaskHeaderSide>
      </TaskHeaderBar>

      {total > 0 && (
        <TaskHeaderSegments
          label={t("Question {current, number} of {total, number}", { current, total })}
          segments={segments}
          value={(index / total) * PERCENT}
        />
      )}
    </TaskHeader>
  );
}
