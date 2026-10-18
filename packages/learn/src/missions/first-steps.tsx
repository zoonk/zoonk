"use client";

import { useExtracted } from "next-intl";
import { useId } from "react";
import { ListGroup } from "../_components/list-group";
import { SectionLabel } from "../_components/section-label";
import { StatusMark } from "../_components/status-mark";
import { type FirstStep, type FirstSteps } from "../buddies/buddy-status-view";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { FirstStepDetailLine, useFirstStepName } from "./first-step-copy";
import { useMissionStateLabel } from "./mission-copy";
import { type MissionLinks, useMissionOpen } from "./mission-links";
import { MissionListRow, ProgressCount } from "./mission-list";
import { MissionMark } from "./mission-mark";

/**
 * One first step: done (the done mark, its name muted), one of today's missions or there to do
 * any time (its mission's mark, opening where it's done, or saying what its block waits for), or
 * not yet (a faint dot, its name muted, and when it comes).
 */
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

/**
 * A new learner's first steps, under the day's missions in the buddy's day: the first real use of
 * each thing their plan has, done ones checked (even when done before the list showed), one of
 * them among today's missions, the rest open any time or saying when they come. Private and
 * quiet: no reward of its own and nothing on Today. On the day the last step is done the list
 * stays, every step checked, and says so; from the next day, or after the first two weeks, core
 * sends none.
 */
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
      <div className="flex items-baseline justify-between gap-2">
        <SectionLabel id={titleId}>{t("First steps")}</SectionLabel>
        <span className="text-muted-foreground font-mono text-xs tabular-nums">
          <ProgressCount done={firstSteps.done} total={firstSteps.total} />
        </span>
      </div>

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
