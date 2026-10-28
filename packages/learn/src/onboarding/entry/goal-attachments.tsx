"use client";

import { Button } from "@zoonk/ui/components/button";
import { FileTextIcon, XIcon } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { useState } from "react";
import { type GoalError } from "../goal-errors";
import {
  type AttachedSource,
  type GoalAttachActions,
  type OnboardingRoutes,
} from "../onboarding-actions";
import { AttachPanel, SignUpPrompt } from "./attach-panel";
import { GoalEntry } from "./goal-entry";
import { type MaterialIntent, MaterialIntentChoice } from "./material-intent";

function AttachedChips({
  items,
  onRemove,
}: {
  items: AttachedSource[];
  onRemove: (id: string) => void;
}) {
  const t = useExtracted();

  return (
    <ul aria-label={t("Your material")} className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li
          className="bg-muted flex max-w-full items-center gap-1.5 rounded-full py-1 pr-1 pl-3 text-sm"
          key={item.id}
        >
          <FileTextIcon aria-hidden="true" className="size-4 shrink-0" />
          <span className="truncate">{item.title || t("Your text")}</span>
          <Button
            aria-label={t("Remove {title}", { title: item.title || t("Your text") })}
            className="size-7 rounded-full"
            onClick={() => onRemove(item.id)}
            size="icon"
            variant="ghost"
          >
            <XIcon aria-hidden="true" />
          </Button>
        </li>
      ))}
    </ul>
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
  signUpHref,
}: {
  attach: GoalAttachActions;
  canAttach: boolean;
  intent: MaterialIntent | null;
  items: AttachedSource[];
  language: string;
  onChange: (items: AttachedSource[]) => void;
  onIntentChange: (intent: MaterialIntent) => void;
  open: boolean;
  signUpHref: string;
}) {
  return (
    <div className="flex flex-col gap-3">
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
          onAttached={(source) =>
            onChange([...items.filter((item) => item.id !== source.id), source])
          }
        />
      )}
    </div>
  );
}

export function AttachableGoalEntry({
  attach,
  attached,
  canAttach,
  defaultGoal,
  error,
  fromSharedPlan,
  intent,
  notice,
  onAttachedChange,
  onIntentChange,
  onSubmit,
  routes,
}: {
  attach: GoalAttachActions;
  attached: AttachedSource[];
  canAttach: boolean;
  defaultGoal: string;
  error: GoalError | null;
  fromSharedPlan: boolean;
  intent: MaterialIntent | null;
  notice?: React.ReactNode;
  onAttachedChange: (items: AttachedSource[]) => void;
  onIntentChange: (intent: MaterialIntent) => void;
  onSubmit: (goal: string) => void;
  routes: OnboardingRoutes;
}) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  return (
    <GoalEntry
      attachment={
        <GoalAttachments
          attach={attach}
          canAttach={canAttach}
          intent={intent}
          items={attached}
          language={locale}
          onChange={(items) => {
            onAttachedChange(items);
            setOpen(false);
          }}
          onIntentChange={onIntentChange}
          open={open}
          signUpHref={routes.signUp}
        />
      }
      canSubmitEmpty={attached.length > 0 && intent !== null}
      defaultGoal={defaultGoal}
      error={error}
      fromSharedPlan={fromSharedPlan}
      notice={notice}
      onAttach={() => setOpen((previous) => !previous)}
      onSubmit={onSubmit}
      signUpHref={routes.signUp}
    />
  );
}
