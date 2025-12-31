import { buttonVariants } from "@zoonk/ui/components/button";
import { ArrowRightIcon, SparklesIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function Hero() {
  const t = await getExtracted();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-8 px-4 py-16 md:py-24">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-balance font-semibold text-3xl text-foreground/90 tracking-tight md:text-5xl md:tracking-tighter">
          {t("Learn anything with AI")}
        </h1>

        <p className="max-w-md text-pretty text-lg text-muted-foreground md:text-xl">
          {t(
            "Interactive courses built for you. Just tell us what you want to learn.",
          )}
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
          <SparklesIcon aria-hidden="true" className="size-4" />
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
          <ArrowRightIcon aria-hidden="true" className="size-4" />
        </Link>
      </div>
    </main>
  );
}

export function HeroSkeleton() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-8 px-4 py-16 md:py-24">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-muted md:h-12 md:w-96" />
        <div className="h-6 w-80 animate-pulse rounded-lg bg-muted" />
      </div>

      <div className="flex gap-4">
        <div className="h-10 w-32 animate-pulse rounded-4xl bg-muted" />
        <div className="h-10 w-32 animate-pulse rounded-4xl bg-muted" />
      </div>
    </main>
  );
}
