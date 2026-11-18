"use client";

import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { useExtracted } from "next-intl";
import { EnterButton } from "../../_components/enter-button";
import { OnboardingActions } from "../onboarding-frame";
import { GoalFieldSubmit } from "./goal-field";

/** In a section the box holds its own button; on its own page the button is the page's main action. */
export function GoalEntrySubmit({
  disabled,
  form,
  pinned = Boolean(form),
}: {
  disabled?: boolean;
  form?: string;
  pinned?: boolean;
}) {
  const t = useExtracted();
  const ref = useEnterClick<HTMLButtonElement>();

  if (!pinned) {
    return (
      <GoalFieldSubmit disabled={disabled} ref={ref}>
        {t("Build my plan")}
      </GoalFieldSubmit>
    );
  }

  return (
    <OnboardingActions>
      {/* Enter in the goal's field submits its form, so the key is the field's. */}
      <EnterButton disabled={disabled} enter="host" form={form} ref={ref} type="submit">
        {t("Build my plan")}
      </EnterButton>
    </OnboardingActions>
  );
}
