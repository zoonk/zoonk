import { getMenu } from "@/lib/menu";
import { type LucideIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { StartContentTracker } from "./_components/start-content-tracker";
import {
  StartGoalCard,
  StartGoalCardBadge,
  StartGoalCardContent,
  StartGoalCardDescription,
  StartGoalCardHeader,
  StartGoalCardIcon,
  StartGoalCardIndicator,
  StartGoalCardItem,
  StartGoalCardTitle,
  StartGoalGrid,
} from "./_components/start-goal-card";

const startExamMenu = getMenu("startExam");
const startLearnMenu = getMenu("startLearn");
const startSpeakMenu = getMenu("startSpeak");

type StartGoal = {
  badge?: string;
  description: string;
  href: typeof startExamMenu.url | typeof startLearnMenu.url | typeof startSpeakMenu.url;
  icon: LucideIcon;
  iconClassName: string;
  title: string;
};

/**
 * Renders one goal choice as a full-card link so the shared content component
 * can stay focused on the three onboarding options rather than card structure.
 */
function StartGoalOption({ goal }: { goal: StartGoal }) {
  return (
    <StartGoalCardItem>
      <StartGoalCard href={goal.href}>
        <StartGoalCardHeader>
          <StartGoalCardIcon className={goal.iconClassName}>
            <goal.icon aria-hidden="true" className="size-5" />
          </StartGoalCardIcon>

          {goal.badge && <StartGoalCardBadge>{goal.badge}</StartGoalCardBadge>}
        </StartGoalCardHeader>

        <StartGoalCardContent>
          <StartGoalCardTitle>{goal.title}</StartGoalCardTitle>
          <StartGoalCardDescription>{goal.description}</StartGoalCardDescription>
          <StartGoalCardIndicator />
        </StartGoalCardContent>
      </StartGoalCard>
    </StartGoalCardItem>
  );
}

/**
 * Renders the shared goal picker used by the standalone start page and the home
 * empty state so every first-learning entry point asks the same question.
 */
export async function StartContent() {
  const t = await getExtracted();

  const goals: StartGoal[] = [
    {
      description: t(
        "Learn a language with pronunciation tips, vocabulary, reading, and listening practice.",
      ),
      href: startSpeakMenu.url,
      icon: startSpeakMenu.icon,
      iconClassName:
        "bg-sky-500/10 text-sky-700 group-hover/start-goal-card:bg-sky-500/15 dark:text-sky-300",
      title: t("Speak a language"),
    },
    {
      description: t(
        "Turn any subject into a clear course you can follow step by step, with practical examples and no fluff.",
      ),
      href: startLearnMenu.url,
      icon: startLearnMenu.icon,
      iconClassName:
        "bg-emerald-500/10 text-emerald-700 group-hover/start-goal-card:bg-emerald-500/15 dark:text-emerald-300",
      title: t("Learn something"),
    },
    {
      badge: t("Coming soon"),
      description: t(
        "We'll prepare a study path to help you pass an entrance exam, certification, or school test.",
      ),
      href: startExamMenu.url,
      icon: startExamMenu.icon,
      iconClassName:
        "bg-amber-500/10 text-amber-700 group-hover/start-goal-card:bg-amber-500/15 dark:text-amber-300",
      title: t("Pass an exam"),
    },
  ];

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-8 p-4 pb-28 md:gap-10">
      <StartContentTracker />

      <h1 className="text-center text-4xl font-bold tracking-tight md:text-5xl">
        {t("What's your goal?")}
      </h1>

      <StartGoalGrid>
        {goals.map((goal) => (
          <StartGoalOption goal={goal} key={goal.href} />
        ))}
      </StartGoalGrid>
    </main>
  );
}
