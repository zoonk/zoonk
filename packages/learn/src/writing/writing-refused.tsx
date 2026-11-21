"use client";

import { ClockIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { KindMark } from "../_components/kind-tile";
import {
  ListGroup,
  ListRow,
  ListRowBody,
  ListRowLeading,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import { PageSectionTitle } from "../_components/page";
import { StepDetail, StepHeader, StepTitle } from "../_components/step-card";
import { TaskActions } from "../_components/task-layout";
import { useFormatDuration } from "../_utils/time-format";
import { useFinishTask } from "../essay/use-finish-essay";
import { TaskFrame, TaskMainButton } from "../shell/task-frame";
import { type TomorrowTask } from "./writing-types";

function TomorrowTaskList({ task }: { task: TomorrowTask }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();

  return (
    <section className="flex flex-col gap-2">
      <PageSectionTitle>{t("Left for tomorrow")}</PageSectionTitle>
      <ListGroup>
        <ListRow>
          <ListRowLeading>
            <KindMark kind="essay" />
          </ListRowLeading>
          <ListRowBody>
            <ListRowTitle>{task.title}</ListRowTitle>
          </ListRowBody>
          {task.minutes !== null && (
            <ListRowTrailing className="font-mono text-xs">
              {formatDuration(task.minutes)}
            </ListRowTrailing>
          )}
        </ListRow>
      </ListGroup>
    </section>
  );
}

/**
 * Refused before writing: the day's extra grades are used, and the task waits for tomorrow, so
 * nothing written is ever lost to a limit.
 */
export function WritingRefused({
  hrefs,
  onContinue,
  task,
}: {
  hrefs: { exit: string };
  onContinue: () => Promise<boolean>;
  task: TomorrowTask | null;
}) {
  const t = useExtracted();
  const finishing = useFinishTask(onContinue);

  return (
    <TaskFrame
      exitHref={hrefs.exit}
      footer={
        <TaskActions>
          <TaskMainButton busy={finishing.pending} onClick={() => void finishing.finish()}>
            {t("Continue")}
          </TaskMainButton>
        </TaskActions>
      }
      headerTitle={null}
    >
      <div className="flex flex-col gap-8">
        <StepHeader className="gap-3">
          <ClockIcon aria-hidden="true" className="text-muted-foreground size-6" />
          <StepTitle>{t("No more grading today")}</StepTitle>
          <StepDetail>{t("You'll have more tomorrow.")}</StepDetail>
        </StepHeader>

        {task && <TomorrowTaskList task={task} />}
      </div>
    </TaskFrame>
  );
}
