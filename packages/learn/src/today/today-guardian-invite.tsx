"use client";

import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { ShieldCheckIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { KindTile } from "../_components/kind-tile";
import {
  NoticeCardActions,
  NoticeCardContent,
  NoticeCardDescription,
  NoticeCardLeading,
  NoticeCardTitle,
} from "../_components/notice-card";
import { SURFACE_CLASS } from "../_components/surface";
import { LearnLink } from "../learn-link";
import { useTodayScreen } from "./today-context";

/**
 * "Invite a parent or guardian": a teen who started as a guest is asked once they have an
 * account, since onboarding couldn't ask a guest. "Not now" puts it away for good (Settings keeps
 * the invite); it also stops asking the day after they signed up.
 */
export function TodayGuardianInvite() {
  const t = useExtracted();
  const { actions } = useTodayScreen();
  const [dismissed, setDismissed] = useState(false);

  function dismiss() {
    setDismissed(true);
    void actions.dismissGuardianInvite();
  }

  if (dismissed) {
    return null;
  }

  return (
    <aside
      aria-label={t("Invite a parent or guardian")}
      className={cn(SURFACE_CLASS, "flex items-start gap-3 p-4")}
    >
      <NoticeCardLeading>
        <KindTile icon={ShieldCheckIcon} kind="practice" size="sm" />
      </NoticeCardLeading>

      <NoticeCardContent>
        <NoticeCardTitle>{t("Invite a parent or guardian")}</NoticeCardTitle>
        <NoticeCardDescription>
          {t(
            "They'll see your weekly activity and can set a daily time limit, turn memory off and approve Plus. Never your answers.",
          )}
        </NoticeCardDescription>

        <NoticeCardActions>
          <LearnLink className={buttonVariants({ size: "sm" })} href="/settings/guardian">
            {t("Invite")}
          </LearnLink>
          <Button onClick={dismiss} size="sm" variant="ghost">
            {t("Not now")}
          </Button>
        </NoticeCardActions>
      </NoticeCardContent>
    </aside>
  );
}
