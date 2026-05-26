import { getSession } from "@zoonk/core/users/session/get";
import { buttonVariants } from "@zoonk/ui/components/button";
import { SparklesIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import Link from "next/link";

/**
 * Shows the zero-progress home state. The hero stays focused on course creation,
 * while guests get a quiet login prompt because anonymous progress is not saved.
 */
export async function Hero() {
  const session = await getSession();
  const t = await getExtracted();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-8 px-4 py-16 md:py-24">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-foreground/90 text-3xl font-semibold tracking-tight text-balance md:text-5xl md:tracking-tighter">
          {t("Learn anything with AI")}
        </h1>

        <p className="text-muted-foreground max-w-md text-lg text-pretty md:text-xl">
          {t("Interactive courses built for you. Just tell us what you want to learn.")}
        </p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <Link
          className={buttonVariants({ className: "gap-2", size: "lg", variant: "default" })}
          href="/learn"
          prefetch
        >
          <SparklesIcon aria-hidden="true" />
          {t("Create a course with AI")}
        </Link>

        {!session && (
          <Link
            className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 transition-colors hover:underline"
            href="/login"
            prefetch={false}
          >
            {t("Log in to save your progress")}
          </Link>
        )}
      </div>
    </main>
  );
}
