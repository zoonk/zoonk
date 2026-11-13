import { buttonVariants } from "@zoonk/ui/components/button";
import { ZoonkLogo } from "@zoonk/ui/components/zoonk-logo";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronLeftIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";

/** The product's name, the same in every language. */
const BRAND_NAME = "Zoonk";

/**
 * The app's named back link (as `LearnBackLink`'s), placed where the public pages' bar draws the Zoonk
 * mark: on its gutter, at its bar's middle.
 */
async function BackLink({ appUrl }: { appUrl: string | Promise<string> }) {
  const [t, href] = await Promise.all([getExtracted(), appUrl]);

  return (
    <a
      aria-label={t({
        description:
          'The link shows only the word "Zoonk", so keep "Zoonk" as a separate word, with no ending or particle attached.',
        message: "Back to Zoonk",
      })}
      className={cn(
        buttonVariants({ edge: "start", size: "icon-bar", variant: "ghost" }),
        "absolute top-1.5 left-4 h-11 w-auto gap-0.5 pr-2 [--control-size:calc(var(--icon-size)+2px)] sm:top-3.5 sm:left-6 lg:left-8 lg:[--control-size:calc(var(--icon-size)+2px)]",
      )}
      href={href}
    >
      <ChevronLeftIcon aria-hidden="true" />
      {BRAND_NAME}
    </a>
  );
}

/** The way back depends on which app sent the learner, so a static page streams it in after the form. */
export function AuthFrame({
  appUrl,
  children,
}: {
  appUrl: string | Promise<string>;
  children: React.ReactNode;
}) {
  return (
    <>
      <Suspense fallback={null}>
        <BackLink appUrl={appUrl} />
      </Suspense>

      <div className="flex w-full max-w-[360px] flex-col items-center gap-6">
        <ZoonkLogo className="size-8" />
        {children}
      </div>
    </>
  );
}
