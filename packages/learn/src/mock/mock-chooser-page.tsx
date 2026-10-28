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
  DetailHero,
  DetailHeroText,
  DetailTitle,
} from "../_components/detail-page";
import { HelpLimitNotice } from "../_components/help-limit-notice";
import { Page, PageEyebrow } from "../_components/page";
import { useFormatDuration } from "../_utils/time-format";
import { type GenerationRun } from "../generation/generation-run";
import { GenerationWait } from "../generation/generation-wait";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { PageWithAside } from "../shell/learn-shell";
import { type MockChooserStatus } from "./mock-chooser-parts";

type MockShortStatus = Extract<MockChooserStatus, { kind: "short" }>;

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
        <PageEyebrow>{eyebrow}</PageEyebrow>
        <DetailTitle>{title}</DetailTitle>
        <ChooserLine detail={detail} status={status} />
      </DetailHeroText>

      <DetailActions>{action}</DetailActions>
    </DetailHero>
  );
}

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

export function ChooserRefusal({ status }: { status: MockChooserStatus }) {
  const routes = useLearnRoutes();

  if (status.kind !== "refused") {
    return null;
  }

  return <HelpLimitNotice limit={status.limit} linkComponent={LearnLink} routes={routes} />;
}

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
