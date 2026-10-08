"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { RotateCwIcon, TriangleAlertIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { StatusMessage } from "./status-message";

/**
 * A page that failed to load says so calmly and offers to try again, with a quieter way home,
 * instead of the framework's bare error screen. Pages pass their own home link: the app's router
 * link, or a plain link when the whole app failed. Inside the app's frame (`inFrame`), the bar and
 * the tabs are still there to go elsewhere, so it fills the frame's page instead of the screen.
 */
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
        description={t("Something went wrong on our side. Trying again usually fixes it.")}
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
