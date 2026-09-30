"use client";

import {
  AtomIcon,
  ChevronRightIcon,
  GraduationCapIcon,
  GuitarIcon,
  LightbulbIcon,
  MessagesSquareIcon,
} from "lucide-react";
import { useExtracted } from "next-intl";
import { SectionLabel } from "../../_components/section-label";
import { useLocalGoalExample } from "./use-local-goal-example";

type GoalExample = { icon: React.ReactNode; kind: string; label: string };

function useGoalExamples(): GoalExample[] {
  const t = useExtracted();
  const { exam, language } = useLocalGoalExample();

  return [
    {
      icon: <GraduationCapIcon className="text-sky-600 dark:text-sky-400" />,
      kind: t("Exam"),
      label: t(
        "{exam, select, abitur {Pass the Abitur} bac {Pass the bac} enem {Pass the ENEM} pau {Pass the PAU} other {Pass the SAT}}",
        { exam },
      ),
    },
    {
      icon: <MessagesSquareIcon className="text-violet-600 dark:text-violet-400" />,
      kind: t("Language"),
      label: t("Speak {language} for a job interview", { language }),
    },
    {
      icon: <AtomIcon className="text-fuchsia-600 dark:text-fuchsia-400" />,
      kind: t("Learn a topic"),
      label: t("Understand quantum physics"),
    },
    {
      icon: <GuitarIcon className="text-orange-600 dark:text-orange-400" />,
      kind: t("Instrument"),
      label: t("Play the guitar"),
    },
    {
      icon: <LightbulbIcon className="text-amber-600 dark:text-amber-400" />,
      kind: t("Quick explanation · 5 min"),
      label: t("How does inflation work?"),
    },
  ];
}

/** Examples in the interface language. Each one starts onboarding with its words. */
export function GoalExamples({ onPick }: { onPick: (goal: string) => void }) {
  const t = useExtracted();
  const examples = useGoalExamples();

  return (
    <section aria-labelledby="goal-examples-title" className="flex flex-col gap-2">
      <SectionLabel id="goal-examples-title">{t("Examples")}</SectionLabel>

      <ul className="flex flex-col">
        {examples.map((example) => (
          <li key={example.label}>
            <button
              className="hover:bg-muted/60 focus-visible:ring-ring/50 in-data-[mode=fun]:hover:bg-fun-soft -mx-2 flex min-h-14 w-[calc(100%+1rem)] items-center gap-3 rounded-2xl px-2 py-2 text-left outline-none focus-visible:ring-[3px]"
              onClick={() => onPick(example.label)}
              type="button"
            >
              <span
                aria-hidden="true"
                className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-xl [&_svg]:size-5"
              >
                {example.icon}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-base font-medium">{example.label}</span>
                <span className="text-muted-foreground text-sm">{example.kind}</span>
              </span>
              <ChevronRightIcon
                aria-hidden="true"
                className="text-muted-foreground size-4 shrink-0"
              />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
