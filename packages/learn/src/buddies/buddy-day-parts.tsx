"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { ChevronRightIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { Meter, MeterFill } from "../_components/meter";
import { PAGE_SECTION_TITLE_CLASS, PageSectionTitle } from "../_components/page";
import { useFormatShare } from "../_utils/percent";
import { toBeltColor, useBeltName } from "../_utils/use-belt-name";
import { LearnLink } from "../learn-link";
import { type BuddyStatusView } from "./buddy-status-view";

const PERCENT = 100;

/** "Grows to Young at Orange belt": the next stage and the belt that brings it. */
export function useGrowthLine(status: BuddyStatusView): string {
  const t = useExtracted();
  const beltName = useBeltName();
  const next = status.nextStage;
  const nextBelt = next ? toBeltColor(next.belt) : null;

  if (!(next && nextBelt)) {
    return t("Fully grown");
  }

  const belt = beltName(nextBelt);

  const stages: Record<typeof next.stage, string> = {
    adult: t("Grows to Adult at {belt}", { belt }),
    baby: t("Grows to Young at {belt}", { belt }),
    young: t("Grows to Young at {belt}", { belt }),
  };

  return stages[next.stage];
}

/** One line on how Energy moves today: napping, studied already, or not yet. */
function useEnergyLine({ name, status }: { name: string; status: BuddyStatusView }) {
  const t = useExtracted();

  if (status.energy.state === "napping") {
    return t("{buddy} took a nap. Anything you learn wakes it up.", { buddy: name });
  }

  return status.energy.studiedToday
    ? t("You studied today, so Energy won't drop.")
    : t("Studying today keeps Energy up.");
}

/**
 * Before the learner has learned anything, Energy has nothing to say yet: no empty meter, just
 * when it starts.
 */
function EnergyStarts() {
  const t = useExtracted();

  return (
    <section className="flex flex-col gap-1">
      <PageSectionTitle>{t("Energy")}</PageSectionTitle>
      <p className="text-muted-foreground text-[0.8125rem] leading-snug">
        {t("Energy starts with your first lesson and grows as you learn.")}
      </p>
    </section>
  );
}

/**
 * Energy is the buddy's: its name with its share in the mono face, an amber meter and one line,
 * the whole of it opening Energy's history. The day's sheet and the conversation's aside both lead
 * with it.
 */
export function BuddyEnergy({
  className,
  href,
  name,
  status,
}: {
  /** Its place in the column, such as pulling its hover room onto the aside's top edge. */
  className?: string;
  href: string;
  name: string;
  status: BuddyStatusView;
}) {
  const t = useExtracted();
  const formatShare = useFormatShare();
  const line = useEnergyLine({ name, status });

  if (status.energy.current === null) {
    return <EnergyStarts />;
  }

  const share = status.energy.current / PERCENT;

  return (
    <LearnLink
      className={cn(
        "hover:bg-muted/70 focus-visible:ring-ring/50 -mx-2.5 flex flex-col gap-2 rounded-[0.625rem] px-2.5 py-2 transition-colors outline-none focus-visible:ring-[3px]",
        className,
      )}
      href={href}
    >
      <span className="flex items-center justify-between gap-3">
        <span className={PAGE_SECTION_TITLE_CLASS}>{t("Energy")}</span>
        <span className="flex items-center gap-0.5 font-mono text-[0.8125rem] font-medium tabular-nums">
          {formatShare(share)}
          <ChevronRightIcon aria-hidden="true" className="text-muted-foreground/60 size-3.5" />
        </span>
      </span>

      <Meter>
        <MeterFill className="bg-energy" share={share} />
      </Meter>

      <span className="text-muted-foreground text-[0.8125rem] leading-snug">{line}</span>
    </LearnLink>
  );
}
