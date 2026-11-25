"use client";

import { MAX_GOAL_SOURCES } from "@zoonk/core/goals/goal-input-limits";
import { useExtracted } from "next-intl";
import { useRef, useState } from "react";
import { useFocusOnRemovedControl } from "../../_components/suggestion-focus";
import { useAppLocale } from "../../_utils/locale";
import { type GoalError, useGoalLimitWords } from "../goal-errors";
import {
  type AttachedSource,
  type GoalAttachActions,
  type OnboardingRoutes,
} from "../onboarding-actions";
import {
  OnboardingColumn,
  OnboardingDescription,
  OnboardingHeading,
  OnboardingTitle,
} from "../onboarding-frame";
import { AttachPanel, SignUpPrompt } from "./attach-panel";
import { AttachedChips, UnreadableNote } from "./attached-chips";
import { GoalEntry } from "./goal-entry";
import { GoalLimitBar } from "./goal-limit-notice";
import { type StartAttachment, type StartMaterial } from "./material-goal";
import { type MaterialIntent, MaterialIntentChoice } from "./material-intent";
import { useFollowReading } from "./use-follow-reading";
import { useSendAfterAdding } from "./use-send-after-adding";

function GoalAttachments({
  attach,
  canAttach,
  intent,
  items,
  language,
  onAdded,
  onIntentChange,
  onRemove,
  open,
  ref,
  signUpHref,
}: {
  attach: GoalAttachActions;
  canAttach: boolean;
  intent: MaterialIntent | null;
  items: StartAttachment[];
  language: string;
  onAdded: () => void;
  onIntentChange: (intent: MaterialIntent) => void;
  onRemove: (id: string) => void;
  open: boolean;
  ref: React.Ref<HTMLDivElement>;
  signUpHref: string;
}) {
  const t = useExtracted();
  const [added, setAdded] = useState<AttachedSource | null>(null);
  const shownAdded = items.find((item) => item.id === added?.id);

  return (
    <div className="flex flex-col gap-3" ref={ref}>
      <p className="sr-only" role="status">
        {/* Keyed, so a second "Your text" is announced too. */}
        {shownAdded && (
          <span key={shownAdded.id}>
            {t({
              description:
                "Read by screen readers once material is added. {title} is a file's name, a link or “Your text”.",
              message: "Added to your material: {title}",
              values: { title: shownAdded.title || t("Your text") },
            })}
          </span>
        )}
      </p>

      {items.length > 0 && <AttachedChips items={items} onRemove={onRemove} />}

      {items.length > 0 && !open && (
        <MaterialIntentChoice className="mt-3" onChange={onIntentChange} value={intent} />
      )}

      {/* Under the choices: a read that settles while the learner picks one moves nothing above it. */}
      <UnreadableNote items={items} />

      {open && !canAttach && <SignUpPrompt signUpHref={signUpHref} />}

      {open && canAttach && (
        <AttachPanel
          attach={attach}
          language={language}
          onAttached={(source) => {
            setAdded(source);
            onAdded();
          }}
        />
      )}
    </div>
  );
}

function AttachableGoalEntry({
  attach,
  canAttach,
  defaultGoal,
  error,
  fromSharedPlan,
  material: { attached, intent, setAttached, setIntent, settle },
  onSubmit,
  routes,
}: {
  attach: GoalAttachActions;
  canAttach: boolean;
  defaultGoal: string;
  error: GoalError | null;
  fromSharedPlan: boolean;
  material: Pick<StartMaterial, "attached" | "intent" | "setAttached" | "setIntent" | "settle">;
  onSubmit: (goal: string) => void;
  routes: OnboardingRoutes;
}) {
  const locale = useAppLocale();
  const [open, setOpen] = useState(false);
  const material = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  useFollowReading({ onSettled: settle, read: attach.readStatus, sources: attached });

  const sending = useSendAfterAdding({
    attach,
    onAdded: (source) =>
      setAttached((current) => [...current.filter((item) => item.id !== source.id), source]),
    onSend: onSubmit,
  });

  // Not the new material's Remove: a learner still pressing Enter would remove what they added.
  useFocusOnRemovedControl(material, () => toggle.current);

  return (
    <GoalEntry
      attachDisabled={attached.length >= MAX_GOAL_SOURCES}
      attachOpen={open}
      attachRef={toggle}
      attachment={
        <GoalAttachments
          attach={sending.attach}
          canAttach={canAttach}
          intent={intent}
          items={attached}
          language={locale}
          onAdded={() => setOpen(false)}
          onIntentChange={setIntent}
          onRemove={(id) => {
            setAttached((current) => current.filter((item) => item.id !== id));
            setOpen(false);
          }}
          open={open}
          ref={material}
          signUpHref={routes.signUp}
        />
      }
      canSubmitEmpty={attached.length > 0 && intent !== null}
      defaultGoal={defaultGoal}
      error={error}
      fromSharedPlan={fromSharedPlan}
      hasAccount={canAttach}
      onAttach={() => setOpen((previous) => !previous)}
      onSubmit={sending.send}
      sending={sending.waiting}
      signUpHref={routes.signUp}
    />
  );
}

/** A learner who can't start another goal now sees only that: no box to type in, no examples. */
export function GoalStartEntry({
  atGoalLimit,
  ...entry
}: React.ComponentProps<typeof AttachableGoalEntry> & { atGoalLimit: boolean }) {
  return atGoalLimit ? <GoalLimitScreen /> : <AttachableGoalEntry {...entry} />;
}

const AT_ACTIVE_GOALS = { reason: "activeGoals" } as const;

function GoalLimitScreen() {
  const words = useGoalLimitWords()(AT_ACTIVE_GOALS);

  return (
    <OnboardingColumn bar={<GoalLimitBar limit={AT_ACTIVE_GOALS} />}>
      <OnboardingHeading>
        <OnboardingTitle>{words.title}</OnboardingTitle>
        {words.line && <OnboardingDescription>{words.line}</OnboardingDescription>}
      </OnboardingHeading>
    </OnboardingColumn>
  );
}
