import { ZoonkLogo } from "@zoonk/ui/components/zoonk-logo";
import { ArrowLeftIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";

/** The product's name, the same in every language. */
const BRAND_NAME = "Zoonk";

async function BackLink({ appUrl }: { appUrl: string | Promise<string> }) {
  const [t, href] = await Promise.all([getExtracted(), appUrl]);

  return (
    <a
      aria-label={t({
        description:
          'The link shows only the word "Zoonk", so keep "Zoonk" as a separate word, with no ending or particle attached.',
        message: "Back to Zoonk",
      })}
      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 absolute top-3 left-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium outline-none focus-visible:ring-[3px] sm:top-5 sm:left-5"
      href={href}
    >
      <ArrowLeftIcon aria-hidden="true" className="size-4" />
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
