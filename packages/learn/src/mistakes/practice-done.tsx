"use client";

import { type Reached } from "@zoonk/core/sessions/reached";
import { CountUp } from "@zoonk/ui/components/count-up";
import { Spinner } from "@zoonk/ui/components/spinner";
import { cn } from "@zoonk/ui/lib/utils";
import { BrainIcon, CheckCheckIcon, TargetIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { StatTile, StatTiles } from "../_components/stat-tile";
import { StepCard, StepDetail, StepHeader } from "../_components/step-card";
import { TaskActionBar, TaskActions, TaskBody } from "../_components/task-layout";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { DayMoment } from "../session/day-moment";
import {
  MOMENT_TITLE_PROPS,
  MomentAfterCeremony,
  type MomentCeremony,
} from "../session/moment-ceremony";
import { TaskMainLink } from "../shell/task-frame";
import { type MistakePracticeSummary } from "./mistake-practice-state";

/**
 * The one way out, pinned at the bottom like every task's main action (or Enter), in the bar's
 * row: full width on a phone, as wide as its label from `lg`.
 */
function BackBar({ backHref }: { backHref: string }) {
  const t = useExtracted();

  return (
    <TaskActionBar>
      <TaskActions>
        <TaskMainLink href={backHref}>{t("Back")}</TaskMainLink>
      </TaskActions>
    </TaskActionBar>
  );
}

/**
 * What the run did, as numbers on their tiles: mistakes fixed, right answers (blue once one is
 * right), Brain Power (never "+0"). A run that fixed nothing and counted nothing says the rest come
 * back, and so does a run with a miss, so a hard day reads as "not yet".
 */
function PracticeStats({
  fixed,
  summary,
}: {
  fixed: number;
  summary: MistakePracticeSummary | null;
}) {
  const t = useExtracted();
  const brainPower = summary?.brainPower ?? 0;

  if (fixed === 0 && !summary) {
    return <StepDetail>{t("The rest come back another day, when they stick better.")}</StepDetail>;
  }

  const tiles = [fixed > 0, summary !== null, brainPower > 0].filter(Boolean).length;
  const missed = summary !== null && summary.correct < summary.total;

  return (
    <>
      <StatTiles className={cn(tiles === 3 && "sm:grid-cols-3", tiles === 1 && "grid-cols-1")}>
        {fixed > 0 && (
          <StatTile icon={<CheckCheckIcon />} label={t("Mistakes fixed")} value={fixed} />
        )}
        {summary && (
          <StatTile
            icon={<TargetIcon />}
            label={t("Right answers")}
            tone={summary.correct > 0 ? "success" : "neutral"}
            value={`${summary.correct}/${summary.total}`}
          />
        )}
        {brainPower > 0 && (
          <StatTile
            icon={<BrainIcon />}
            label={t("Brain Power")}
            tone="brain"
            value={<CountUp format={(points) => `+${points}`} value={brainPower} />}
          />
        )}
      </StatTiles>

      {missed && (
        <StepDetail>{t("The rest come back another day, when they stick better.")}</StepDetail>
      )}
    </>
  );
}

/** Nothing is due for practice yet: mistakes come back from the day after they're made. */
export function NothingToPractice({ backHref }: { backHref: string }) {
  const t = useExtracted();

  return (
    <>
      <TaskBody>
        <StepCard role="status">
          <StepHeader>
            <h2 className="text-title">{t("Nothing to practice yet")}</h2>
            <StepDetail>
              {t("Mistakes come back for practice from the day after you make them.")}
            </StepDetail>
          </StepHeader>
        </StepCard>
      </TaskBody>

      <BackBar backHref={backHref} />
    </>
  );
}

/**
 * The end of a run, at the last question or stopped early, straight on the page under the run's
 * header (its title a step under the header's): what it did as numbers on their tiles (mistakes
 * fixed, right answers, Brain Power), what it did to the day (its missions, the level and the tenth
 * of Energy the whole run reached), and back to the notebook from the pinned bar. A milestone it
 * earned opens first, on its own.
 */
export function PracticeDone({
  backHref,
  buddy,
  fixed,
  reached,
  renderCeremony,
  summary,
}: {
  backHref: string;
  /** The learner's buddy, who cheers when the run completes one of the day's missions. */
  buddy?: LearnBuddy | null;
  fixed: number;
  /** What every count of the run reached, its end's included. */
  reached: Reached;
  renderCeremony?: MomentCeremony;
  summary: MistakePracticeSummary | null;
}) {
  const t = useExtracted();
  const ceremony = summary?.ceremony ?? null;

  return (
    <MomentAfterCeremony milestone={ceremony} render={renderCeremony}>
      <TaskBody>
        <StepCard aria-live="polite" role="status">
          <h2 className="text-title outline-none" {...MOMENT_TITLE_PROPS}>
            {t("Practice done")}
          </h2>
          <PracticeStats fixed={fixed} summary={summary} />

          <DayMoment
            buddy={buddy}
            ceremony={ceremony}
            missionMoment={summary?.missionMoment ?? null}
            reached={reached}
          />
        </StepCard>
      </TaskBody>

      <BackBar backHref={backHref} />
    </MomentAfterCeremony>
  );
}

/** The run's answers being counted toward today. */
export function PracticeSaving() {
  const t = useExtracted();

  return (
    <TaskBody>
      <p className="text-muted-foreground flex items-center gap-2 text-sm" role="status">
        <Spinner />
        {t("Saving your practice…")}
      </p>
    </TaskBody>
  );
}
