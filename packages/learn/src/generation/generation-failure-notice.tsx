"use client";

import { Button } from "@zoonk/ui/components/button";
import { CircleAlertIcon, WifiOffIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import {
  NoticeCard,
  NoticeCardActions,
  NoticeCardContent,
  NoticeCardDescription,
  NoticeCardLeading,
  NoticeCardTitle,
} from "../_components/notice-card";
import { type GenerationFailure } from "./generation-run";

function FailureIcon({ failure }: { failure: GenerationFailure }) {
  return failure === "connection" ? (
    <WifiOffIcon aria-hidden="true" />
  ) : (
    <CircleAlertIcon aria-hidden="true" />
  );
}

export function GenerationFailureNotice({
  barHasMainAction = false,
  failure,
  retry,
}: {
  /** The screen's bar holds its one main action, so retrying is a secondary button here. */
  barHasMainAction?: boolean;
  failure: GenerationFailure;
  retry?: () => void;
}) {
  const t = useExtracted();

  const copy = {
    connection: {
      action: t("Reconnect"),
      description: t("We stopped getting updates. It may still be working."),
      title: t("Connection lost"),
    },
    generation: {
      action: t("Try again"),
      description: t("Something went wrong on our side."),
      title: t({
        description: "Preparing this content failed. It is not still running.",
        message: "This didn't finish",
      }),
    },
    notStarted: {
      action: t("Try again"),
      description: t("We couldn't get this started."),
      title: t("This didn't start"),
    },
  }[failure];

  return (
    <NoticeCard className="max-w-column" role="alert">
      <NoticeCardLeading className="text-muted-foreground">
        <FailureIcon failure={failure} />
      </NoticeCardLeading>
      <NoticeCardContent>
        <NoticeCardTitle>{copy.title}</NoticeCardTitle>
        <NoticeCardDescription>{copy.description}</NoticeCardDescription>
        {retry && (
          <form action={() => retry()} className="contents">
            <NoticeCardActions>
              <Button size="sm" type="submit" variant={barHasMainAction ? "outline" : "default"}>
                {copy.action}
              </Button>
            </NoticeCardActions>
          </form>
        )}
      </NoticeCardContent>
    </NoticeCard>
  );
}
