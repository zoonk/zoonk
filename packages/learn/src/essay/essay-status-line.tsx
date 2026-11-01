"use client";

import { useTakingLong } from "@zoonk/ui/hooks/taking-long";
import { useExtracted } from "next-intl";
import { ChangeLimitLink } from "../_components/change-limit-link";
import { CreateAccountLink } from "../_components/create-account-link";
import { useSentenceSpace } from "../_utils/locale";
import { useEssayScreen } from "./essay-context";

export type EssayStatus =
  | "dailyLimitReached"
  | "error"
  | "idle"
  | "limitReached"
  | "pending"
  | "signUpRequired";

/** Grading takes about 9 to 17 s, and up to 24 s on the fallback model. */
export const GRADING_BOUNDS = { slowMs: 20_000, timeoutMs: 90_000 } as const;

export function StatusLine({ gradesLeft, status }: { gradesLeft: number; status: EssayStatus }) {
  const t = useExtracted();
  const { hrefs } = useEssayScreen();
  const isSlow = useTakingLong({ active: status === "pending", afterMs: GRADING_BOUNDS.slowMs });
  const space = useSentenceSpace();

  if (status === "error") {
    return (
      <p className="text-destructive-text text-sm" role="alert">
        {t("That didn't go through. Your text is still here. Try again in a moment.")}
      </p>
    );
  }

  if (status === "dailyLimitReached") {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        {t({
          description: "The daily time limit is a setting that stops study for the day.",
          message: "You've reached your daily time limit. Your text stays here.",
        })}
        {space}
        <ChangeLimitLink href={hrefs.dailyLimit} />
      </p>
    );
  }

  if (status === "signUpRequired") {
    return (
      <div className="flex flex-col items-start gap-2" role="status">
        <p className="text-muted-foreground text-sm">
          {t("Create your free account to continue.")}
        </p>
        <CreateAccountLink />
      </div>
    );
  }

  if (status === "limitReached" || gradesLeft === 0) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        {t("You've used today's essay grades. Your text stays here; send it tomorrow.")}
      </p>
    );
  }

  if (status === "pending") {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        {isSlow
          ? t("Still grading. This is taking longer than usual.")
          : t("Reading your essay against each criterion. It can take up to 30 seconds.")}
      </p>
    );
  }

  return null;
}
