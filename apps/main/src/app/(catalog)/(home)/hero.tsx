import { buttonVariants } from "@zoonk/ui/components/button";
import { SparklesIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import Link from "next/link";
import { HeroTracker } from "./hero-tracker";

/**
 * Shows the zero-progress home state for people who need a concrete reason to
 * start learning before they understand how Zoonk creates personalized courses.
 */
export async function Hero() {
  const t = await getExtracted();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-8 px-4 py-16 md:py-24">
      <HeroTracker />

      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-foreground/90 text-3xl font-semibold tracking-tight text-balance md:text-5xl md:tracking-tighter">
          {t("Change your life")}
        </h1>

        <p className="text-muted-foreground text-lg text-balance md:text-xl">
          {t(
            "Pass your exams, learn a language, build skills, and land your dream job. Zoonk helps you change your life.",
          )}
        </p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <Link
          className={buttonVariants({ className: "gap-2", size: "lg", variant: "default" })}
          href="/learn"
          prefetch
        >
          <SparklesIcon aria-hidden="true" />
          {t("Start free")}
        </Link>

        <p className="text-muted-foreground flex flex-col items-center text-sm">
          <span>{t("No credit card required.")}</span>
          <span>{t("No commitment required.")}</span>
        </p>
      </div>
    </main>
  );
}
