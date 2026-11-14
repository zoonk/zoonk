"use client";

import { type UnderstoodGoalView } from "@zoonk/core/view-models/onboarding/contract";
import { type OnboardingDraftEdit } from "@zoonk/core/view-models/onboarding/draft-edit-contract";
import { useExtracted } from "next-intl";
import { useRef, useState } from "react";
import { CreateAccountLink } from "../../_components/create-account-link";
import { GateWords, SubscribeGate } from "../../_components/subscribe-gate";
import { GoalLimitBar } from "../entry/goal-limit-notice";
import { GoalActions, GoalErrorMessage } from "../entry/goal-outcomes";
import { type GoalError } from "../goal-errors";
import { type GoalLimitReason } from "../onboarding-actions";
import {
  OnboardingColumn,
  OnboardingDescription,
  OnboardingHeading,
  OnboardingPrimaryButton,
  OnboardingSecondaryButton,
  OnboardingTitle,
} from "../onboarding-frame";
import { type UnderstandingDraft } from "./understanding-draft";
import { readEditValue, toDraftEdit } from "./understood-edits";
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
  const rowsFor = useUnderstoodRows(timeZone);
  // oxlint-disable-next-line react/hook-use-state -- What the card opened with never changes, so there is no setter.
  const [countryAsked] = useState(Boolean(goal.draft.targetRegion));

  const rows = [
    ...rowsFor({
      contentCountry: goal.contentCountry,
      countryAsked,
      cutoff: goal.cutoff,
      draft: goal.draft,
      examDates: goal.examDates,
      languageAim: goal.languageAim,
      regionChoices: goal.regionChoices,
      suggested: goal.suggested,
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

function LockedGoalCard({ goal, timeZone }: { goal: UnderstoodGoalView; timeZone: string }) {
  const rowsFor = useUnderstoodRows(timeZone);

  const rows = rowsFor({
    contentCountry: goal.contentCountry,
    cutoff: goal.cutoff,
    draft: goal.draft,
    examDates: goal.examDates,
    languageAim: goal.languageAim,
    regionChoices: goal.regionChoices,
    suggested: goal.suggested,
  });

  return (
    <ul className="flex flex-col [&>li+li]:border-t">
      {rows.map((row) => (
        <UnderstoodFactItem key={row.id} row={row} />
      ))}
    </ul>
  );
}

/** A guest's next step is a free account, which studies more goals at once; an account's is subscribing. */
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
    const title = t("More goals at once need a subscription");

    const line = t(
      "{count, plural, one {Pause another goal to start this one.} other {Pause another goal to start these.}}",
      { count },
    );

    return offersRemedy ? (
      <SubscribeGate title={title}>{line}</SubscribeGate>
    ) : (
      <GateWords line={line} title={title} />
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <GateWords title={t("More goals at once come with a free account")} />
      {offersRemedy && <CreateAccountLink />}
    </div>
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
    <OnboardingColumn
      bar={
        plusLimit ? (
          <GoalLimitBar reason={plusLimit} words />
        ) : (
          <GoalActions error={cardError} signUpHref={signUpHref}>
            <OnboardingSecondaryButton
              disabled={isCreating || rewriting}
              onClick={() => setRewriting(true)}
              ref={fixButtonRef}
            >
              {t("Fix something")}
            </OnboardingSecondaryButton>
            <form action={() => onConfirm()} className="contents">
              <OnboardingPrimaryButton busy={isCreating} disabled={rewriting} type="submit">
                {t("Looks right")}
              </OnboardingPrimaryButton>
            </form>
          </GoalActions>
        )
      }
    >
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
            <LockedGoalCard goal={understood} key={index} timeZone={draft.timeZone} />
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

      {!plusLimit && <GoalErrorMessage error={cardError} />}
    </OnboardingColumn>
  );
}
