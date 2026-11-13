"use client";

import { useExtracted } from "next-intl";
import { useId } from "react";
import { ListGroup } from "../_components/list-group";
import { PageSectionDetail, PageSectionHeader, PageSectionTitle } from "../_components/page";
import { type FirstStep, type FirstSteps } from "../buddies/buddy-status-view";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { useFirstStepName } from "./first-step-copy";
import { MissionStepLine, useMissionStateLabel } from "./mission-copy";
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
  const { waitReason } = step;
  const opens = waitReason ? undefined : step.opens;
  const target = useMissionOpen({ links, opens });

  return (
    <MissionListRow
      detail={<MissionStepLine mission={step} />}
      mark={<MissionMark buddy={buddy} done={false} kind={step.kind} />}
      muted={Boolean(waitReason)}
      name={stepName(step.kind)}
      stateLabel={stateLabel({
        asks: Boolean(links.askBuddy),
        done: false,
        kind: step.kind,
        opens,
        waitReason,
      })}
      target={target}
    />
  );
}

/**
 * Only the steps a learner can do now are rows. The ones done are in the count, and the ones that
 * open later are one line, since a row nobody can press only says when the plan gets to it.
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

  const open = firstSteps.steps.filter(
    (step) => step.status === "today" || step.status === "available",
  );

  const later = firstSteps.steps.filter((step) => step.status === "later").length;

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-1" data-slot="first-steps">
      <PageSectionHeader>
        <PageSectionTitle id={titleId}>{t("First steps")}</PageSectionTitle>
        <PageSectionDetail>
          <ProgressCount done={firstSteps.done} total={firstSteps.total} />
        </PageSectionDetail>
      </PageSectionHeader>

      <div className="flex flex-col gap-1">
        {open.length > 0 && (
          <ListGroup>
            <ul>
              {open.map((step) => (
                <li key={step.kind}>
                  <FirstStepRow buddy={buddy} links={links} step={step} />
                </li>
              ))}
            </ul>
          </ListGroup>
        )}

        {later > 0 && (
          <p className="text-muted-foreground border-t pt-3 text-xs first:border-t-0 first:pt-0">
            {t("{count, plural, one {# more opens as you go} other {# more open as you go}}", {
              count: later,
            })}
          </p>
        )}

        {firstSteps.completedOn && (
          <p className="text-success-text border-t pt-3 text-xs font-medium first:border-t-0 first:pt-0">
            {t("You've tried everything.")}
          </p>
        )}
      </div>
    </section>
  );
}
