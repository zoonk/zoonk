import { LanguageFlag, hasLanguageFlag } from "@zoonk/ui/components/language-flag";

type GoalMarkGoal = { kind: string; targetLanguage: string | null; title: string };

function getFirstLetter(title: string): string {
  const [first] = new Intl.Segmenter().segment(title.trim());
  return first?.segment ?? "";
}

/** Neutral, not a color per goal: every hue already means something. Server components draw it too. */
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
