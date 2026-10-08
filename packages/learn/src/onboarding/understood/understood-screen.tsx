"use client";

import {
  type OnboardingDraftEdit,
  type UnderstoodGoalView,
} from "@zoonk/core/view-models/onboarding/contract";
import { RotateCcwIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useRef, useState } from "react";
import { GoalFooter } from "../entry/goal-outcomes";
import { type GoalError } from "../goal-errors";
import {
  OnboardingColumn,
  OnboardingDescription,
  OnboardingHeading,
  OnboardingPrimaryButton,
  OnboardingSecondaryButton,
  OnboardingTitle,
} from "../onboarding-frame";
import { type UnderstandingDraft } from "./understanding-draft";
import { UnderstoodRowItem } from "./understood-row";
import { UnderstoodWords } from "./understood-words";
import {
  type EditableField,
  type UnderstoodRow,
  useMaterialRow,
  useScheduleRow,
  useUnderstoodRows,
} from "./use-understood-rows";

const CARD_CLASS = "bg-card ring-foreground/10 rounded-3xl p-4 ring-1 sm:p-5";

type GoalDraft = UnderstoodGoalView["draft"];

function readEditValue({ draft, row }: { draft: GoalDraft; row: UnderstoodRow }): string {
  const field = row.editable;

  if (!field || field.key === "studyTime" || field.key === "examYear") {
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

/** One fix on the card, as the draft takes it; the server recomputes what depends on it. */
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

  if (field.key === "examYear") {
    return { field: "examYear", goal, value: Number(value) };
  }

  return { field: field.key, goal, value };
}

type Field = EditableField["key"];

/**
 * A fact being fixed on one goal's card: the goal's position on the screen and the field. The
 * field, not the row, since the official dates' row turns into a deadline row once it's saved.
 */
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
}: {
  /** The field whose editor just closed; its pencil takes focus back. */
  edited: Field | null;
  editing: Field | null;
  extraRows: UnderstoodRow[];
  goal: UnderstoodGoalView;
  onEdit: (field: Field | null) => void;
  onSave: (input: { field: EditableField; value: string }) => Promise<boolean>;
}) {
  const rowsFor = useUnderstoodRows();

  const rows = [
    ...rowsFor({ cutoff: goal.cutoff, draft: goal.draft, examDates: goal.examDates }),
    ...extraRows,
  ];

  return (
    <ul className={`${CARD_CLASS} divide-border flex flex-col divide-y`}>
      {rows.map((row) => (
        <UnderstoodRowItem
          editValue={readEditValue({ draft: goal.draft, row })}
          editing={isField(row, editing)}
          focusEdit={isField(row, edited)}
          key={row.id}
          onEdit={(isEditing) => onEdit(isEditing ? (row.editable?.key ?? null) : null)}
          onSave={async (value) => (row.editable ? onSave({ field: row.editable, value }) : false)}
          row={row}
        />
      ))}
    </ul>
  );
}

/**
 * "Here's what I understood": every fact the typed goal already gave, one row each, with its
 * source when it's official. Confirming is one tap. One wrong fact is fixed in place, and the facts
 * that depend on it follow (another exam year reads that year's dates); "Fix something" changes the
 * words themselves, which are read again from scratch.
 */
export function UnderstoodScreen({
  draft,
  error,
  goal,
  isCreating,
  material,
  onConfirm,
  onRevise,
  onRewrite,
  signUpHref,
}: {
  draft: UnderstandingDraft;
  /** Why the goals couldn't be created, such as a goal limit. */
  error: GoalError | null;
  /** What the learner typed, shown as they typed it. */
  goal: string;
  isCreating: boolean;
  /** What the learner attached with the paperclip; the first goal is built from it. */
  material: readonly { title: string }[];
  onConfirm: () => void;
  /** Saves one fix; false when it couldn't be saved. */
  onRevise: (edit: OnboardingDraftEdit) => Promise<boolean>;
  /** Reads new words from scratch. */
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
        <OnboardingTitle>{t("Here's what I understood:")}</OnboardingTitle>
        {/* What they wrote sits right above, so only a note that adds something stays. */}
        {draft.goals.length > 1 && (
          <OnboardingDescription>{t("These goals share your daily time.")}</OnboardingDescription>
        )}
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
        />
      ))}

      <p className="text-muted-foreground flex items-start justify-center gap-2 text-sm">
        <span className="flex h-lh items-center">
          <RotateCcwIcon aria-hidden="true" className="size-4" />
        </span>
        {t("You can change all of this later.")}
      </p>

      <GoalFooter error={error} signUpHref={signUpHref}>
        <OnboardingPrimaryButton disabled={isCreating || rewriting} onClick={onConfirm}>
          {isCreating ? t("Saving your goal…") : t("Looks right")}
        </OnboardingPrimaryButton>
        <OnboardingSecondaryButton
          disabled={isCreating || rewriting}
          onClick={() => setRewriting(true)}
          ref={fixButtonRef}
        >
          {t("Fix something")}
        </OnboardingSecondaryButton>
      </GoalFooter>
    </OnboardingColumn>
  );
}
