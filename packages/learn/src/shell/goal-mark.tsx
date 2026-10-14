import { LanguageFlag, hasLanguageFlag } from "@zoonk/ui/components/language-flag";

/** What a goal's mark is drawn from. */
type GoalMarkGoal = { kind: string; targetLanguage: string | null; title: string };

/** The title's first letter as a reader sees it: an accented letter or an emoji whole. */
function getFirstLetter(title: string): string {
  const [first] = new Intl.Segmenter().segment(title.trim());
  return first?.segment ?? "";
}

/**
 * A goal's mark: the flag of the variety a language goal learns, otherwise its first letter on a
 * small neutral square. Neutral, not a color per goal: every hue already means something (a kind,
 * progress, Brain Power), and the goal's name beside it says which one it is. The goal switcher
 * draws it, and the public pages' example goals do too, so it's a module a server component can
 * render.
 */
export function GoalMark({ goal }: { goal: GoalMarkGoal }) {
  if (goal.kind === "language" && hasLanguageFlag(goal.targetLanguage)) {
    return <LanguageFlag className="w-4.5 shrink-0" language={goal.targetLanguage} />;
  }

  return (
    <span
      aria-hidden="true"
      className="bg-muted text-foreground ring-input grid size-4.5 shrink-0 place-items-center rounded-[0.3125rem] text-[0.625rem] leading-none font-bold uppercase ring-1 ring-inset"
    >
      {getFirstLetter(goal.title)}
    </span>
  );
}
