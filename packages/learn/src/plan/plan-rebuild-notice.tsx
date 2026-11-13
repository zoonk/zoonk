"use client";

import { Button } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { safeAsync } from "@zoonk/utils/error";
import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import {
  NoticeCard,
  NoticeCardActions,
  NoticeCardContent,
  NoticeCardDescription,
  NoticeCardLeading,
  NoticeCardTitle,
} from "../_components/notice-card";
import { useChangeSaveFailed } from "../_components/save-error";
import { StatusRegion } from "../_components/status-region";
import { type PlanContentCountry, usePlanScreen } from "./plan-context";

function PreparingNotice() {
  const t = useExtracted();

  return (
    <NoticeCard>
      <NoticeCardLeading className="text-muted-foreground">
        <Spinner className="size-4" />
      </NoticeCardLeading>
      <NoticeCardContent>
        <NoticeCardTitle>{t("Getting your new plan ready")}</NoticeCardTitle>
        <NoticeCardDescription>{t("Keep studying this one until then.")}</NoticeCardDescription>
      </NoticeCardContent>
    </NoticeCard>
  );
}

function FailedNotice({
  onRetried,
  onRetry,
}: {
  onRetried: () => void;
  onRetry: PlanContentCountry["onRetry"];
}) {
  const t = useExtracted();
  const [retrying, startRetry] = useTransition();
  const saveFailed = useChangeSaveFailed();

  const retry = () => {
    startRetry(async () => {
      const { data: started } = await safeAsync(onRetry);

      startRetry(() => {
        if (!started) {
          saveFailed();
        }

        if (started) {
          onRetried();
        }
      });
    });
  };

  return (
    <NoticeCard>
      <NoticeCardLeading>
        <TriangleAlertIcon />
      </NoticeCardLeading>
      <NoticeCardContent>
        <NoticeCardTitle>{t("Your new plan couldn't be made")}</NoticeCardTitle>
        <NoticeCardDescription>{t("Your plan is as it was.")}</NoticeCardDescription>
        <NoticeCardActions>
          <form action={retry} className="contents">
            <Button
              busy={retrying}
              icon={<RotateCcwIcon aria-hidden="true" />}
              size="sm"
              type="submit"
              variant="outline"
            >
              {t("Try again")}
            </Button>
          </form>
        </NoticeCardActions>
      </NoticeCardContent>
    </NoticeCard>
  );
}

/**
 * While a new country's plan is prepared, the old one stays fully usable. The line that says it's
 * ready shows only on the visit that saw it being prepared.
 */
export function PlanRebuildNotice({ className }: { className?: string }) {
  const t = useExtracted();
  const country = usePlanScreen().goal.contentCountry;
  const saved = country?.rebuild ?? "none";
  const [retried, setRetried] = useState(false);

  // A retry shows as preparing at once, until the goal read again says how it's going.
  if (retried && saved !== "failed") {
    setRetried(false);
  }

  const rebuild = retried ? "preparing" : saved;
  const [seen, setSeen] = useState(rebuild);

  if (rebuild !== "none" && seen !== rebuild) {
    setSeen(rebuild);
  }

  const ready = rebuild === "none" && seen === "preparing";

  return (
    <StatusRegion className={className}>
      {rebuild === "preparing" && <PreparingNotice />}
      {rebuild === "failed" && country && (
        <FailedNotice onRetried={() => setRetried(true)} onRetry={country.onRetry} />
      )}
      {ready && <p className="text-muted-foreground text-sm">{t("Your new plan is ready.")}</p>}
    </StatusRegion>
  );
}
