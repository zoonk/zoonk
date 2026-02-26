import Link from "next/link";
import { buttonVariants } from "@zoonk/ui/components/button";
import { ArrowRightIcon, SparklesIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";

export async function Hero() {
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

      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
        <Link
          className={buttonVariants({
            className: "gap-2",
            size: "lg",
            variant: "default",
          })}
          href="/learn"
        >
          <SparklesIcon aria-hidden="true" />
          {t("Learn anything")}
        </Link>

        <Link
          className={buttonVariants({
            className: "gap-2",
            size: "lg",
            variant: "outline",
          })}
          href="/courses"
        >
          {t("Explore courses")}
          <ArrowRightIcon aria-hidden="true" />
        </Link>
      </div>
    </main>
  );
}
