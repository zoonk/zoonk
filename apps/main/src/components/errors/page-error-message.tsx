"use client";

import { EnterButton } from "@zoonk/learn/enter-button";
import { BottomBar, BottomBarActions } from "@zoonk/ui/components/bottom-bar";
import { cn } from "@zoonk/ui/lib/utils";
import { TriangleAlertIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { StatusMessage } from "./status-message";

/** It can't tell a dropped connection from a failure on Zoonk's side, so it blames neither. */
export function PageErrorMessage({
  homeLink,
  inFrame = false,
  onRetry,
}: {
  homeLink?: React.ReactNode;
  inFrame?: boolean;
  onRetry: () => void;
}) {
  const t = useExtracted();
  const Root = inFrame ? "div" : "main";

  return (
    <Root
      className={cn(
        "flex w-full flex-col",
        inFrame
          ? "flex-1"
          : "min-h-dvh [--page-gutter:--spacing(4)] sm:[--page-gutter:--spacing(8)]",
      )}
    >
      <StatusMessage
        description={t("Check your connection and try again.")}
        icon={<TriangleAlertIcon aria-hidden="true" />}
        title={t("This page didn't load")}
      >
        {homeLink}
      </StatusMessage>

      <BottomBar>
        <BottomBarActions>
          <EnterButton onClick={onRetry}>{t("Try again")}</EnterButton>
        </BottomBarActions>
      </BottomBar>
    </Root>
  );
}
