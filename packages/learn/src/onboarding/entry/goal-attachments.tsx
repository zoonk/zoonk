"use client";

import { MAX_GOAL_SOURCES } from "@zoonk/core/goals/goal-input-limits";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { CircleAlertIcon, FileTextIcon, XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useRef, useState } from "react";
import { ChangeSaveError } from "../../_components/save-error";
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
import { GoalEntry } from "./goal-entry";
import { GoalLimitBar } from "./goal-limit-notice";
import { type StartAttachment, type StartMaterial } from "./material-goal";
import { type MaterialIntent, MaterialIntentChoice } from "./material-intent";

function AttachedChip({
  item,
  onRemove,
  unreadableNoteId,
}: {
  item: StartAttachment;
  onRemove: (id: string) => void;
  unreadableNoteId: string;
}) {
  const t = useExtracted();
  const title = item.title || t("Your text");
  const { unreadable } = item;
  const Icon = unreadable ? CircleAlertIcon : FileTextIcon;

  return (
    <li
      className={cn(
        "flex max-w-full items-center gap-1.5 rounded-full py-1 pr-1 pl-3 text-sm",
        unreadable ? "bg-destructive/10 text-destructive-text dark:bg-destructive/20" : "bg-muted",
      )}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span className="truncate">{title}</span>
      <Button
        aria-describedby={unreadable ? unreadableNoteId : undefined}
        aria-label={t("Remove {title}", { title })}
        className={cn(
          "size-7 rounded-full",
          unreadable && "hover:bg-destructive/20 hover:text-destructive-text",
        )}
        onClick={() => onRemove(item.id)}
        size="icon"
        variant="ghost"
      >
        <XIcon aria-hidden="true" />
      </Button>
    </li>
  );
}

function UnreadableNote({ id, items }: { id: string; items: StartAttachment[] }) {
  const t = useExtracted();
  const [only, ...others] = items;

  if (!only) {
    return null;
  }

  return (
    <ChangeSaveError id={id}>
      {others.length > 0
        ? t("We can't read some of your files anymore. Remove them and add them again.")
        : t({
            description:
              "Shown when the learner's material can't be read anymore. {title} is a file's name, a link or “Your text”.",
            message: "We can't read “{title}” anymore. Remove it and add it again.",
            values: { title: only.title || t("Your text") },
          })}
    </ChangeSaveError>
  );
}

function AttachedChips({
  items,
  onRemove,
}: {
  items: StartAttachment[];
  onRemove: (id: string) => void;
}) {
  const t = useExtracted();
  const noteId = useId();
  const unreadable = items.filter((item) => item.unreadable);

  return (
    <>
      <ul aria-label={t("Your material")} className="flex flex-wrap gap-2">
        {items.map((item) => (
          <AttachedChip item={item} key={item.id} onRemove={onRemove} unreadableNoteId={noteId} />
        ))}
      </ul>

      <UnreadableNote id={noteId} items={unreadable} />
    </>
  );
}

function GoalAttachments({
  attach,
  canAttach,
  intent,
  items,
  language,
  onChange,
  onIntentChange,
  open,
  ref,
  signUpHref,
}: {
  attach: GoalAttachActions;
  canAttach: boolean;
  intent: MaterialIntent | null;
  items: StartAttachment[];
  language: string;
  onChange: (items: StartAttachment[]) => void;
  onIntentChange: (intent: MaterialIntent) => void;
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

      {items.length > 0 && (
        <AttachedChips
          items={items}
          onRemove={(id) => onChange(items.filter((item) => item.id !== id))}
        />
      )}

      {items.length > 0 && !open && (
        <MaterialIntentChoice onChange={onIntentChange} value={intent} />
      )}

      {open && !canAttach && <SignUpPrompt signUpHref={signUpHref} />}

      {open && canAttach && (
        <AttachPanel
          attach={attach}
          language={language}
          onAttached={(source) => {
            setAdded(source);
            onChange([...items.filter((item) => item.id !== source.id), source]);
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
  material: { attached, intent, setAttached, setIntent },
  onSubmit,
  routes,
}: {
  attach: GoalAttachActions;
  canAttach: boolean;
  defaultGoal: string;
  error: GoalError | null;
  fromSharedPlan: boolean;
  material: Pick<StartMaterial, "attached" | "intent" | "setAttached" | "setIntent">;
  onSubmit: (goal: string) => void;
  routes: OnboardingRoutes;
}) {
  const locale = useAppLocale();
  const [open, setOpen] = useState(false);
  const material = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  // Not the new material's Remove: a learner still pressing Enter would remove what they added.
  useFocusOnRemovedControl(material, () => toggle.current);

  return (
    <GoalEntry
      attachDisabled={attached.length >= MAX_GOAL_SOURCES}
      attachOpen={open}
      attachRef={toggle}
      attachment={
        <GoalAttachments
          attach={attach}
          canAttach={canAttach}
          intent={intent}
          items={attached}
          language={locale}
          onChange={(items) => {
            setAttached(items);
            setOpen(false);
          }}
          onIntentChange={setIntent}
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
      onSubmit={onSubmit}
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
