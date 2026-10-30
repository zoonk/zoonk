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

const BASE_CHOICES = ["deep", "essential", "quick", "skip"] as const satisfies BaseChoice[];

const MIXED = "mixed";

function useChoiceName() {
  const t = useExtracted();

  const names: Record<BaseChoice, string> = {
    deep: t({
      description: "Choice to study a prerequisite with all its lessons, in depth.",
      message: "In depth",
    }),
    essential: t("Essentials"),
    quick: t("Quick lesson"),
    skip: t("Skip"),
  };

  return (choice: BaseChoice) => names[choice];
}

function minutesFor(item: PlanBaseView, choice: BaseChoice): number {
  if (item.studied) {
    return choice === "deep" ? Math.max(0, item.minutes.deep - item.minutes.essential) : 0;
  }

  return choice === "skip" ? 0 : item.minutes[choice];
}

function minutesOf(items: readonly PlanBaseView[], choiceOf: (base: PlanBaseView) => BaseChoice) {
  return items.reduce((sum, item) => sum + minutesFor(item, choiceOf(item)), 0);
}

export function chooseFor(item: PlanBaseView, choice: BaseChoice, current: BaseChoice): BaseChoice {
  return item.choices.includes(choice) ? choice : current;
}

function listOpenChoices(items: readonly PlanBaseView[]): BaseChoice[] {
  return BASE_CHOICES.filter((choice) => items.some((item) => item.choices.includes(choice)));
}

export function listOpen(items: readonly PlanBaseView[]): readonly PlanBaseView[] {
  const open = items.filter((item) => !item.studied);
  return open.length > 0 ? open : items;
}

export function getSharedChoice(
  items: readonly PlanBaseView[],
  choiceOf: (base: PlanBaseView) => BaseChoice,
): BaseChoice | null {
  const choices = new Set(items.map((item) => choiceOf(item)));
  const [only] = choices;
  return choices.size === 1 && only ? only : null;
}

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

  const choices = listOpenChoices(items).map((choice) => ({
    description: descriptions[choice],
    label: choiceName(choice),
    mark: choice === recommended ? t("Recommended") : undefined,
    trailing:
      choice === "skip"
        ? undefined
        : formatDuration(minutesOf(items, (item) => chooseFor(item, choice, item.choice))),
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
  const value = getSharedChoice(listOpen(items), choiceOf);
  const minutes = minutesOf(items, choiceOf);
  const studied = items.every((item) => item.studied);

  const names = format.list(
    items.map((item) => (item.studied ? t("{name} (studied)", { name: item.name }) : item.name)),
    { type: "conjunction" },
  );

  const options = listOpenChoices(items);
  const shown = value && !options.includes(value) ? [value, ...options] : options;

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

        {shown.map((choice) => (
          <NativeSelectOption key={choice} value={choice}>
            {studied && choice === "essential" ? t("Studied") : choiceName(choice)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </SettingRow>
  );
}

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
