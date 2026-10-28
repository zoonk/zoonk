"use client";

import { type ExamRunningMock as ExamRunningMockView } from "@zoonk/core/exams/view/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import {
  CURRENT_ROW_CLASS,
  ListRowContent,
  ListRowDescription,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import { StatusMark } from "../_components/status-mark";
import { useFormatDuration } from "../_utils/time-format";
import { useTimeLeft } from "../_utils/use-time-left";
import { useMockShapeLabel, useMockTitle } from "../mock/mock-labels";
import { useExamScreen } from "./exam-context";

const MS_PER_MINUTE = 60_000;

const TICK_MS = 15_000;

function RunningMockClock({ deadline }: { deadline: string | null }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const minutes = Math.ceil(useTimeLeft({ deadline, tickMs: TICK_MS }) / MS_PER_MINUTE);

  if (deadline === null) {
    return <ListRowTrailing className="font-sans">{t("Handed in")}</ListRowTrailing>;
  }

  // The server renders the time left a moment before the browser takes over.
  if (minutes === 0) {
    return (
      <ListRowTrailing className="font-sans" suppressHydrationWarning>
        {t("Time's up")}
      </ListRowTrailing>
    );
  }

  return (
    <ListRowTrailing suppressHydrationWarning>
      {t("{time} left", { time: formatDuration(minutes) })}
    </ListRowTrailing>
  );
}

export function ExamRunningMock({
  current,
  running,
}: {
  current: boolean;
  running: ExamRunningMockView;
}) {
  const t = useExtracted();
  const title = useMockTitle();
  const shapeLabel = useMockShapeLabel();
  const { hrefs } = useExamScreen();
  const shape = shapeLabel(running);

  const answered = t("{answered, number} of {questions, number} answered", {
    answered: running.answered,
    questions: running.questions,
  });

  return (
    <ListRowLink className={cn(current && CURRENT_ROW_CLASS)} href={hrefs.mock(running.id)}>
      <ListRowLeading>
        <StatusMark status={current ? "next" : "todo"} />
      </ListRowLeading>
      <ListRowContent>
        <ListRowTitle>{title(running)}</ListRowTitle>
        <ListRowDescription>{shape ? `${shape} · ${answered}` : answered}</ListRowDescription>
      </ListRowContent>
      <RunningMockClock deadline={running.deadline} />
    </ListRowLink>
  );
}
