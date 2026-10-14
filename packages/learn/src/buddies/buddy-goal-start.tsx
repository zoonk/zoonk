"use client";

import { HistoryIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import { TutorMessage, useTutorIdentity } from "../conversation/tutor-identity";
import { LearnLink } from "../learn-link";
import { MAX_GOAL_LENGTH } from "../onboarding/entry/goal-entry";
import { GoalField, GoalFieldSubmit, GoalFieldText } from "../onboarding/entry/goal-field";
import { useLocalGoalExample } from "../onboarding/entry/use-local-goal-example";
import { BUDDY_COLUMN_CLASS, BuddyHeader } from "./buddy-header";
import { type BuddyStatusView, toLearnBuddy } from "./buddy-status-view";

/** Goals to start with one tap, in the interface language: the same examples onboarding shows. */
function useGoalExamples(): string[] {
  const t = useExtracted();
  const { exam, language } = useLocalGoalExample();

  return [
    t(
      "{exam, select, abitur {Pass the Abitur} bac {Pass the bac} enem {Pass the ENEM} pau {Pass the PAU} other {Pass the SAT}}",
      { exam },
    ),
    t("Speak {language} for a job interview", { language }),
    t("Understand quantum physics"),
  ];
}

/**
 * Example goals as small chips right above the field, as the conversation's suggestions are: a
 * tap fills the field so it can still be edited before sending.
 */
function GoalChips({ examples, onPick }: { examples: string[]; onPick: (goal: string) => void }) {
  const t = useExtracted();

  return (
    <ul aria-label={t("Examples")} className="flex flex-wrap gap-1.5">
      {examples.map((example) => (
        <li className="min-w-0" key={example}>
          <button
            className="text-muted-foreground ring-input hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 hit-area bg-background relative flex h-6.5 max-w-full items-center rounded-md px-2.5 text-xs font-medium ring-1 transition-colors outline-none ring-inset focus-visible:ring-[3px] disabled:opacity-50"
            onClick={() => onPick(example)}
            type="button"
          >
            <span className="truncate">{example}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * The buddy tab before there's a goal to tutor: instead of a dead end, the buddy says what it does
 * with one and takes it right here, in the goal field the home page and onboarding use, with their
 * "Build my plan". It opens onboarding with the same words (`onSend`), so the learner never types
 * them twice. An example fills the field for the learner to edit first.
 */
export function BuddyGoalStart({
  draft = "",
  earlierQuestionsHref,
  onSend,
  status,
}: {
  draft?: string;
  /** The learner's questions from an earlier version of their courses, when they have any. */
  earlierQuestionsHref?: string;
  onSend: (goal: string) => void;
  status: BuddyStatusView;
}) {
  const t = useExtracted();
  const fieldId = useId();
  const buddy = toLearnBuddy({ buddy: status.buddy, status });
  const identity = useTutorIdentity(buddy);
  const examples = useGoalExamples();
  const [goal, setGoal] = useState(draft);
  const trimmed = goal.trim();

  // The hello says the buddy is an AI, since it opens the conversation (EU AI Act art. 50;
  // Decreto 12.880/2026 art. 11 for minors).
  const greeting = t(
    "Hi! I'm {name}, your AI study buddy. What do you want to learn, and by when? I'll turn it into a plan for every day until then.",
    { name: identity.name },
  );

  return (
    <div className={BUDDY_COLUMN_CLASS} data-slot="buddy-goal-start">
      <BuddyHeader buddy={buddy} name={identity.name} stage={status.stage} />

      <TutorMessage identity={identity} page>
        <p>{greeting}</p>
      </TutorMessage>

      {earlierQuestionsHref && (
        <LearnLink
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex min-h-11 items-center gap-1.5 self-start rounded-md text-sm transition-colors outline-none focus-visible:ring-[3px]"
          href={earlierQuestionsHref}
        >
          <HistoryIcon aria-hidden="true" className="size-4" />
          {t("Earlier questions")}
        </LearnLink>
      )}

      <div className="mt-auto flex flex-col gap-2.5 pt-6 pb-3 lg:pb-6">
        <GoalChips examples={examples} onPick={setGoal} />

        <GoalField
          onSubmit={(event) => {
            event.preventDefault();

            if (trimmed) {
              onSend(trimmed);
            }
          }}
        >
          <label className="sr-only" htmlFor={fieldId}>
            {t("Your goal")}
          </label>

          <GoalFieldText
            autoFocusOnPointer
            id={fieldId}
            maxLength={MAX_GOAL_LENGTH}
            onChange={(event) => setGoal(event.target.value)}
            placeholder={t("What you want to learn")}
            value={goal}
          />

          <GoalFieldSubmit disabled={!trimmed}>{t("Build my plan")}</GoalFieldSubmit>
        </GoalField>
      </div>
    </div>
  );
}
