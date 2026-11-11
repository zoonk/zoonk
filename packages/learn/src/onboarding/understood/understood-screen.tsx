"use client";

import { type UnderstoodGoalView } from "@zoonk/core/view-models/onboarding/contract";
import { type OnboardingDraftEdit } from "@zoonk/core/view-models/onboarding/draft-edit-contract";
import { CheckIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useRef, useState } from "react";
import { CreateAccountLink } from "../../_components/create-account-link";
import { PlusNotice } from "../../_components/plus-lock";
import { GoalLimitWall } from "../entry/goal-limit-notice";
import { GoalFooter } from "../entry/goal-outcomes";
import { type GoalError } from "../goal-errors";
import { type GoalLimitReason } from "../onboarding-actions";
import {
  OnboardingColumn,
  OnboardingDescription,
  OnboardingFooter,
  OnboardingHeading,
  OnboardingPrimaryButton,
  OnboardingSecondaryButton,
  OnboardingTitle,
} from "../onboarding-frame";
import { type UnderstandingDraft } from "./understanding-draft";
import { useCardLimit } from "./understood-limit";
import { UnderstoodFactItem, UnderstoodRowItem } from "./understood-row";
import { UnderstoodWords } from "./understood-words";
import {
  type EditableField,
  type UnderstoodRow,
  useMaterialRow,
  useScheduleRow,
  useUnderstoodRows,
} from "./use-understood-rows";

type GoalDraft = UnderstoodGoalView["draft"];

function readEditValue({ draft, row }: { draft: GoalDraft; row: UnderstoodRow }): string {
  const field = row.editable;

  if (!field || field.key === "studyTime") {
    return row.editDefault ?? row.value;
  }

  if (field.key === "displayName") {
    return draft.displayName ?? "";
  }

  if (field.key === "targetDate") {
    return draft.targetDate ?? row.editDefault ?? "";
  }

  if (field.key === "targetRegion") {
    return draft.targetRegion ?? "";
  }

  const value = draft.details?.[field.key];
  return typeof value === "string" ? value : "";
}

function toDraftEdit({
  field,
  goal,
  value,
}: {
  field: EditableField;
  goal: number;
  value: string;
}): OnboardingDraftEdit {
  if (field.key === "studyTime") {
    return { field: "studyTime", value };
  }

  if (field.key === "targetRegion") {
    return { field: "targetRegion", goal, value: value || null };
  }

  return { field: field.key, goal, value };
}

type Field = EditableField["key"];

/** By field, not row: the official dates' row turns into a deadline row once it's saved. */
type FieldEdit = { field: Field; goal: number };

function isField(row: UnderstoodRow, field: Field | null): boolean {
  return field !== null && row.editable?.key === field;
}

function GoalCard({
  edited,
  editing,
  extraRows,
  goal,
  onEdit,
  onSave,
  timeZone,
}: {
  edited: Field | null;
  editing: Field | null;
  extraRows: UnderstoodRow[];
  goal: UnderstoodGoalView;
  onEdit: (field: Field | null) => void;
  onSave: (input: { field: EditableField; value: string }) => Promise<boolean>;
  timeZone: string;
}) {
  const rowsFor = useUnderstoodRows();
  // oxlint-disable-next-line react/hook-use-state -- What the card opened with never changes, so there is no setter.
  const [countryAsked] = useState(Boolean(goal.draft.targetRegion));

  const rows = [
    ...rowsFor({
      countryAsked,
      cutoff: goal.cutoff,
      draft: goal.draft,
      examDates: goal.examDates,
      languageAim: goal.languageAim,
      regionChoices: goal.regionChoices,
    }),
    ...extraRows,
  ];

  return (
    <ul className="flex flex-col [&>li+li]:border-t">
      {rows.map((row) => (
        <UnderstoodRowItem
          editValue={readEditValue({ draft: goal.draft, row })}
          editing={isField(row, editing)}
          focusEdit={isField(row, edited)}
          key={row.id}
          onEdit={(isEditing) => onEdit(isEditing ? (row.editable?.key ?? null) : null)}
          onSave={async (value) => (row.editable ? onSave({ field: row.editable, value }) : false)}
          row={row}
          timeZone={timeZone}
        />
      ))}
    </ul>
  );
}

function LockedGoalCard({ goal }: { goal: UnderstoodGoalView }) {
  const rowsFor = useUnderstoodRows();

  const rows = rowsFor({
    cutoff: goal.cutoff,
    draft: goal.draft,
    examDates: goal.examDates,
    languageAim: goal.languageAim,
    regionChoices: goal.regionChoices,
  });

  return (
    <ul className="flex flex-col [&>li+li]:border-t">
      {rows.map((row) => (
        <UnderstoodFactItem key={row.id} row={row} />
      ))}
    </ul>
  );
}

/** A guest's next step is a free account, which follows more goals at once; an account's is Plus. */
function LockedGoalsNote({
  count,
  hasAccount,
  offersRemedy,
}: {
  count: number;
  hasAccount: boolean;
  offersRemedy: boolean;
}) {
  const t = useExtracted();

  if (hasAccount) {
    return (
      <PlusNotice cta={offersRemedy}>
        {t({
          description:
            "Under the goals of a card that the free plan can't start now, below the ones it starts. “Following” a goal means it's active on the learner's plan: this counts goals followed at once, not new goals started per day or month. Pausing a goal keeps its progress, and a waiting goal can start once another is paused. “Plus” is the name of the paid plan, not the word “more”.",
          message:
            "{count, plural, one {Following more goals at once comes with Plus. Until then, this goal waits in your goals.} other {Following more goals at once comes with Plus. Until then, these goals wait in your goals.}}",
          values: { count },
        })}
      </PlusNotice>
    );
  }

  return (
    <PlusNotice
      action={offersRemedy && <CreateAccountLink />}
      cta={false}
      title={t({
        description:
          "Title of the note under the goals of a card a guest can't start yet, because without an account they follow one goal at a time. A “free account” is a signed-up account on the free plan, not the paid plan.",
        message: "Available with a free account",
      })}
    >
      {t({
        description:
          "Under the goals of a card a guest can't start yet, below the one they start. Without an account a learner follows one goal at a time; a free account (signed up, on the free plan, not the paid plan) follows more. “Following” a goal means it's active on the learner's plan: this counts goals followed at once, not new goals started per day or month. The waiting goals come with them when they create the account.",
        message:
          "{count, plural, one {Following more goals at once comes with a free account. Until then, this goal waits in your goals.} other {Following more goals at once comes with a free account. Until then, these goals wait in your goals.}}",
        values: { count },
      })}
    </PlusNotice>
  );
}

export function UnderstoodScreen({
  draft,
  error,
  goal,
  goalLimit = null,
  hasAccount,
  isCreating,
  material,
  onConfirm,
  onRevise,
  onRewrite,
  signUpHref,
}: {
  draft: UnderstandingDraft;
  error: GoalError | null;
  goal: string;
  goalLimit?: GoalLimitReason | null;
  hasAccount: boolean;
  isCreating: boolean;
  material: readonly { title: string }[];
  onConfirm: () => void;
  onRevise: (edit: OnboardingDraftEdit) => Promise<boolean>;
  onRewrite: (words: string) => void;
  signUpHref: string;
}) {
  const t = useExtracted();
  const scheduleRow = useScheduleRow();
  const materialRow = useMaterialRow();
  const [editing, setEditing] = useState<FieldEdit | null>(null);
  const [edited, setEdited] = useState<FieldEdit | null>(null);
  const [rewriting, setRewriting] = useState(false);
  const fixButtonRef = useRef<HTMLButtonElement>(null);
  const schedule = scheduleRow(draft.schedule, draft.minutesSaid);
  const firstGoalRows = [materialRow(material), schedule].filter((row) => row !== null);
  const { cardError, plusLimit } = useCardLimit({ draft, error, goalLimit, hasAccount });

  const edit = (next: FieldEdit | null) => {
    setEdited(next ? null : editing);
    setEditing(next);
  };

  return (
    <OnboardingColumn>
      <UnderstoodWords
        disabled={isCreating}
        onCancel={() => {
          setRewriting(false);
          // Back on "Fix something" once it's enabled again, so keyboard users keep their place.
          requestAnimationFrame(() => fixButtonRef.current?.focus());
        }}
        onRewrite={onRewrite}
        rewriting={rewriting}
        words={goal}
      />

      <OnboardingHeading>
        <OnboardingTitle>{t("Here's what I understood")}</OnboardingTitle>
        <OnboardingDescription>
          {draft.goals.length > 1
            ? t("These goals share your daily time. You can change all of this later.")
            : t("You can change all of this later.")}
        </OnboardingDescription>
      </OnboardingHeading>

      {draft.goals.map((understood, index) => (
        <GoalCard
          edited={edited?.goal === index ? edited.field : null}
          editing={editing?.goal === index ? editing.field : null}
          extraRows={index === 0 ? firstGoalRows : []}
          goal={understood}
          // oxlint-disable-next-line react/no-array-index-key -- A goal's place is its identity on the card; its title can change.
          key={index}
          onEdit={(field) => edit(field ? { field, goal: index } : null)}
          onSave={({ field, value }) => onRevise(toDraftEdit({ field, goal: index, value }))}
          timeZone={draft.timeZone}
        />
      ))}

      {draft.lockedGoals.length > 0 && (
        <div className="flex flex-col gap-3">
          {draft.lockedGoals.map((understood, index) => (
            // oxlint-disable-next-line react/no-array-index-key -- Locked goals can't be edited; their place is their identity.
            <LockedGoalCard goal={understood} key={index} />
          ))}

          {draft.goals.length > 0 && (
            <LockedGoalsNote
              count={draft.lockedGoals.length}
              hasAccount={hasAccount}
              offersRemedy={!plusLimit && !error?.needsAccount}
            />
          )}
        </div>
      )}

      {plusLimit ? (
        <OnboardingFooter className="gap-3">
          <GoalLimitWall reason={plusLimit} />
        </OnboardingFooter>
      ) : (
        <GoalFooter error={cardError} signUpHref={signUpHref}>
          <form action={() => onConfirm()} className="contents">
            <OnboardingPrimaryButton
              busy={isCreating}
              disabled={rewriting}
              icon={<CheckIcon aria-hidden="true" />}
              type="submit"
            >
              {t("Looks right")}
            </OnboardingPrimaryButton>
          </form>
          <OnboardingSecondaryButton
            disabled={isCreating || rewriting}
            onClick={() => setRewriting(true)}
            ref={fixButtonRef}
          >
            {t("Fix something")}
          </OnboardingSecondaryButton>
        </GoalFooter>
      )}
    </OnboardingColumn>
  );
}
