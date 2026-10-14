"use client";

import { Button } from "@zoonk/ui/components/button";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { CompassIcon, PaperclipIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useRef, useState } from "react";
import { LearnLink } from "../../learn-link";
import { type GoalError } from "../goal-errors";
import {
  OnboardingColumn,
  OnboardingDescription,
  OnboardingHeading,
  OnboardingTitle,
} from "../onboarding-frame";
import { useOnboardingSection } from "../onboarding-host";
import { GoalExamples } from "./goal-examples";
import { GoalField, GoalFieldLabel, GoalFieldSubmit, GoalFieldText } from "./goal-field";
import { GoalErrorAlert } from "./goal-outcomes";
import { useLocalGoalExample } from "./use-local-goal-example";

/** The same limit core applies to a typed goal. */
export const MAX_GOAL_LENGTH = 2000;

/**
 * Sends the goal. Enter in the box sends it too; from elsewhere on the screen, such as right after
 * picking what to do with attached material, Enter presses this. It's never greyed out: with
 * nothing to send, it puts the cursor in the box instead.
 */
function SubmitButton() {
  const t = useExtracted();
  const ref = useEnterClick<HTMLButtonElement>();

  return <GoalFieldSubmit ref={ref}>{t("Build my plan")}</GoalFieldSubmit>;
}

/**
 * The first onboarding screen: one question and one box for the goal in the learner's own
 * words, examples that start it in one tap, the Library for browsing, and a paperclip for
 * studying their own material. Inside a host's page (Today without a goal) it's that page's
 * "Start a goal" section, under the page's title, its link to the Library right under the
 * examples.
 */
export function GoalEntry({
  attachment,
  canSubmitEmpty = false,
  defaultGoal,
  error,
  exploreHref,
  fromSharedPlan = false,
  notice,
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
  /** What the learner should know before typing, such as a goal limit Plus lifts. */
  notice?: React.ReactNode;
  onAttach?: () => void;
  onSubmit: (goal: string) => void;
  signUpHref: string;
}) {
  const t = useExtracted();
  const section = useOnboardingSection();
  const example = useLocalGoalExample();
  const inputId = useId();
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const [goal, setGoal] = useState(defaultGoal);

  const submit = (value: string) => {
    if (value.trim() || canSubmitEmpty) {
      onSubmit(value.trim());
      return;
    }

    fieldRef.current?.focus();
  };

  return (
    <OnboardingColumn className={cn(section && "gap-4")}>
      {section ? (
        <h2 className="text-label">{t("Start a goal")}</h2>
      ) : (
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
      )}

      {notice}

      {/* The landing's field: "I want to", then the words. On phones the words keep the
          field's width, the paperclip and "Build my plan" under them; from tablets one row. */}
      <GoalField
        className="flex-col items-stretch sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          submit(goal);
        }}
      >
        <div className="flex min-w-0 flex-1 items-start gap-2 pr-2.5 sm:pr-0">
          <GoalFieldLabel htmlFor={inputId}>{t("I want to")}</GoalFieldLabel>

          <GoalFieldText
            autoFocusOnPointer
            id={inputId}
            maxLength={MAX_GOAL_LENGTH}
            onChange={(event) => setGoal(event.target.value)}
            placeholder={t(
              "{exam, select, abitur {pass the Abitur, speak {language}…} bac {pass the bac, speak {language}…} enem {pass the ENEM, speak {language}…} pau {pass the PAU, speak {language}…} other {pass the SAT, speak {language}…}}",
              example,
            )}
            ref={fieldRef}
            value={goal}
          />
        </div>

        <div className="flex items-end justify-end gap-1">
          {onAttach && (
            <Button
              aria-label={t("Study your own material")}
              className="text-muted-foreground mr-auto -ml-2.5 size-11 shrink-0 sm:mr-0 sm:ml-0"
              onClick={onAttach}
              size="icon-lg"
              type="button"
              variant="ghost"
            >
              <PaperclipIcon aria-hidden="true" />
            </Button>
          )}

          <SubmitButton />
        </div>
      </GoalField>

      {attachment}

      <GoalErrorAlert error={error} signUpHref={signUpHref} />

      {/* Under Today's title the page's aside holds them from 72rem (`StartFlow`'s rail). */}
      <GoalExamples className={cn(section && "min-[72rem]:hidden")} onPick={submit} />

      {/* Right under the examples on every screen, never pinned under the tab bar. */}
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <LearnLink
          className="hover:text-foreground inline-flex min-h-11 items-center gap-1.5 underline-offset-4 hover:underline"
          href={exploreHref}
        >
          <CompassIcon aria-hidden="true" className="size-4" />
          {t("Explore courses")}
        </LearnLink>
      </div>
    </OnboardingColumn>
  );
}
