"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { CalendarClockIcon, CheckCheckIcon, CheckIcon, TargetIcon, ZapIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { FactChip, FactChips } from "../_components/fact-chips";
import { KindTile } from "../_components/kind-tile";
import { LearnLink } from "../learn-link";
import { SessionBody } from "../session/session-body";
import { type MistakePracticeSummary } from "./mistake-practice-state";

/** The one way out, at the bottom on phones and right under the moment on wide screens. */
function BackLink({ backHref }: { backHref: string }) {
  const t = useExtracted();
  const backRef = useEnterClick<HTMLAnchorElement>();

  return (
    <LearnLink
      className={cn(buttonVariants({ size: "lg" }), "mt-8 h-12 w-full rounded-full text-base")}
      href={backHref}
      ref={backRef}
    >
      {t("Back")}
    </LearnLink>
  );
}

/**
 * A finished moment's layout: its anchor and words in the middle of a phone's screen with the way
 * back at the bottom, and on wide screens all of it together in the middle.
 */
function DoneLayout({ children, footer }: { children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <SessionBody className="lg:justify-center-safe">
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center lg:flex-none">
        {children}
      </div>
      {footer}
    </SessionBody>
  );
}

/** What the run did, as chips: mistakes fixed, right answers, Brain Power (never "+0"). */
function PracticeFacts({
  fixed,
  summary,
}: {
  fixed: number;
  summary: MistakePracticeSummary | null;
}) {
  const t = useExtracted();
  const brainPower = summary?.brainPower ?? 0;

  if (fixed === 0 && !summary) {
    return (
      <p className="text-muted-foreground text-balance">
        {t("The rest come back another day, when they stick better.")}
      </p>
    );
  }

  return (
    <FactChips className="justify-center">
      {fixed > 0 && (
        <FactChip>
          <CheckCheckIcon aria-hidden="true" />
          {t("{count, plural, one {# mistake fixed} other {# mistakes fixed}}", { count: fixed })}
        </FactChip>
      )}
      {summary && (
        <FactChip>
          <TargetIcon aria-hidden="true" />
          {t("{correct} of {total} right", {
            correct: String(summary.correct),
            total: String(summary.total),
          })}
        </FactChip>
      )}
      {brainPower > 0 && (
        <FactChip>
          <ZapIcon aria-hidden="true" />
          {t("+{points} Brain Power", { points: String(brainPower) })}
        </FactChip>
      )}
    </FactChips>
  );
}

/** Nothing is due for practice yet: mistakes come back from the day after they're made. */
export function NothingToPractice({ backHref }: { backHref: string }) {
  const t = useExtracted();

  return (
    <DoneLayout footer={<BackLink backHref={backHref} />}>
      <KindTile icon={CalendarClockIcon} kind="mistakes" size="lg" />
      <div className="flex flex-col items-center gap-2" role="status">
        <h1 className="text-3xl font-bold tracking-tight text-balance">
          {t("Nothing to practice yet")}
        </h1>
        <p className="text-muted-foreground text-balance">
          {t("Mistakes come back for practice from the day after you make them.")}
        </p>
      </div>
    </DoneLayout>
  );
}

/**
 * The end of a run, at the last question or stopped early: a check that pops in, what it did as
 * chips (mistakes fixed, right answers, Brain Power), and back to the notebook.
 */
export function PracticeDone({
  backHref,
  fixed,
  summary,
}: {
  backHref: string;
  fixed: number;
  summary: MistakePracticeSummary | null;
}) {
  const t = useExtracted();

  return (
    <DoneLayout footer={<BackLink backHref={backHref} />}>
      <span className="bg-success/10 text-success animate-in zoom-in-50 fade-in flex size-20 items-center justify-center rounded-full duration-500 ease-out motion-reduce:animate-none">
        <CheckIcon aria-hidden="true" className="size-10" strokeWidth={2.5} />
      </span>

      <div aria-live="polite" className="flex flex-col items-center gap-4" role="status">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("Practice done")}</h1>
        <PracticeFacts fixed={fixed} summary={summary} />
      </div>
    </DoneLayout>
  );
}

/** The run's answers being counted toward today. */
export function PracticeSaving() {
  const t = useExtracted();

  return (
    <SessionBody className="items-center justify-center">
      <p className="text-muted-foreground flex items-center gap-2 text-sm" role="status">
        <Spinner />
        {t("Saving your practice…")}
      </p>
    </SessionBody>
  );
}
