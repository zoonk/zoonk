import { ZoonkLogo } from "@zoonk/ui/components/zoonk-logo";
import { ArrowLeftIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";

/** The product's name, the same in every language. */
const BRAND_NAME = "Zoonk";

/**
 * Every sign-in page as one centered column on the page itself, as Linear and Vercel draw theirs:
 * the brain on top, then the page's one step. The way back to the app the learner came from
 * (`appUrl`) says so in the top-left corner, so leaving sign-in is always one tap.
 */
export async function AuthFrame({
  appUrl,
  children,
}: {
  appUrl: string;
  children: React.ReactNode;
}) {
  const t = await getExtracted();

  return (
    <>
      <a
        aria-label={t("Back to Zoonk")}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 absolute top-3 left-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium outline-none focus-visible:ring-[3px] sm:top-5 sm:left-5"
        href={appUrl}
      >
        <ArrowLeftIcon aria-hidden="true" className="size-4" />
        {BRAND_NAME}
      </a>

      <div className="flex w-full max-w-[360px] flex-col items-center gap-6">
        <ZoonkLogo className="size-8" />
        {children}
      </div>
    </>
  );
}
