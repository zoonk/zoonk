"use client";

import { type PlanBaseView } from "@zoonk/core/plans/view-contract";
import { NativeSelect, NativeSelectOption } from "@zoonk/ui/components/native-select";
import { SlidersHorizontalIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { useId } from "react";
import { ChoiceRows } from "../_components/choice-rows";
import { Disclosure } from "../_components/disclosure";
import { ListGroup, ListRowIcon } from "../_components/list-group";
import { SettingRow } from "../_components/setting-rows";
import { useFormatDuration } from "../_utils/time-format";

export type BaseChoice = PlanBaseView["choice"];

/** Every way to study prerequisites, from the most time to none. */
const BASE_CHOICES = ["deep", "essential", "quick", "skip"] as const satisfies BaseChoice[];

/** A subject's select while its prerequisites are studied in different ways. */
const MIXED = "mixed";

/** The names learners know each way to study prerequisites by. */
function useChoiceName() {
  const t = useExtracted();

  const names: Record<BaseChoice, string> = {
    deep: t("In depth"),
    essential: t("Essentials"),
    quick: t("Quick lesson"),
    skip: t("Skip"),
  };

  return (choice: BaseChoice) => names[choice];
}

/** The minutes prerequisites take each as the learner chose; none for the ones skipped. */
function minutesOf(items: readonly PlanBaseView[], choiceOf: (base: PlanBaseView) => BaseChoice) {
  return items.reduce((sum, item) => {
    const choice = choiceOf(item);
    return choice === "skip" ? sum : sum + item.minutes[choice];
  }, 0);
}

/** The one way the prerequisites are all studied; null while they're studied in different ways. */
export function getSharedChoice(
  items: readonly PlanBaseView[],
  choiceOf: (base: PlanBaseView) => BaseChoice,
): BaseChoice | null {
  const choices = new Set(items.map((item) => choiceOf(item)));
  const [only] = choices;
  return choices.size === 1 && only ? only : null;
}

/**
 * How to study every prerequisite, one choice for all of them, each way with the time it takes
 * them all: every lesson, their essentials (the first third of their lessons), a quick lesson each,
 * or leaving them out. The way the app recommends is marked once the learner asked for it. None is
 * picked while they're studied in different ways.
 */
export function AllBasesChoice({
  items,
  onChoose,
  readOnly,
  recommended,
  value,
}: {
  items: readonly PlanBaseView[];
  onChoose: (choice: BaseChoice) => void;
  readOnly: boolean;
  recommended: BaseChoice | null;
  value: BaseChoice | null;
}) {
  const t = useExtracted();
  const choiceName = useChoiceName();
  const formatDuration = useFormatDuration();

  const descriptions: Record<BaseChoice, string> = {
    deep: t("Every lesson"),
    essential: t("The first third of the lessons"),
    quick: t("One short lesson each"),
    skip: t("Leave them out of your plan"),
  };

  const choices = BASE_CHOICES.map((choice) => ({
    description: descriptions[choice],
    label: choiceName(choice),
    mark: choice === recommended ? t("Recommended") : undefined,
    trailing: choice === "skip" ? undefined : formatDuration(minutesOf(items, () => choice)),
    value: choice,
  }));

  return (
    <ChoiceRows
      choices={choices}
      label={t("All prerequisites")}
      numberKeys={false}
      onChange={onChoose}
      readOnly={readOnly}
      stackOnPhone={false}
      value={value}
    />
  );
}

/**
 * A subject's prerequisites as one choice: the subject, its prerequisites by name with the time
 * they take as chosen, so the learner knows what they'd skip, and a select with the four ways,
 * under the names on a phone, where an exam's subjects can take several lines ("Noções de Direito
 * Constitucional e de Regimento Interno…"). While they're studied in different ways, it says so
 * until the learner picks one way for them all.
 */
function SubjectChoice({
  area,
  choiceOf,
  items,
  onChoose,
  readOnly,
}: {
  area: string;
  choiceOf: (base: PlanBaseView) => BaseChoice;
  items: readonly PlanBaseView[];
  onChoose: (skillIds: string[], choice: BaseChoice) => void;
  readOnly: boolean;
}) {
  const t = useExtracted();
  const format = useFormatter();
  const choiceName = useChoiceName();
  const formatDuration = useFormatDuration();
  const selectId = useId();
  const descriptionId = useId();
  const value = getSharedChoice(items, choiceOf);
  const minutes = minutesOf(items, choiceOf);

  const names = format.list(
    items.map((item) => item.name),
    { type: "conjunction" },
  );

  return (
    <SettingRow
      className="max-sm:flex-col max-sm:items-stretch max-sm:gap-y-0 max-sm:pb-3"
      description={
        minutes > 0 ? t("{names} · {time}", { names, time: formatDuration(minutes) }) : names
      }
      descriptionId={descriptionId}
      label={<label htmlFor={selectId}>{area}</label>}
    >
      <NativeSelect
        aria-describedby={descriptionId}
        disabled={readOnly}
        focusableWhenDisabled
        id={selectId}
        onChange={(event) => {
          const choice = BASE_CHOICES.find((option) => option === event.target.value);

          if (choice) {
            onChoose(
              items.map((item) => item.skillId),
              choice,
            );
          }
        }}
        size="sm"
        value={value ?? MIXED}
      >
        {value === null && (
          <NativeSelectOption disabled value={MIXED}>
            {t("Different choices")}
          </NativeSelectOption>
        )}

        {BASE_CHOICES.map((choice) => (
          <NativeSelectOption key={choice} value={choice}>
            {choiceName(choice)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </SettingRow>
  );
}

/**
 * The prerequisites by subject, folded until the learner asks, since most choose for all of them
 * at once: each subject one row with its own choice. Open on arrival when the subjects are already
 * studied in different ways (`defaultOpen`), so the learner sees how.
 */
export function BasesBySubject({
  areas,
  choiceOf,
  defaultOpen,
  onChoose,
  readOnly,
}: {
  areas: readonly (readonly [string, readonly PlanBaseView[]])[];
  choiceOf: (base: PlanBaseView) => BaseChoice;
  defaultOpen: boolean;
  onChoose: (skillIds: string[], choice: BaseChoice) => void;
  readOnly: boolean;
}) {
  const t = useExtracted();

  return (
    <ListGroup>
      <Disclosure
        defaultOpen={defaultOpen}
        icon={
          <ListRowIcon>
            <SlidersHorizontalIcon />
          </ListRowIcon>
        }
        title={t("Choose by subject")}
      >
        <ListGroup>
          {areas.map(([area, items]) => (
            <SubjectChoice
              area={area}
              choiceOf={choiceOf}
              items={items}
              key={area}
              onChoose={onChoose}
              readOnly={readOnly}
            />
          ))}
        </ListGroup>
      </Disclosure>
    </ListGroup>
  );
}
