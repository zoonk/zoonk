"use client";

import { type PlanBaseView } from "@zoonk/core/plans/view-contract";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@zoonk/ui/components/collapsible";
import { Toggle } from "@zoonk/ui/components/toggle";
import { ChevronDownIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { SectionLabel } from "../_components/section-label";
import { useFormatDuration } from "../_utils/time-format";

export type BaseChoice = PlanBaseView["choice"];

/** At most this many topics name what prerequisites are for; the rest are counted. */
const SHOWN_TOPICS = 2;

/** "For Ecology and Water", or "For Ecology, Water and 2 more". */
function useNeededForText() {
  const t = useExtracted();
  const format = useFormatter();

  return (topics: readonly string[]): string => {
    const shown = topics.slice(0, SHOWN_TOPICS);
    const more = topics.length - shown.length;

    return more > 0
      ? t("For {topics} and {count, plural, one {# more} other {# more}}", {
          count: more,
          topics: shown.join(", "),
        })
      : t("For {topics}", { topics: format.list(shown, { type: "conjunction" }) });
  };
}

/**
 * The four ways to study prerequisites, each with the time it takes: in depth (every lesson),
 * their essentials (the first third of their lessons), a quick lesson each, or skipping them. Two
 * by two on a phone. None pressed while the prerequisites it stands for are studied in different
 * ways.
 */
function ChoiceToggles({
  disabled,
  label,
  minutes,
  onChoose,
  value,
}: {
  disabled: boolean;
  label: string;
  minutes: PlanBaseView["minutes"];
  onChoose: (choice: BaseChoice) => void;
  value: BaseChoice | null;
}) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();

  const options: { label: string; minutes: number | null; value: BaseChoice }[] = [
    { label: t("In depth"), minutes: minutes.deep, value: "deep" },
    { label: t("Essential"), minutes: minutes.essential, value: "essential" },
    { label: t("Quick lesson"), minutes: minutes.quick, value: "quick" },
    { label: t("Skip"), minutes: null, value: "skip" },
  ];

  return (
    <div aria-label={label} className="grid grid-cols-2 gap-1 sm:grid-cols-4" role="group">
      {options.map((option) => (
        <Toggle
          className="aria-pressed:bg-foreground aria-pressed:text-background flex h-auto min-h-11 min-w-0 flex-col gap-0 px-1 py-1.5 text-center whitespace-normal"
          disabled={disabled}
          focusableWhenDisabled
          key={option.value}
          onPressedChange={() => onChoose(option.value)}
          pressed={value === option.value}
          variant="outline"
        >
          <span className="text-sm leading-tight">{option.label}</span>
          {option.minutes !== null && (
            <span className="text-xs leading-tight tabular-nums opacity-80">
              {formatDuration(option.minutes)}
            </span>
          )}
        </Toggle>
      ))}
    </div>
  );
}

/** One prerequisite: its name, what it's for and its three choices. */
function BaseRow({
  base,
  choice,
  disabled,
  onChoose,
}: {
  base: PlanBaseView;
  choice: BaseChoice;
  disabled: boolean;
  onChoose: (skillIds: string[], choice: BaseChoice) => void;
}) {
  const neededForText = useNeededForText();

  return (
    <li className="flex flex-col gap-2">
      <div className="flex flex-col">
        <span className="font-medium text-pretty">{base.name}</span>
        <span className="text-muted-foreground text-sm">{neededForText(base.neededFor)}</span>
      </div>

      <ChoiceToggles
        disabled={disabled}
        label={base.name}
        minutes={base.minutes}
        onChoose={(next) => onChoose([base.skillId], next)}
        value={choice}
      />
    </li>
  );
}

function sumMinutes(items: readonly PlanBaseView[]): PlanBaseView["minutes"] {
  return {
    deep: items.reduce((sum, item) => sum + item.minutes.deep, 0),
    essential: items.reduce((sum, item) => sum + item.minutes.essential, 0),
    quick: items.reduce((sum, item) => sum + item.minutes.quick, 0),
  };
}

/**
 * A subject's prerequisites as one choice, with the time each choice takes for all of them and
 * the topics they're for: most learners decide a subject at once. It opens to choose each one;
 * while they differ, no choice is pressed and it says so. A subject with one prerequisite shows
 * that prerequisite's row.
 */
export function BaseGroup({
  area,
  choiceOf,
  disabled,
  items,
  onChoose,
}: {
  area: string;
  choiceOf: (base: PlanBaseView) => BaseChoice;
  disabled: boolean;
  items: readonly PlanBaseView[];
  onChoose: (skillIds: string[], choice: BaseChoice) => void;
}) {
  const t = useExtracted();
  const neededForText = useNeededForText();
  const [first] = items;

  if (!first) {
    return null;
  }

  const shared = items.every((item) => choiceOf(item) === choiceOf(first)) ? choiceOf(first) : null;
  const topics = [...new Set(items.flatMap((item) => item.neededFor))];

  return (
    <section className="flex flex-col gap-3">
      <SectionLabel>{area}</SectionLabel>

      {items.length === 1 ? (
        <ul>
          <BaseRow base={first} choice={choiceOf(first)} disabled={disabled} onChoose={onChoose} />
        </ul>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col">
            <span className="font-medium">
              {t("{count, plural, one {# prerequisite} other {# prerequisites}}", {
                count: items.length,
              })}
            </span>
            <span className="text-muted-foreground text-sm">{neededForText(topics)}</span>
          </div>

          <ChoiceToggles
            disabled={disabled}
            label={area}
            minutes={sumMinutes(items)}
            onChoose={(next) =>
              onChoose(
                items.map((item) => item.skillId),
                next,
              )
            }
            value={shared}
          />

          {shared === null && (
            <p className="text-muted-foreground text-sm">{t("Different choices for each one.")}</p>
          )}

          <Collapsible>
            <CollapsibleTrigger className="group/each text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex min-h-11 items-center gap-1 rounded-md text-sm outline-none focus-visible:ring-[3px]">
              {t("Choose each one")}
              <ChevronDownIcon
                aria-hidden="true"
                className="size-4 transition-transform group-data-panel-open/each:rotate-180 motion-reduce:transition-none"
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="flex flex-col gap-5 border-l pt-2 pl-3">
                {items.map((item) => (
                  <BaseRow
                    base={item}
                    choice={choiceOf(item)}
                    disabled={disabled}
                    key={item.skillId}
                    onChoose={onChoose}
                  />
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}
    </section>
  );
}
