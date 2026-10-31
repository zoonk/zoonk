"use client";

import { useRouter } from "@/i18n/navigation";
import { Page, PageHeader, PageHeaderContent, PageSubtitle, PageTitle } from "@zoonk/learn/page";
import { usePoll } from "@zoonk/learn/poll";
import { Button } from "@zoonk/ui/components/button";
import { LineMarker } from "@zoonk/ui/components/line-marker";
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
    <Page>
      <PageHeader>
        <PageHeaderContent>
          <PageTitle className="md:text-xl md:leading-tight">
            {waiting ? t("Confirming your subscription") : t("Still confirming your subscription")}
          </PageTitle>

          <PageSubtitle>
            {waiting
              ? t("Stripe is confirming your payment. It usually takes a few seconds.")
              : t(
                  "This is taking longer than usual. If your payment went through, Plus shows up here as soon as Stripe confirms it.",
                )}
          </PageSubtitle>
        </PageHeaderContent>
      </PageHeader>

      {waiting ? (
        <p className="text-muted-foreground flex items-start gap-2 text-sm" role="status">
          <LineMarker>
            <Spinner aria-hidden="true" role="presentation" />
          </LineMarker>
          {t("Checking with Stripe…")}
        </p>
      ) : (
        <Button className="self-start" onClick={restart} variant="outline">
          {t("Check again")}
        </Button>
      )}
    </Page>
  );
}

/** A new check cancels any response belonging to the previous attempt. */
export function StripeCheckoutConfirming() {
  const [round, setRound] = useState(0);
  return <ConfirmationAttempt key={round} restart={() => setRound((current) => current + 1)} />;
}
