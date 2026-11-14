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
import { useId, useState } from "react";
import { LearnLink } from "../learn-link";
import { goBackToApp } from "../shell/app-history";
import { useOnboardingHost } from "./onboarding-host";

const MENU_ROW_CLASS = "flex-col items-start gap-0.5 py-2";

type MenuProps = {
  disabled: boolean;
  /** Shown only on the questions about the learner. */
  onDeclineProfile?: () => void;
  onStartOver: () => void;
};

function OnboardingBarMenu({ disabled, onDeclineProfile, onStartOver }: MenuProps) {
  const t = useExtracted();
  const host = useOnboardingHost();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button edge="end" size="icon-bar" variant="ghost" />}>
        <EllipsisIcon aria-hidden="true" />
        <span className="sr-only">
          {t({
            description: "A menu or section of other options and links, like an app's “More” menu.",
            message: "More",
          })}
        </span>
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

        {onDeclineProfile && (
          <DropdownMenuItem
            className={MENU_ROW_CLASS}
            disabled={disabled}
            onClick={onDeclineProfile}
          >
            {t("Don't ask me these again")}
            <span className="text-muted-foreground text-xs">
              {t("You can still answer them anytime in Settings › About you.")}
            </span>
          </DropdownMenuItem>
        )}

        <DropdownMenuItem
          aria-haspopup="dialog"
          className={MENU_ROW_CLASS}
          disabled={disabled}
          onClick={onStartOver}
        >
          {t("Start over")}
          <span className="text-muted-foreground text-xs">{t("Clears your answers")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StartOverMenu({ onStartOver, ...menu }: MenuProps) {
  const t = useExtracted();
  const [confirming, setConfirming] = useState(false);

  return (
    <AlertDialog onOpenChange={setConfirming} open={confirming}>
      <OnboardingBarMenu {...menu} onStartOver={() => setConfirming(true)} />

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("Start over?")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("Your answers for this goal are cleared, and you type a goal again.")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              setConfirming(false);
              onStartOver();
            }}
          >
            {t("Start over")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function StartOverMenuSkeleton() {
  return (
    <ButtonSkeleton edge="end" size="icon-bar" variant="ghost">
      <EllipsisIcon aria-hidden="true" />
    </ButtonSkeleton>
  );
}

function SkipProfileButton({ disabled, onSkip }: { disabled: boolean; onSkip: () => void }) {
  const t = useExtracted();
  const descriptionId = useId();

  return (
    <>
      <Button
        aria-describedby={descriptionId}
        disabled={disabled}
        onClick={onSkip}
        size="sm"
        variant="ghost"
      >
        {t({
          description: "Skips every remaining question about the learner in this setup.",
          message: "Skip all",
        })}
      </Button>
      <span className="sr-only" id={descriptionId}>
        {t("Skip the rest of the questions about you")}
      </span>
    </>
  );
}

/** On the questions about the learner, Skip all comes first and the menu can decline them all. */
export function StepsBarEnd({
  disabled,
  onSkipProfile,
  onStartOver,
  profile,
}: {
  disabled: boolean;
  onSkipProfile: (forever: boolean) => void;
  onStartOver: () => void;
  /** Whether the screen is one of the questions about the learner. */
  profile: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      {profile && <SkipProfileButton disabled={disabled} onSkip={() => onSkipProfile(false)} />}
      <StartOverMenu
        disabled={disabled}
        onDeclineProfile={profile ? () => onSkipProfile(true) : undefined}
        onStartOver={onStartOver}
      />
    </div>
  );
}
