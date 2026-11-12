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

export function useGrowthLine(status: BuddyStatusView): string {
  const t = useExtracted();
  const beltName = useBeltName();
  const next = status.nextStage;
  const nextBelt = next ? toBeltColor(next.belt) : null;

  if (!(next && nextBelt)) {
    return t("Fully grown");
  }

  const belt = beltName(nextBelt);

  return t("Grows when you reach {belt}", { belt });
}

/** Nothing to say once today's study kept it up. */
function useEnergyLine({ name, status }: { name: string; status: BuddyStatusView }) {
  const t = useExtracted();

  if (status.energy.state === "napping") {
    return t("{buddy} is napping. Study to wake it up.", { buddy: name });
  }

  return status.energy.studiedToday ? null : t("Study today to keep it up.");
}

function EnergyStarts({ name }: { name: string }) {
  const t = useExtracted();

  return (
    <section className="flex flex-col gap-1">
      <PageSectionTitle>{t("{buddy}'s Energy", { buddy: name })}</PageSectionTitle>
      <p className="text-muted-foreground text-[0.8125rem] leading-snug">
        {t("It starts with your first lesson.")}
      </p>
    </section>
  );
}

export function BuddyEnergy({
  className,
  href,
  name,
  status,
}: {
  className?: string;
  href: string;
  name: string;
  status: BuddyStatusView;
}) {
  const t = useExtracted();
  const formatShare = useFormatShare();
  const line = useEnergyLine({ name, status });

  if (status.energy.current === null) {
    return <EnergyStarts name={name} />;
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
        <span className={PAGE_SECTION_TITLE_CLASS}>{t("{buddy}'s Energy", { buddy: name })}</span>
        <span className="flex items-center gap-0.5 font-mono text-[0.8125rem] font-medium tabular-nums">
          {formatShare(share)}
          <ChevronRightIcon aria-hidden="true" className="text-muted-foreground/60 size-3.5" />
        </span>
      </span>

      <Meter>
        <MeterFill className="bg-energy" share={share} />
      </Meter>

      {line && <span className="text-muted-foreground text-[0.8125rem] leading-snug">{line}</span>}
    </LearnLink>
  );
}
