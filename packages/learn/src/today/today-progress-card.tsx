"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { ChevronRightIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId } from "react";
import { BigQuantity } from "../_components/big-quantity";
import {
  PageSection,
  PageSectionDetail,
  PageSectionHeader,
  PageSectionTitle,
} from "../_components/page";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";

/**
 * The card's highlight, drawn behind it a little past the column's edges as a list row's is: under
 * the pointer anywhere on the card, and ringed while its link has the keyboard's focus.
 */
const CARD_CLASS =
  "relative isolate max-sm:hidden before:pointer-events-none before:absolute before:-inset-x-2.5 before:-inset-y-2 before:-z-10 before:rounded-[0.625rem] before:transition-colors has-[a:hover]:before:bg-muted/70 has-[a:focus-visible]:before:ring-[3px] has-[a:focus-visible]:before:ring-ring/50";

/** "See your plan", whose box covers the whole card, so the card is one target. */
const LINK_CLASS =
  "text-muted-foreground hover:text-foreground inline-flex items-center gap-1 self-start text-[0.8125rem] transition-colors outline-none after:absolute after:-inset-x-2.5 after:-inset-y-2 after:rounded-[0.625rem] after:content-['']";

/**
 * The card's frame: its name with a quiet detail beside it, the number as a readout (a share or a
 * level, its unit small), what draws it (`children`), and "See your plan" at its end. The whole
 * card is that one link: its box covers the card, and it's named by the card's own words
 * ("Progress 32% 6 of 19 lessons Today: 2 lessons See your plan"), while a list inside stays a
 * list for screen readers.
 */
export function ProgressCard({
  children,
  className,
  detail,
  ids,
  summary,
  title,
  value,
}: {
  children?: React.ReactNode;
  className?: string;
  /** Beside the title: the lessons' count, the week's gain. */
  detail?: React.ReactNode;
  ids: { title: string; value: string };
  /** What the drawing adds, in words for screen readers ("Today: 2 lessons"). */
  summary?: string | null;
  title: string;
  value: React.ReactNode;
}) {
  const t = useExtracted();
  const routes = useLearnRoutes();
  const id = useId();
  const detailId = `${id}-detail`;
  const summaryId = `${id}-summary`;
  const linkId = `${id}-link`;

  const labelledBy = [
    ids.title,
    ids.value,
    detail ? detailId : null,
    summary ? summaryId : null,
    linkId,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <PageSection
      aria-labelledby={ids.title}
      className={cn(CARD_CLASS, className)}
      data-slot="today-preparation"
    >
      <PageSectionHeader>
        <PageSectionTitle id={ids.title}>{title}</PageSectionTitle>
        {detail && <PageSectionDetail id={detailId}>{detail}</PageSectionDetail>}
      </PageSectionHeader>

      <p className="text-readout pt-0.5 pb-1 text-[2rem]" id={ids.value}>
        {typeof value === "string" ? <BigQuantity>{value}</BigQuantity> : value}
      </p>

      {children}

      {summary && (
        <span className="sr-only" id={summaryId}>
          {summary}
        </span>
      )}

      <LearnLink aria-labelledby={labelledBy} className={LINK_CLASS} href={routes.journey}>
        <span id={linkId}>{t("See your plan")}</span>
        <ChevronRightIcon aria-hidden="true" className="size-3.5" />
      </LearnLink>
    </PageSection>
  );
}

/** The card's own ids, so its link and its list can be named by its words. */
export function useCardIds() {
  const id = useId();
  return { title: `${id}-title`, value: `${id}-value` };
}
