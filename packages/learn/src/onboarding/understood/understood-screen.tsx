"use client";

import {
  type OnboardingDraftEdit,
  type UnderstoodGoalView,
} from "@zoonk/core/view-models/onboarding/contract";
import { CheckIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useRef, useState } from "react";
import { PlusNotice } from "../../_components/plus-lock";
import { GoalLimitWall, isPlusGoalLimit } from "../entry/goal-limit-notice";
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

  if (field.key === "title") {
    return draft.title;
  }

  if (field.key === "targetDate") {
    return draft.targetDate ?? row.editDefault ?? "";
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

  const rows = [
    ...rowsFor({
      cutoff: goal.cutoff,
      draft: goal.draft,
      examDates: goal.examDates,
      languageAim: goal.languageAim,
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
  });

  return (
    <ul className="flex flex-col [&>li+li]:border-t">
      {rows.map((row) => (
        <UnderstoodFactItem key={row.id} row={row} />
      ))}
    </ul>
  );
}

export function UnderstoodScreen({
  draft,
  error,
  goal,
  goalLimit = null,
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
  const plusLimit = [error?.limit, goalLimit].find((reason) => reason && isPlusGoalLimit(reason));

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

          <PlusNotice cta={!plusLimit}>
            {t(
              "{count, plural, one {Following more than one goal at a time comes with Plus. Until then, this goal waits in your goals.} other {Following more than one goal at a time comes with Plus. Until then, these goals wait in your goals.}}",
              { count: draft.lockedGoals.length },
            )}
          </PlusNotice>
        </div>
      )}

      {plusLimit ? (
        <OnboardingFooter className="gap-3">
          <GoalLimitWall reason={plusLimit} />
        </OnboardingFooter>
      ) : (
        <GoalFooter error={error} signUpHref={signUpHref}>
          <OnboardingPrimaryButton
            busy={isCreating}
            disabled={rewriting}
            icon={<CheckIcon aria-hidden="true" />}
            onClick={onConfirm}
          >
            {t("Looks right")}
          </OnboardingPrimaryButton>
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
