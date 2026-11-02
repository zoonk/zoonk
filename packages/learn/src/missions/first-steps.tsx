"use client";

import { useExtracted } from "next-intl";
import { useId } from "react";
import { ListGroup } from "../_components/list-group";
import { PageSectionDetail, PageSectionHeader, PageSectionTitle } from "../_components/page";
import { StatusMark } from "../_components/status-mark";
import { type FirstStep, type FirstSteps } from "../buddies/buddy-status-view";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { FirstStepDetailLine, useFirstStepName } from "./first-step-copy";
import { useMissionStateLabel } from "./mission-copy";
import { type MissionLinks, useMissionOpen } from "./mission-links";
import { MissionListRow, ProgressCount } from "./mission-list";
import { MissionMark } from "./mission-mark";

function FirstStepRow({
  buddy,
  links,
  step,
}: {
  buddy: LearnBuddy | null;
  links: MissionLinks;
  step: FirstStep;
}) {
  const stepName = useFirstStepName(buddy);
  const stateLabel = useMissionStateLabel(buddy);
  const done = step.status === "done";
  const later = step.status === "later";
  const { waitReason } = step;
  const opens = done || later || waitReason ? undefined : step.opens;
  const target = useMissionOpen({ links, opens });

  return (
    <MissionListRow
      detail={done ? null : <FirstStepDetailLine step={step} />}
      mark={
        later ? (
          <StatusMark className="size-3" status="todo" />
        ) : (
          <MissionMark buddy={buddy} done={done} kind={step.kind} />
        )
      }
      muted={done || later}
      name={stepName(step.kind)}
      stateLabel={stateLabel({
        asks: Boolean(links.askBuddy),
        done,
        kind: step.kind,
        opens,
        waitReason,
      })}
      target={target}
    />
  );
}

export function FirstStepsSection({
  buddy,
  firstSteps,
  links,
}: {
  buddy: LearnBuddy | null;
  firstSteps: FirstSteps | null;
  links: MissionLinks;
}) {
  const t = useExtracted();
  const titleId = useId();

  if (!firstSteps) {
    return null;
  }

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-1" data-slot="first-steps">
      <PageSectionHeader>
        <PageSectionTitle id={titleId}>{t("First steps")}</PageSectionTitle>
        <PageSectionDetail>
          <ProgressCount done={firstSteps.done} total={firstSteps.total} />
        </PageSectionDetail>
      </PageSectionHeader>

      <div className="flex flex-col gap-1">
        <ListGroup>
          <ul>
            {firstSteps.steps.map((step) => (
              <li key={step.kind}>
                <FirstStepRow buddy={buddy} links={links} step={step} />
              </li>
            ))}
          </ul>
        </ListGroup>

        {firstSteps.completedOn && (
          <p className="text-success-text border-t pt-3 text-xs font-medium">
            {t("You've tried everything your plan uses.")}
          </p>
        )}
      </div>
    </section>
  );
}
