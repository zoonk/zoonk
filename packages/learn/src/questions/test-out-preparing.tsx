"use client";

import {
  GenerationTimelineDescription,
  GenerationTimelineTitle,
} from "@zoonk/ui/components/generation-timeline";
import { useExtracted } from "next-intl";
import { FreeWeekOverNotice } from "../_components/free-week-over";
import { type HelpLimit, HelpLimitNotice } from "../_components/help-limit-notice";
import { StepCard, StepDetail, StepHeader } from "../_components/step-card";
import { TaskHeaderTitle } from "../_components/task-header";
import { TaskActions } from "../_components/task-layout";
import { type GenerationRun } from "../generation/generation-run";
import { GenerationWait } from "../generation/generation-wait";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { TaskFrame, TaskMainButton, TaskMainLink } from "../shell/task-frame";

function TestOutCard() {
  const t = useExtracted();

  return (
    <StepCard>
      <StepHeader>
        <h2 className="text-title">{t("Already know this?")}</h2>
        <StepDetail>
          {t(
            "A few questions on this chapter. Do well, and your plan skips what you already know.",
          )}
        </StepDetail>
      </StepHeader>
    </StepCard>
  );
}

function TestOutStart({
  limit,
  onStart,
  plusRequired,
  starting,
}: {
  limit: HelpLimit | null;
  onStart: () => void;
  plusRequired: boolean;
  starting: boolean;
}) {
  const t = useExtracted();
  const routes = useLearnRoutes();

  if (plusRequired) {
    return (
      <>
        <FreeWeekOverNotice cta={false} />
        <TaskActions>
          <TaskMainLink href={routes.upgrade}>{t("See Plus")}</TaskMainLink>
        </TaskActions>
      </>
    );
  }

  if (limit) {
    return <HelpLimitNotice limit={limit} linkComponent={LearnLink} routes={routes} />;
  }

  return (
    <TaskActions>
      <TaskMainButton busy={starting} onClick={onStart}>
        {starting ? t("Starting…") : t("Start the test")}
      </TaskMainButton>
    </TaskActions>
  );
}

export function TestOutPreparing({
  chapterTitle,
  closeHref,
  limit,
  onStart,
  plusRequired = false,
  run,
  starting,
}: {
  chapterTitle: string;
  closeHref: string;
  limit: HelpLimit | null;
  plusRequired?: boolean;
  onStart: () => void;
  run: GenerationRun | null;
  starting: boolean;
}) {
  const t = useExtracted();

  return (
    <TaskFrame
      exitHref={closeHref}
      footer={
        !run && (
          <TestOutStart
            limit={limit}
            onStart={onStart}
            plusRequired={plusRequired}
            starting={starting}
          />
        )
      }
      headerTitle={<TaskHeaderTitle title={t("Test out: {chapter}", { chapter: chapterTitle })} />}
    >
      {run ? (
        <GenerationWait kind="testOutQuestions" run={run}>
          <GenerationTimelineTitle>{t("Getting your test ready")}</GenerationTimelineTitle>
          <GenerationTimelineDescription>
            {t(
              "We're writing a few questions on this chapter. The test opens here when they're ready.",
            )}
          </GenerationTimelineDescription>
        </GenerationWait>
      ) : (
        <TestOutCard />
      )}
    </TaskFrame>
  );
}
