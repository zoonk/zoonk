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

const CARD_CLASS =
  "relative isolate max-sm:hidden before:pointer-events-none before:absolute before:-inset-x-2.5 before:-inset-y-2 before:-z-10 before:rounded-[0.625rem] before:transition-colors has-[a:hover]:before:bg-muted/70 has-[a:focus-visible]:before:ring-[3px] has-[a:focus-visible]:before:ring-ring/50";

/** Its box covers the whole card, so the card is one target. */
const LINK_CLASS =
  "text-muted-foreground hover:text-foreground inline-flex items-center gap-1 self-start text-[0.8125rem] transition-colors outline-none after:absolute after:-inset-x-2.5 after:-inset-y-2 after:rounded-[0.625rem] after:content-['']";

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
  detail?: React.ReactNode;
  ids: { title: string; value: string };
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

export function useCardIds() {
  const id = useId();
  return { title: `${id}-title`, value: `${id}-value` };
}
