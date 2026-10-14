"use client";

import { Button } from "@zoonk/ui/components/button";
import {
  GenerationTimelineDescription,
  GenerationTimelineTitle,
} from "@zoonk/ui/components/generation-timeline";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { Spinner } from "@zoonk/ui/components/spinner";
import { useIsMounted } from "@zoonk/ui/hooks/is-mounted";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type ReactNode } from "react";
import {
  DETAIL_PRIMARY_CLASS,
  DetailActions,
  DetailEyebrow,
  DetailHero,
  DetailHeroText,
  DetailTitle,
} from "../_components/detail-page";
import { HelpLimitNotice } from "../_components/help-limit-notice";
import { Page } from "../_components/page";
import { useFormatDuration } from "../_utils/time-format";
import { type GenerationRun } from "../generation/generation-run";
import { GenerationWait } from "../generation/generation-wait";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { PageWithAside } from "../shell/learn-shell";
import { type MockChooserStatus } from "./mock-chooser-parts";

type MockShortStatus = Extract<MockChooserStatus, { kind: "short" }>;

/**
 * The chooser as a page of the app's frame, laid out as a detail page (`DetailLayout`): its bar
 * (the host's way back), then the header and the choices, and from 72rem the picked mock beside
 * them in the page's aside (`asideClassName` hides an aside that only repeats the rows under 72rem).
 */
export function ChooserLayout({
  aside,
  asideClassName,
  bar,
  children,
}: {
  aside?: ReactNode;
  asideClassName?: string;
  bar: ReactNode;
  children: ReactNode;
}) {
  const t = useExtracted();

  return (
    <PageWithAside
      aside={aside}
      asideClassName={asideClassName}
      asideLabel={t("The picked mock exam")}
    >
      <article className="flex min-w-0 flex-col gap-8">
        {bar}
        <Page className="gap-8">{children}</Page>
      </article>
    </PageWithAside>
  );
}

function useFailureText() {
  const t = useExtracted();

  return (reason: Extract<MockChooserStatus, { kind: "failed" }>["reason"]): string =>
    reason === "notEnoughQuestions"
      ? t("There aren't enough questions for this mock yet. Try the full exam or another subject.")
      : t("We couldn't start the mock. Try again.");
}

/** How much of the picked mock is ready, and when more can be written, before it starts. */
function ShortText({ status }: { status: MockShortStatus }) {
  const t = useExtracted();
  const duration = useFormatDuration();

  const size = {
    questions: status.questions,
    time: duration(status.minutes),
    total: status.examQuestions,
  };

  return (
    <>
      {t(
        "{questions, plural, one {# of the {total, number} questions is ready now} other {# of the {total, number} questions are ready now}}, so this mock takes about {time}.",
        size,
      )}{" "}
      {status.limit === "day" && t("More can be written for your mocks tomorrow.")}
      {status.limit === "month" && t("More can be written for your mocks next month.")}
      {status.limit !== "day" &&
        status.limit !== "month" &&
        t("The question bank doesn't have more new ones for it yet.")}
    </>
  );
}

/**
 * The chooser's one line under its title: the rule that changes how to take it, or what stops the
 * mock now in its place (how much of the picked mock is ready, or why it couldn't start), so the
 * header never moves and the message sits right by Start.
 */
function ChooserLine({ detail, status }: { detail: string; status: MockChooserStatus }) {
  const failureText = useFailureText();

  return (
    <p
      className={cn(
        "pt-1 text-sm text-pretty",
        status.kind === "failed" ? "text-destructive-text" : "text-muted-foreground",
      )}
      role="status"
    >
      {status.kind === "short" && <ShortText status={status} />}
      {status.kind === "failed" && failureText(status.reason)}
      {status.kind !== "short" && status.kind !== "failed" && detail}
    </p>
  );
}

/**
 * The chooser's header, a detail page's: the exam it's for, the title and one quiet line, with the
 * main action (`action`: Start, or "See Plus") beside them from `md` and under them on a phone.
 */
export function ChooserHeader({
  action,
  detail,
  eyebrow,
  status,
  title,
}: {
  action: ReactNode;
  detail: string;
  eyebrow: string;
  status: MockChooserStatus;
  title: string;
}) {
  return (
    <DetailHero>
      <DetailHeroText>
        <DetailEyebrow>{eyebrow}</DetailEyebrow>
        <DetailTitle>{title}</DetailTitle>
        <ChooserLine detail={detail} status={status} />
      </DetailHeroText>

      <DetailActions>{action}</DetailActions>
    </DetailHero>
  );
}

/**
 * The chooser's main action, as every detail page's: Enter presses it, its ⏎ shown where there's
 * a keyboard; while its request is on its way, a spinner beside the label says so, not dimmed.
 */
export function ChooserStartButton({
  busy,
  children,
  disabled = false,
  onClick,
}: {
  busy: boolean;
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  const mounted = useIsMounted();
  const isDisabled = disabled || busy || !mounted;
  const ref = useEnterClick<HTMLButtonElement>({ enabled: !isDisabled });

  return (
    <Button
      aria-keyshortcuts="Enter"
      className={cn(DETAIL_PRIMARY_CLASS, "font-[560]", busy && "disabled:opacity-100")}
      disabled={isDisabled}
      onClick={onClick}
      ref={ref}
      size="lg"
    >
      {busy && <Spinner aria-hidden="true" />}
      {children}
      {!busy && <ShortcutKbd tone="inverse">⏎</ShortcutKbd>}
    </Button>
  );
}

/** Without Plus the main action is "See Plus", in Start's place; Enter follows it. */
export function ChooserPlusLink({ href }: { href: string }) {
  const t = useExtracted();
  const ref = useEnterClick<HTMLAnchorElement>();

  return (
    <LearnLink
      aria-keyshortcuts="Enter"
      className={cn(DETAIL_PRIMARY_CLASS, "font-[560]")}
      href={href}
      ref={ref}
    >
      {t("See Plus")}
      <ShortcutKbd tone="inverse">⏎</ShortcutKbd>
    </LearnLink>
  );
}

/**
 * AI help used up for now, so the picked mock's missing questions can't be written: when that
 * renews, and the way on, over the choices (the header's line says the rest of what stops a mock).
 */
export function ChooserRefusal({ status }: { status: MockChooserStatus }) {
  const routes = useLearnRoutes();

  if (status.kind !== "refused") {
    return null;
  }

  return <HelpLimitNotice limit={status.limit} linkComponent={LearnLink} routes={routes} />;
}

/** While the picked mock's questions are written: the run's progress, and that it starts here. */
export function MockWriting({ bar, run }: { bar: ReactNode; run: GenerationRun }) {
  const t = useExtracted();

  return (
    <ChooserLayout bar={bar}>
      <GenerationWait kind="mockQuestions" run={run}>
        {/* oxlint-disable-next-line jsx-a11y/heading-has-content -- The title's text is its children. */}
        <GenerationTimelineTitle render={<h1 />}>
          {t("Preparing your mock exam")}
        </GenerationTimelineTitle>
        <GenerationTimelineDescription>
          {t(
            "We're writing questions like the exam's for you. It starts here as soon as they're ready.",
          )}
        </GenerationTimelineDescription>
      </GenerationWait>
    </ChooserLayout>
  );
}
