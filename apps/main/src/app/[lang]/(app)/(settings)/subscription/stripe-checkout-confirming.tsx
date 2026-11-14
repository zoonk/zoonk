"use client";

import { SectionPageHeader } from "@/components/learn/section-page";
import { useRouter } from "@/i18n/navigation";
import { Page, PageSection, PageSectionTitle, PageSubtitle } from "@zoonk/learn/page";
import { usePoll } from "@zoonk/learn/poll";
import { Button } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { useExtracted } from "next-intl";
import { useEffect, useState } from "react";
import { hasPlusSubscriptionAction } from "./subscription-status-action";

const CONFIRMATION_POLL_MS = 3000;
const CONFIRMATION_TIMEOUT_MS = 45_000;

/** Never the offer they just paid for, even after the timeout. */
function ConfirmationAttempt({ restart }: { restart: () => void }) {
  const t = useExtracted();
  const router = useRouter();
  const [expired, setExpired] = useState(false);

  // A stalled status response must not hold the timeout and its recovery button hostage.
  useEffect(() => {
    const timer = setTimeout(() => setExpired(true), CONFIRMATION_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  const poll = usePoll({
    active: !expired,
    intervalMs: CONFIRMATION_POLL_MS,
    onPoll: async (signal) => {
      if ((await hasPlusSubscriptionAction()) && !signal.aborted) {
        router.refresh();
      }
    },
    timeoutMs: CONFIRMATION_TIMEOUT_MS,
  });

  const waiting = poll.status === "polling";

  return (
    <Page className="max-w-form">
      <SectionPageHeader title={t("Subscription")} />

      <PageSection>
        <div className="flex flex-col gap-1">
          <PageSectionTitle>
            {waiting ? t("Turning on Plus") : t("Still working on it")}
          </PageSectionTitle>

          <PageSubtitle>
            {waiting
              ? t("This takes a few seconds.")
              : t("Plus will show up here once your payment is confirmed.")}
          </PageSubtitle>
        </div>
      </PageSection>

      {/* One row's height for both, so the slow state moves nothing. */}
      <div className="flex min-h-7.5 items-center">
        {waiting ? (
          <span className="text-muted-foreground flex items-center gap-2 text-sm" role="status">
            <Spinner aria-hidden="true" className="size-4" role="presentation" />
            {t("Confirming your payment…")}
          </span>
        ) : (
          <Button onClick={restart} size="sm" variant="outline">
            {t("Check again")}
          </Button>
        )}
      </div>
    </Page>
  );
}

/** A new check cancels any response belonging to the previous attempt. */
export function StripeCheckoutConfirming() {
  const [round, setRound] = useState(0);
  return <ConfirmationAttempt key={round} restart={() => setRound((current) => current + 1)} />;
}
