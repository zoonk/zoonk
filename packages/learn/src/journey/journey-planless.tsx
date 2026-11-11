"use client";

import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { GenerationTimelineDescription } from "@zoonk/ui/components/generation-timeline";
import { PlayIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { Page, PageEyebrow, PageSection } from "../_components/page";
import { type GenerationRun } from "../generation/generation-run";
import { GenerationWait } from "../generation/generation-wait";
import { useRefreshUntilShown } from "../generation/use-refresh-until-shown";
import { LearnLink } from "../learn-link";
import {
  GoalMenuDialogs,
  type GoalStatusControl,
  useGoalMenu,
  useSetGoalStatus,
} from "./goal-actions";
import { GoalOnlyMenu } from "./journey-menu";
import { PlanHeader } from "./plan-header";

function PlanlessHeader({
  eyebrow,
  goalStatus,
  goalTitle,
}: {
  eyebrow: string;
  goalStatus: GoalStatusControl;
  goalTitle: string;
}) {
  const goalMenu = useGoalMenu(goalStatus);

  return (
    <>
      <PlanHeader eyebrow={<PageEyebrow>{eyebrow}</PageEyebrow>}>
        <GoalOnlyMenu goal={goalMenu} />
      </PlanHeader>

      <GoalMenuDialogs goalTitle={goalTitle} menu={goalMenu} />
    </>
  );
}

const SETUP_TITLE_ID = "journey-setup-title";
const SETUP_TITLE_CLASS = "text-[0.9375rem] font-medium";
const SETUP_ACTION_CLASS = "mt-2 w-full md:w-auto";

function SetupPaused({
  goalStatus,
  goalTitle,
}: {
  goalStatus: GoalStatusControl;
  goalTitle: string;
}) {
  const t = useExtracted();
  const { isPending, setStatus } = useSetGoalStatus(goalStatus.onSetStatus);

  return (
    <>
      <h2 className={SETUP_TITLE_CLASS} id={SETUP_TITLE_ID}>
        {t("Your {goal} goal is paused", { goal: goalTitle })}
      </h2>
      <p className="text-muted-foreground text-sm">
        {t("Nothing is planned until you resume it.")}
      </p>
      <Button
        busy={isPending}
        className={SETUP_ACTION_CLASS}
        icon={<PlayIcon aria-hidden="true" />}
        onClick={() => setStatus("active")}
        size="lg"
      >
        {t("Resume")}
      </Button>
    </>
  );
}

function SetupLeft({ continueHref }: { continueHref: string }) {
  const t = useExtracted();

  return (
    <>
      <h2 className={SETUP_TITLE_CLASS} id={SETUP_TITLE_ID}>
        {t("Your plan comes after a few questions")}
      </h2>
      <p className="text-muted-foreground text-sm">
        {t("Answer them and we'll plan every day until you reach your goal.")}
      </p>
      <LearnLink
        className={buttonVariants({ className: SETUP_ACTION_CLASS, size: "lg" })}
        href={continueHref}
      >
        {t("Continue")}
      </LearnLink>
    </>
  );
}

export function JourneySetup({
  continueHref,
  goalStatus,
  goalTitle,
}: {
  continueHref: string;
  goalStatus: GoalStatusControl;
  goalTitle: string;
}) {
  return (
    <Page data-slot="journey-setup">
      <PlanlessHeader eyebrow={goalTitle} goalStatus={goalStatus} goalTitle={goalTitle} />

      <PageSection aria-labelledby={SETUP_TITLE_ID} className="max-w-xl items-start gap-2">
        {goalStatus.status === "paused" ? (
          <SetupPaused goalStatus={goalStatus} goalTitle={goalTitle} />
        ) : (
          <SetupLeft continueHref={continueHref} />
        )}
      </PageSection>
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
        eyebrow={t("{goal} · Building your plan", { goal: goalTitle })}
        goalStatus={goalStatus}
        goalTitle={goalTitle}
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
