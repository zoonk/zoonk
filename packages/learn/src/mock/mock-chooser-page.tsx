"use client";

import { BottomBar, BottomBarActions } from "@zoonk/ui/components/bottom-bar";
import { DetailHero, DetailHeroText, DetailTitle } from "@zoonk/ui/components/detail";
import { useIsMounted } from "@zoonk/ui/hooks/is-mounted";
import { useExtracted } from "next-intl";
import { type ReactNode } from "react";
import { DETAIL_PRIMARY_CLASS } from "../_components/detail-page";
import { EnterButton, EnterLink } from "../_components/enter-button";
import { Page } from "../_components/page";
import { GateWords, SubscribeMainAction } from "../_components/subscribe-gate";
import { useLearnRoutes } from "../learn-context";
import { PageWithAside } from "../shell/learn-shell";
import { ChooseOnTodayLink } from "../writing/writing-choice";
import { type MockChooserStatus } from "./mock-chooser-parts";
import { MockPreparingNote, type MockWritingWait } from "./mock-preparing";

export function ChooserLayout({
  aside,
  asideClassName,
  bar,
  bottomBar,
  children,
}: {
  aside?: ReactNode;
  asideClassName?: string;
  bar: ReactNode;
  bottomBar?: ReactNode;
  children: ReactNode;
}) {
  const t = useExtracted();

  return (
    <PageWithAside
      aside={aside}
      asideClassName={asideClassName}
      asideLabel={t("Your last mock exam")}
      bottomBar={bottomBar}
    >
      <article className="flex min-w-0 flex-col">
        {bar}
        <Page className="gap-8">{children}</Page>
      </article>
    </PageWithAside>
  );
}

export function ChooserHeader({ detail, title }: { detail: string; title: string }) {
  return (
    <DetailHero>
      <DetailHeroText>
        <DetailTitle>{title}</DetailTitle>
        <p className="text-muted-foreground pt-1 text-sm">{detail}</p>
      </DetailHeroText>
    </DetailHero>
  );
}

/** Why Start didn't start, read out as it shows: over the bar, where the learner pressed. */
function useChooserNote({
  busy,
  gated,
  goalId,
  preparing,
  status,
  writing,
}: ChooserBarProps): ReactNode {
  const t = useExtracted();

  if (gated) {
    return (
      <div role="alert">
        <GateWords title={t("Mock exams need a subscription")} />
      </div>
    );
  }

  if (preparing) {
    return (
      <MockPreparingNote
        key={preparing}
        goalId={goalId}
        surface="mockChooser"
        title={t({
          description:
            "Over the mock exam chooser's main button, after the learner picked a mock exam that isn't ready to start yet: we're writing its questions now. Other picks may start right away.",
          message: "Getting this mock exam ready",
        })}
        wait={writing}
      />
    );
  }

  if (!busy && status.kind === "failed") {
    return (
      <p className="text-destructive-text text-sm" role="alert">
        {t("We couldn't start the mock exam. Try again.")}
      </p>
    );
  }

  return null;
}

type ChooserBarProps = {
  busy: boolean;
  gated: boolean;
  goalId: string;
  /** The picked option's key while it's being prepared. */
  preparing: string | null;
  status: MockChooserStatus;
  writing: MockWritingWait;
};

function ChooserMainAction({
  busy,
  disabled,
  onStart,
  preparing,
}: Pick<ChooserBarProps, "busy" | "preparing"> & { disabled: boolean; onStart: () => void }) {
  const t = useExtracted();
  const routes = useLearnRoutes();
  const mounted = useIsMounted();

  if (preparing) {
    return (
      <EnterLink className={DETAIL_PRIMARY_CLASS} href={routes.today} size="lg">
        {t("Keep studying")}
      </EnterLink>
    );
  }

  return (
    <EnterButton
      busy={busy}
      className={DETAIL_PRIMARY_CLASS}
      disabled={disabled || !mounted}
      onClick={onStart}
      size="lg"
    >
      {t("Start")}
    </EnterButton>
  );
}

/** Start on every screen size, after the list: the choice comes before the action. */
export function ChooserBar({
  choose = false,
  disabled,
  onStart,
  ...props
}: ChooserBarProps & {
  /** The picked option waits for an exam choice, which its row names: the way on is Today's question. */
  choose?: boolean;
  disabled: boolean;
  onStart: () => void;
}) {
  const note = useChooserNote(props);

  return (
    <BottomBar note={note}>
      {props.gated && <SubscribeMainAction />}
      {!props.gated && choose && (
        <BottomBarActions>
          <ChooseOnTodayLink />
        </BottomBarActions>
      )}
      {!props.gated && !choose && (
        <BottomBarActions>
          <ChooserMainAction
            busy={props.busy}
            disabled={disabled}
            onStart={onStart}
            preparing={props.preparing}
          />
        </BottomBarActions>
      )}
    </BottomBar>
  );
}
