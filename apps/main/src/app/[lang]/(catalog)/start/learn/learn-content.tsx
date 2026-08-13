import { Link } from "@/i18n/navigation";
import { shuffle } from "@zoonk/utils/shuffle";
import { getExtracted } from "next-intl/server";
import { io } from "next/cache";
import { Suspense } from "react";
import { LearnForm } from "./learn-form";
import { LEARN_TITLE_ID } from "./learn-title";

const VISIBLE_SUGGESTIONS = 5;

/**
 * Streams request-time suggestions without rendering a visible fallback set
 * that would reflow when the shuffled links replace it.
 */
async function RandomSuggestionLinks({ suggestions }: { suggestions: string[] }) {
  await io();

  return shuffle(suggestions)
    .slice(0, VISIBLE_SUGGESTIONS)
    .map((subject) => (
      <Link
        key={subject}
        className="text-muted-foreground/70 hover:text-foreground text-sm transition-colors"
        href={`/start/learn/${encodeURIComponent(subject)}`}
        prefetch={false}
      >
        {subject}
      </Link>
    ));
}

/**
 * Renders the open-ended subject entry after learners choose the "learn
 * something" path from the start goal picker.
 */
export async function LearnContent() {
  const t = await getExtracted();

  const allSuggestions = [
    t("Computer Science"),
    t("Psychology"),
    t("Economics"),
    t("Photography"),
    t("Philosophy"),
    t("Data Science"),
    t("Creative Writing"),
    t("Biology"),
    t("Graphic Design"),
    t("History"),
    t("Marketing"),
  ];

  const placeholderOptions = [
    t("Quantum physics"),
    t("Ancient philosophy"),
    t("Machine learning"),
    t("Creative writing"),
    t("Molecular biology"),
    t("Behavioral economics"),
    t("Organic chemistry"),
    t("UFOs"),
    t("Dinosaur extinction"),
    t("World history"),
    t("Cognitive psychology"),
    t("Linear algebra"),
    t("Black holes"),
    t("Roman Empire"),
    t("Deep sea creatures"),
    t("Solar system"),
    t("Artificial intelligence"),
    t("Harry Potter"),
  ];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-8 p-4 pb-28 md:gap-10">
      <h1 className="text-center text-4xl font-bold tracking-tight md:text-5xl" id={LEARN_TITLE_ID}>
        {t("What do you want to learn?")}
      </h1>

      <LearnForm placeholders={placeholderOptions} />

      <nav
        aria-label={t("Suggested subjects")}
        className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2"
      >
        <Suspense fallback={null}>
          <RandomSuggestionLinks suggestions={allSuggestions} />
        </Suspense>
      </nav>
    </main>
  );
}
