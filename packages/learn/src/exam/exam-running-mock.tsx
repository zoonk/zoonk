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

/** The row says whole minutes, so it reads the clock again a few times a minute. */
const TICK_MS = 15_000;

/**
 * The running mock's clock at its row's end: its time left in whole minutes, "Time's up" once it
 * ran out (it waits to be handed in), and "Handed in" while it waits to be graded. The words take
 * the sans face, as words at a row's end do.
 */
function RunningMockClock({ deadline }: { deadline: string | null }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  // Whole minutes, rounded up so the last minute reads "1 min", never "0 min".
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

/**
 * A mock the learner started and left, at the top of the mocks' list: named as the mock names
 * itself ("Mock exam 2"), what it sits and how much is answered under it, and its clock at the
 * row's end. The first one is highlighted as the one to go on with (`current`, the caller marking
 * its item `aria-current`). The whole row opens it where the learner left it.
 */
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
