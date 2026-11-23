"use client";

import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { TutorMessage, useTutorIdentity } from "../conversation/tutor-identity";
import { GoalBox } from "../onboarding/entry/goal-box";
import { useGoalExamples } from "../onboarding/entry/goal-examples";
import { GoalFieldSubmit, useGoalFieldAction } from "../onboarding/entry/goal-field";
import { BUDDY_COLUMN_CLASS, BuddyHeader } from "./buddy-header";
import { type BuddyStatusView, toLearnBuddy } from "./buddy-status-view";

/** As many as fit a phone's width in two lines, drawn as the buddy's own chips. */
const SHOWN_EXAMPLES = 3;

function GoalChips({ onPick }: { onPick: (goal: string) => void }) {
  const t = useExtracted();
  const examples = useGoalExamples().slice(0, SHOWN_EXAMPLES);

  return (
    <ul aria-label={t("Examples")} className="flex flex-wrap gap-2">
      {examples.map(({ label }) => (
        <li className="min-w-0" key={label}>
          <Button className="max-w-full" onClick={() => onPick(label)} variant="outline">
            <span className="truncate">{label}</span>
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function BuddyGoalStart({
  draft = "",
  onSend,
  status,
}: {
  draft?: string;
  onSend: (goal: string) => void;
  status: BuddyStatusView;
}) {
  const t = useExtracted();
  const buddy = toLearnBuddy({ buddy: status.buddy, status });
  const identity = useTutorIdentity(buddy);
  const goal = useGoalFieldAction({ onSend });

  // The hello says the buddy is an AI, since it opens the conversation (EU AI Act art. 50;
  // Decreto 12.880/2026 art. 11 for minors).
  const greeting = t(
    "Hi! I'm {name}, your AI study buddy. Tell me what you want to learn, and I'll build your plan.",
    { name: identity.name },
  );

  return (
    <div className={BUDDY_COLUMN_CLASS} data-slot="buddy-goal-start">
      <BuddyHeader buddy={buddy} name={identity.name} />

      <TutorMessage identity={identity} page>
        <p>{greeting}</p>
      </TutorMessage>

      <div className="mt-auto flex flex-col gap-2.5 pt-6 pb-3 lg:pb-6">
        <GoalChips onPick={goal.fill} />

        <GoalBox defaultValue={draft} goal={goal}>
          <GoalFieldSubmit>{t("Build my plan")}</GoalFieldSubmit>
        </GoalBox>
      </div>
    </div>
  );
}
