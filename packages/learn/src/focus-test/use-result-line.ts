"use client";

import { type FocusTestFocus } from "@zoonk/core/learner/placement/focus-test-contract";
import { useExtracted } from "next-intl";
import { type Decision } from "./focus-test-proposal";

/** The plan gives a focus more time only when it follows it: these it doesn't. */
function isOnlySuggested(state: FocusTestFocus["state"]): boolean {
  return state === "handPicked" || state === "declined";
}

/** The result's headline is the result; a line under it only says what the plan did with it. */
export function useResultWords() {
  const t = useExtracted();

  const title = ({
    focus,
    lessonsSkipped,
  }: {
    focus: Pick<FocusTestFocus, "rows" | "state"> | null;
    lessonsSkipped: number;
  }): string => {
    if (focus) {
      const count = focus.rows.length;

      return isOnlySuggested(focus.state)
        ? t(
            "{count, plural, one {The test suggests this subject} other {The test suggests these # subjects}}",
            { count },
          )
        : t("{count, plural, one {Focus on this subject} other {Focus on these # subjects}}", {
            count,
          });
    }

    return lessonsSkipped > 0
      ? t(
          "{count, plural, one {Your plan skips # lesson you already know} other {Your plan skips # lessons you already know}}",
          { count: lessonsSkipped },
        )
      : t("Your plan starts from the basics");
  };

  const answered = (decision: Decision): string => {
    switch (decision) {
      case "applied":
        return t("Your plan now gives these subjects more time.");
      case "declined":
        return t("Your plan stays as it was.");
      case "undone":
        return t("Undone. Your plan is back as it was.");
      default:
        return decision satisfies never;
    }
  };

  const line = (state: FocusTestFocus["state"]): string | null => {
    switch (state) {
      case "current":
        return t("Your plan gives these subjects more time.");
      case "handPicked":
        return t("Your plan keeps the focus you chose.");
      case "declined":
        return t("Your plan stays as it is.");
      case "ifTimeShort":
      case "proposed":
      case "suggested":
        return null;
      default:
        return state satisfies never;
    }
  };

  return { answered, line, title };
}
