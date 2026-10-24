"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@zoonk/ui/components/alert-dialog";
import { Button, ButtonSkeleton } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";

/**
 * Quiet words at the bar's end, as tall as its other controls: the size of a page's breadcrumb from
 * `lg`, its words on the screen's right edge, as the way back's chevron sits on its left edge.
 */
const START_OVER_SIZE_CLASS = "px-3 lg:-mr-1 lg:h-8 lg:px-1 lg:text-[0.8125rem]";

/**
 * Starting over, at the end of a goal's onboarding bar: back to typing a goal, after asking, since
 * the answers so far are dropped. It says so in words at every size: an ✕ there read as closing.
 */
export function StartOverButton({
  disabled,
  onStartOver,
}: {
  disabled: boolean;
  onStartOver: () => void;
}) {
  const t = useExtracted();

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            className={cn(
              "text-muted-foreground hover:text-foreground lg:hover:bg-transparent",
              START_OVER_SIZE_CLASS,
            )}
            disabled={disabled}
            size="bar"
            variant="ghost"
          />
        }
      >
        {t("Start over")}
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("Start over?")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("Your answers for this goal are cleared, and you type a goal again.")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onStartOver}>{t("Start over")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Start over's place while the steps load, as wide as its words. */
export function StartOverButtonSkeleton() {
  const t = useExtracted();

  return (
    <ButtonSkeleton className={START_OVER_SIZE_CLASS} size="bar" variant="ghost">
      {t("Start over")}
    </ButtonSkeleton>
  );
}
