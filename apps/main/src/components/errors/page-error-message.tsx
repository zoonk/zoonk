"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { RotateCwIcon, TriangleAlertIcon } from "lucide-react";
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
    <Root className={cn("flex w-full flex-col", inFrame ? "flex-1" : "min-h-dvh")}>
      <StatusMessage
        description={t(
          "It might be your connection or a problem on our side. Trying again usually fixes it.",
        )}
        icon={<TriangleAlertIcon aria-hidden="true" />}
        title={t("This page didn't load")}
      >
        <Button onClick={onRetry} size="lg">
          <RotateCwIcon aria-hidden="true" data-icon="inline-start" />
          {t("Try again")}
        </Button>

        {homeLink}
      </StatusMessage>
    </Root>
  );
}
