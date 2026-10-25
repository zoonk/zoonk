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
} from "@zoonk/ui/components/alert-dialog";
import { Button, ButtonSkeleton } from "@zoonk/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { EllipsisIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { LearnLink } from "../learn-link";
import { goBackToApp } from "../shell/app-history";
import { useOnboardingHost } from "./onboarding-host";

/** The "⋯", its glyph on the page's right edge as the way back's sits on its left. */
const MENU_TRIGGER_CLASS = "-mr-3 lg:-mr-2.5 [&_svg:not([class*='size-'])]:size-5";

/** A menu row: what it does, and under it what happens to the answers. */
const MENU_ROW_CLASS = "flex-col items-start gap-0.5 py-2";

/**
 * The bar's end, one "⋯" at every size: finishing later, out to the app page the learner left for
 * onboarding with the answers kept (as the ✕ does where there's no way back), and starting over,
 * each saying what happens to the answers. In words in the bar, Start over read as starting the
 * test over beside placement's Start, and said nothing of the answers.
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
 * The end of a goal's onboarding bar: finishing later, so every step has a way out that keeps the
 * answers, and starting over, back to typing a goal, which asks first since the answers so far
 * are dropped.
 */
export function StartOverMenu({
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

/** The bar's "⋯" while the steps load. */
export function StartOverMenuSkeleton() {
  return (
    <ButtonSkeleton className={MENU_TRIGGER_CLASS} size="icon-bar" variant="ghost">
      <EllipsisIcon aria-hidden="true" />
    </ButtonSkeleton>
  );
}
