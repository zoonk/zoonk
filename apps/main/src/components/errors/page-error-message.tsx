"use client";

import { ZoonkLogo } from "@/components/brand/zoonk-logo";
import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";

/**
 * A page that failed to load says so calmly and offers to try again, with a way home, instead of
 * the framework's bare error screen. Pages pass their own home link: the app's router link, or a
 * plain link when the whole app failed.
 */
export function PageErrorMessage({
  homeLink,
  onRetry,
}: {
  homeLink: React.ReactNode;
  onRetry: () => void;
}) {
  const t = useExtracted();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[704px] flex-col justify-center px-5 py-16 sm:px-8">
      <ZoonkLogo className="size-8" />

      <h1 className="mt-6 text-[30px] leading-[1.1] font-bold tracking-[-0.03em] text-balance sm:text-[44px] sm:leading-[1.08]">
        {t("This page didn't load")}
      </h1>

      <p className="text-muted-foreground mt-3 text-base leading-relaxed text-pretty sm:mt-4 sm:text-[19px]">
        {t("Something went wrong on our side. Trying again usually fixes it.")}
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button onClick={onRetry} size="lg">
          {t("Try again")}
        </Button>

        {homeLink}
      </div>
    </main>
  );
}
