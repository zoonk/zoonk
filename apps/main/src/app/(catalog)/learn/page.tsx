import { shuffle } from "@zoonk/utils/shuffle";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import Link from "next/link";
import { LearnForm } from "./learn-form";

const VISIBLE_SUGGESTIONS = 5;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t("Tell us your goal and we'll create an AI course to help you reach it."),
    title: t("Start Learning with AI"),
  };
}

export default async function Learn() {
  const t = await getExtracted();

  const allSuggestions = [
    t("Learn computer science"),
    t("Speak Spanish"),
    t("Pass the SAT"),
    t("Understand how microwaves work"),
    t("Build an app without knowing how to code"),
    t("Learn mindfulness for autistic people"),
    t("Master photography"),
    t("Study the Cold War"),
    t("Learn Django"),
    t("Improve time management"),
    t("Understand black holes"),
  ];

  const suggestions = shuffle(allSuggestions).slice(0, VISIBLE_SUGGESTIONS);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-8 p-4 pb-28 md:gap-10">
      <h1 className="text-center text-4xl font-bold tracking-tight md:text-5xl" id="learn-title">
        {t("What's your goal?")}
      </h1>

      <LearnForm
        placeholders={shuffle([
          t("learn biology"),
          t("speak English"),
          t("prepare for the GRE"),
          t("understand how TV works"),
          t("create a website without coding"),
          t("understand quantum physics basics"),
          t("learn ancient philosophy"),
          t("improve creative writing"),
          t("learn molecular biology"),
          t("learn behavioral economics"),
          t("learn organic chemistry"),
          t("learn about UFOs"),
          t("learn about dinosaurs"),
          t("understand how volcanoes work"),
          t("learn world history"),
          t("learn cognitive psychology"),
          t("learn linear algebra"),
          t("understand how the internet works"),
          t("learn about the Roman Empire"),
          t("learn about Harry Potter"),
        ])}
      />

      <nav
        aria-label={t("Suggested goals")}
        className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2"
      >
        {suggestions.map((subject) => (
          <Link
            key={subject}
            className="text-muted-foreground/70 hover:text-foreground text-sm transition-colors"
            href={`/learn/${encodeURIComponent(subject)}`}
            prefetch={false}
          >
            {subject}
          </Link>
        ))}
      </nav>
    </main>
  );
}
