import { getExtracted } from "next-intl/server";
import { LearnForm } from "./learn-form";
import { LEARN_TITLE_ID } from "./learn-title";

/**
 * Renders the open-ended subject entry after learners choose the "learn
 * something" path from the start goal picker.
 */
export async function LearnContent() {
  "use cache";

  const t = await getExtracted();

  const suggestions = [
    t("Computer Science"),
    t("Psychology"),
    t("Economics"),
    t("Photography"),
    t("Creative Writing"),
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

      <LearnForm placeholders={placeholderOptions} suggestions={suggestions} />
    </main>
  );
}
