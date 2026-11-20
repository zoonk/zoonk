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

  const failed = {
    action: t("Try again"),
    description: null,
    title: t({
      description:
        "The title of a notice over something being prepared for the learner (a lesson, a list, a map) that failed or never started. A Try again button follows.",
      message: "Something went wrong on our side",
    }),
  };

  const copy = {
    connection: {
      action: t("Reconnect"),
      description: t("We stopped getting updates. It may still be working."),
      title: t("Connection lost"),
    },
    generation: failed,
    notStarted: failed,
  }[failure];

  return (
    <NoticeCard className="max-w-column" role="alert">
      <NoticeCardLeading className="text-muted-foreground">
        <FailureIcon failure={failure} />
      </NoticeCardLeading>
      <NoticeCardContent>
        <NoticeCardTitle>{copy.title}</NoticeCardTitle>
        {copy.description && <NoticeCardDescription>{copy.description}</NoticeCardDescription>}
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
