"use client";

import { Button } from "@zoonk/ui/components/button";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { ArrowUpIcon, CompassIcon, PaperclipIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import { usePrimaryVariant } from "../../_utils/fun-primary";
import { LearnLink } from "../../learn-link";
import { type GoalError } from "../goal-errors";
import {
  OnboardingColumn,
  OnboardingDescription,
  OnboardingHeading,
  OnboardingTitle,
} from "../onboarding-frame";
import { GoalExamples } from "./goal-examples";
import { GoalErrorAlert } from "./goal-outcomes";
import { useLocalGoalExample } from "./use-local-goal-example";

/** The same limit core applies to a typed goal. */
export const MAX_GOAL_LENGTH = 2000;

/**
 * Sends the goal. Enter in the box sends it too; from elsewhere on the screen, such as right after
 * picking what to do with attached material, Enter presses this.
 */
function SubmitButton({ disabled }: { disabled: boolean }) {
  const t = useExtracted();
  const primaryVariant = usePrimaryVariant();
  const ref = useEnterClick<HTMLButtonElement>({ enabled: !disabled });

  return (
    <Button
      aria-label={t("Start with your goal")}
      className="size-11 shrink-0 rounded-full"
      disabled={disabled}
      ref={ref}
      size="icon-lg"
      type="submit"
      variant={primaryVariant}
    >
      <ArrowUpIcon aria-hidden="true" className="size-5" />
    </Button>
  );
}

/**
 * The first onboarding screen: one question and one box for the goal in the learner's own
 * words, examples that start it in one tap, the Library for browsing, and a paperclip for
 * studying their own material.
 */
export function GoalEntry({
  attachment,
  canSubmitEmpty = false,
  defaultGoal,
  error,
  exploreHref,
  fromSharedPlan = false,
  onAttach,
  onSubmit,
  signUpHref,
}: {
  /** What the paperclip attached and how to add more, under the box. */
  attachment?: React.ReactNode;
  /** The learner attached material and said what to do with it, so the words are optional. */
  canSubmitEmpty?: boolean;
  defaultGoal: string;
  error: GoalError | null;
  exploreHref: string;
  /** Opened from someone's plan link: the goal starts from that plan. */
  fromSharedPlan?: boolean;
  onAttach?: () => void;
  onSubmit: (goal: string) => void;
  signUpHref: string;
}) {
  const t = useExtracted();
  const example = useLocalGoalExample();
  const inputId = useId();
  const [goal, setGoal] = useState(defaultGoal);
  const trimmed = goal.trim();

  const submit = (value: string) => {
    if (value.trim() || canSubmitEmpty) {
      onSubmit(value.trim());
    }
  };

  return (
    <OnboardingColumn>
      <OnboardingHeading>
        <OnboardingTitle>{t("What do you want to achieve?")}</OnboardingTitle>
        <OnboardingDescription>
          {fromSharedPlan
            ? t(
                "Tell us in your own words. Your plan starts from the plan someone shared with you.",
              )
            : t("Tell us in your own words. We'll build the plan.")}
        </OnboardingDescription>
      </OnboardingHeading>

      <form
        className={cn(
          "bg-muted/60 focus-within:ring-ring/40 flex items-end gap-2 rounded-3xl p-2 pl-4 focus-within:ring-[3px]",
          "in-data-[mode=fun]:fun-glass",
        )}
        onSubmit={(event) => {
          event.preventDefault();
          submit(goal);
        }}
      >
        {onAttach && (
          <Button
            aria-label={t("Study your own material")}
            className="-ml-2 shrink-0"
            onClick={onAttach}
            size="icon"
            type="button"
            variant="ghost"
          >
            <PaperclipIcon aria-hidden="true" />
          </Button>
        )}

        <label className="sr-only" htmlFor={inputId}>
          {t("Your goal")}
        </label>

        <textarea
          autoFocus
          className="placeholder:text-muted-foreground/80 field-sizing-content max-h-48 min-h-11 w-full min-w-0 resize-none bg-transparent py-2.5 text-[17px] leading-snug outline-none"
          enterKeyHint="go"
          id={inputId}
          maxLength={MAX_GOAL_LENGTH}
          onChange={(event) => setGoal(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit(goal);
            }
          }}
          placeholder={t(
            "{exam, select, abitur {E.g., pass the Abitur, speak {language}…} bac {E.g., pass the bac, speak {language}…} enem {E.g., pass the ENEM, speak {language}…} pau {E.g., pass the PAU, speak {language}…} other {E.g., pass the SAT, speak {language}…}}",
            example,
          )}
          rows={1}
          value={goal}
        />

        <SubmitButton disabled={!trimmed && !canSubmitEmpty} />
      </form>

      {attachment}

      <GoalErrorAlert error={error} signUpHref={signUpHref} />

      <GoalExamples onPick={submit} />

      <div className="text-muted-foreground mt-auto flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-4 text-sm">
        <LearnLink
          className="text-foreground inline-flex min-h-11 items-center gap-1.5 font-medium underline-offset-4 hover:underline"
          href={exploreHref}
        >
          <CompassIcon aria-hidden="true" className="size-4" />
          {t("Explore courses")}
        </LearnLink>
      </div>
    </OnboardingColumn>
  );
}
