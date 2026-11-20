import { Flag, isFlagCode } from "@zoonk/ui/components/language-flag";
import { getVarietyName } from "@zoonk/utils/language-regions";
import { PlusIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useAppLocale } from "../_utils/locale";

type GoalMarkGoal = { displayName: string; languageFlag: string | null };

function getFirstLetter(title: string): string {
  const [first] = new Intl.Segmenter().segment(title.trim());
  return first?.segment ?? "";
}

/**
 * Neutral, not a color per goal: every hue already means something. Server components draw it too.
 */
const GOAL_TILE_CLASS =
  "bg-muted text-foreground ring-input text-2xs grid size-4 shrink-0 place-items-center rounded-sm leading-none font-semibold uppercase ring-1 ring-inset";

export function GoalMark({ goal }: { goal: GoalMarkGoal }) {
  if (isFlagCode(goal.languageFlag)) {
    return <Flag className="w-4 shrink-0" code={goal.languageFlag} />;
  }

  return (
    <span aria-hidden="true" className={GOAL_TILE_CLASS}>
      {getFirstLetter(goal.displayName)}
    </span>
  );
}

/** Holds a goal's place before there is one, so the bar starts on the same edge either way. */
export function NoGoalMark() {
  return (
    <span aria-hidden="true" className={GOAL_TILE_CLASS}>
      <PlusIcon className="size-3" />
    </span>
  );
}

/**
 * Says the country a goal's flag shows, for screen readers. It goes after the goal's name, so a
 * control's name still starts with the words on screen.
 */
export function GoalCountryName({
  goal,
}: {
  goal: { targetLanguage: string | null; targetRegion: string | null };
}) {
  const t = useExtracted("goalSwitcher");
  const locale = useAppLocale();

  if (!goal.targetLanguage || !goal.targetRegion) {
    return null;
  }

  return (
    <span className="sr-only">
      {t({
        description:
          "Read by screen readers right after a goal's name. {variety} is the language and country the learner chose, such as “Spanish (Argentina)”.",
        message: ", {variety}",
        values: {
          variety: getVarietyName({
            language: goal.targetLanguage,
            region: goal.targetRegion,
            userLanguage: locale,
          }),
        },
      })}
    </span>
  );
}
