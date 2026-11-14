"use client";

import { BottomBar, BottomBarActions } from "@zoonk/ui/components/bottom-bar";
import { GenerationTimelineDescription } from "@zoonk/ui/components/generation-timeline";
import { useExtracted } from "next-intl";
import { EnterLink } from "../_components/enter-button";
import { Page, PageSection } from "../_components/page";
import { type GenerationRun } from "../generation/generation-run";
import { GenerationWait } from "../generation/generation-wait";
import { useRefreshUntilShown } from "../generation/use-refresh-until-shown";
import { GoalMenuDialogs, type GoalStatusControl, useGoalMenu } from "./goal-actions";
import { GoalOnlyMenu } from "./journey-menu";
import { PlanHeader } from "./plan-header";
import { ResumeGoalBar } from "./resume-goal-bar";

function PlanlessHeader({
  goalStatus,
  goalTitle,
  subtitle,
}: {
  goalStatus: GoalStatusControl;
  goalTitle: string;
  subtitle: string;
}) {
  const goalMenu = useGoalMenu(goalStatus);

  return (
    <>
      <PlanHeader subtitle={subtitle}>
        <GoalOnlyMenu goal={goalMenu} />
      </PlanHeader>

      <GoalMenuDialogs goalTitle={goalTitle} menu={goalMenu} />
    </>
  );
}

const SETUP_TITLE_ID = "journey-setup-title";
const SETUP_TITLE_CLASS = "text-reading font-medium";

export function JourneySetup({
  continueHref,
  goalStatus,
  goalTitle,
}: {
  continueHref: string;
  goalStatus: GoalStatusControl;
  goalTitle: string;
}) {
  const t = useExtracted();
  const paused = goalStatus.status === "paused";

  return (
    <Page data-slot="journey-setup">
      <PlanlessHeader goalStatus={goalStatus} goalTitle={goalTitle} subtitle={goalTitle} />

      <PageSection aria-labelledby={SETUP_TITLE_ID} className="max-w-xl items-start gap-2">
        <h2 className={SETUP_TITLE_CLASS} id={SETUP_TITLE_ID}>
          {paused
            ? t("Your {goal} goal is paused", { goal: goalTitle })
            : t("Your plan comes after a few questions")}
        </h2>
        <p className="text-muted-foreground text-sm">
          {paused
            ? t("Nothing is planned until you resume it.")
            : t("Answer them and we'll plan every day until you reach your goal.")}
        </p>
      </PageSection>

      {paused ? (
        <ResumeGoalBar onResume={() => goalStatus.onSetStatus("active")} />
      ) : (
        <BottomBar>
          <BottomBarActions>
            <EnterLink href={continueHref}>{t("Continue")}</EnterLink>
          </BottomBarActions>
        </BottomBar>
      )}
    </Page>
  );
}

export function JourneyBuilding({
  goalStatus,
  goalTitle,
  onRefresh,
  run,
}: {
  goalStatus: GoalStatusControl;
  goalTitle: string;
  onRefresh: () => void;
  run: GenerationRun;
}) {
  const t = useExtracted();

  useRefreshUntilShown({ refresh: onRefresh, status: run.status });

  return (
    <Page data-slot="journey-preparing">
      <PlanlessHeader
        goalStatus={goalStatus}
        goalTitle={goalTitle}
        subtitle={t("{goal} · Building your plan", { goal: goalTitle })}
      />

      <section className="flex max-w-xl flex-col gap-8">
        <GenerationWait kind="curriculum" run={run}>
          <GenerationTimelineDescription>
            {t("It usually takes a minute or two. Your plan opens here as soon as it's ready.")}
          </GenerationTimelineDescription>
        </GenerationWait>
      </section>
    </Page>
  );
}
