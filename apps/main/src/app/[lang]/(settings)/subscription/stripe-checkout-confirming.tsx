"use client";

import { useRouter } from "@/i18n/navigation";
import { usePoll } from "@zoonk/learn/poll";
import { Button } from "@zoonk/ui/components/button";
import {
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
} from "@zoonk/ui/components/container";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { Spinner } from "@zoonk/ui/components/spinner";
import { useExtracted } from "next-intl";
import { SettingsPage, SettingsPageTitle } from "../_components/settings-page";

/** Stripe's webhook usually saves the subscription within seconds of the return. */
const CONFIRMATION_POLL_MS = 3000;
/** After this long, the page says it's taking longer and offers to check again. */
const CONFIRMATION_TIMEOUT_MS = 45_000;

/**
 * Back from Stripe before its webhook saved the subscription: the page says it's confirming and
 * reads itself again until the subscription shows, when the plan replaces this. After a while it
 * says it's still confirming, with a way to check again, never the offer they just paid for.
 */
export function StripeCheckoutConfirming() {
  const t = useExtracted();
  const router = useRouter();

  const poll = usePoll({
    active: true,
    intervalMs: CONFIRMATION_POLL_MS,
    onPoll: () => router.refresh(),
    timeoutMs: CONFIRMATION_TIMEOUT_MS,
  });

  const waiting = poll.status === "polling";

  return (
    <SettingsPage>
      <ContainerHeader>
        <ContainerHeaderGroup>
          <SettingsPageTitle>
            {waiting ? t("Confirming your subscription") : t("Still confirming your subscription")}
          </SettingsPageTitle>

          <ContainerDescription>
            {waiting
              ? t("Stripe is confirming your payment. It usually takes a few seconds.")
              : t(
                  "This is taking longer than usual. If your payment went through, Plus shows up here as soon as Stripe confirms it.",
                )}
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        {waiting ? (
          <p className="text-muted-foreground flex items-start gap-2 text-sm" role="status">
            <LineMarker>
              <Spinner aria-hidden="true" role="presentation" />
            </LineMarker>
            {t("Checking with Stripe…")}
          </p>
        ) : (
          <Button className="self-start" onClick={poll.restart} variant="outline">
            {t("Check again")}
          </Button>
        )}
      </ContainerBody>
    </SettingsPage>
  );
}
