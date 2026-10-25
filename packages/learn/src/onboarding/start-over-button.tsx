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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { cn } from "@zoonk/ui/lib/utils";
import { EllipsisIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { LearnLink } from "../learn-link";
import { goBackToApp } from "../shell/app-history";
import { useOnboardingHost } from "./onboarding-host";

/**
 * Quiet words at the bar's end from `lg`, as tall as its other controls: the size of a page's
 * breadcrumb, its words on the column's right edge, as the way back's chevron sits on its left.
 */
const START_OVER_WORDS_CLASS = "max-lg:hidden lg:-mr-1 lg:h-8 lg:px-1 lg:text-[0.8125rem]";

/** The "⋯" under `lg`, its glyph on the column's right edge as the way back's sits on its left. */
const MENU_TRIGGER_CLASS = "-mr-2.5 lg:hidden [&_svg:not([class*='size-'])]:size-5";

/** A menu row: what it does, and under it what happens to the answers. */
const MENU_ROW_CLASS = "flex-col items-start gap-0.5 py-2";

/**
 * Under `lg`, where no sidebar holds the way out, the bar's end is one "⋯": finishing later, out
 * to the app page the learner left for onboarding with the answers kept (as the ✕ does where
 * there's no way back), and starting over, each saying what happens to the answers.
 */
function OnboardingBarMenu({
  disabled,
  onStartOver,
}: {
  disabled: boolean;
  onStartOver: () => void;
}) {
  const t = useExtracted();
  const host = useOnboardingHost();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button className={MENU_TRIGGER_CLASS} size="icon-bar" variant="ghost" />}
      >
        <EllipsisIcon aria-hidden="true" />
        <span className="sr-only">{t("More")}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64" keepMounted>
        <DropdownMenuItem
          className={MENU_ROW_CLASS}
          render={
            <LearnLink
              href={host?.kind === "page" ? host.backHref : "/today"}
              onClick={(event) => {
                if (goBackToApp()) {
                  event.preventDefault();
                }
              }}
            />
          }
        >
          {t("Finish later")}
          <span className="text-muted-foreground text-xs">{t("Your answers are kept")}</span>
        </DropdownMenuItem>

        <DropdownMenuItem className={MENU_ROW_CLASS} disabled={disabled} onClick={onStartOver}>
          {t("Start over")}
          <span className="text-muted-foreground text-xs">{t("Clears your answers")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Starting over, at the end of a goal's onboarding bar: back to typing a goal, after asking, since
 * the answers so far are dropped. From `lg` it says so in words (an ✕ there read as closing), and
 * the sidebar holds the way out; under `lg` it shares a "⋯" with finishing later, so every step
 * has a way out that keeps the answers.
 */
export function StartOverButton({
  disabled,
  onStartOver,
}: {
  disabled: boolean;
  onStartOver: () => void;
}) {
  const t = useExtracted();
  const [confirming, setConfirming] = useState(false);

  return (
    <AlertDialog onOpenChange={setConfirming} open={confirming}>
      <AlertDialogTrigger
        render={
          <Button
            className={cn(
              "text-muted-foreground hover:text-foreground lg:hover:bg-transparent",
              START_OVER_WORDS_CLASS,
            )}
            disabled={disabled}
            size="bar"
            variant="ghost"
          />
        }
      >
        {t("Start over")}
      </AlertDialogTrigger>

      <OnboardingBarMenu disabled={disabled} onStartOver={() => setConfirming(true)} />

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

/** The bar's end while the steps load: Start over's words from `lg`, the "⋯" under it. */
export function StartOverButtonSkeleton() {
  const t = useExtracted();

  return (
    <>
      <ButtonSkeleton className={START_OVER_WORDS_CLASS} size="bar" variant="ghost">
        {t("Start over")}
      </ButtonSkeleton>
      <ButtonSkeleton className={MENU_TRIGGER_CLASS} size="icon-bar" variant="ghost">
        <EllipsisIcon aria-hidden="true" />
      </ButtonSkeleton>
    </>
  );
}
