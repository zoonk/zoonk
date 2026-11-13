import { BackLink, PageTopBar } from "@zoonk/ui/components/page-top";
import { ZoonkLogo } from "@zoonk/ui/components/zoonk-logo";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";

/** The product's name, the same in every language. */
const BRAND_NAME = "Zoonk";

/** The way back to the app that sent the learner, in the shared page top's bar across the frame. */
async function AuthBackLink({ appUrl }: { appUrl: string | Promise<string> }) {
  const [t, href] = await Promise.all([getExtracted(), appUrl]);

  return (
    <BackLink
      aria-label={t({
        description:
          'The link shows only the word "Zoonk", so keep "Zoonk" as a separate word, with no ending or particle attached.',
        message: "Back to Zoonk",
      })}
      href={href}
    >
      {BRAND_NAME}
    </BackLink>
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
      <div className="absolute inset-x-0 top-0 px-(--page-gutter) [--page-gutter:--spacing(4)] sm:[--page-gutter:--spacing(6)] lg:[--page-gutter:--spacing(8)]">
        <PageTopBar
          back={
            <Suspense fallback={null}>
              <AuthBackLink appUrl={appUrl} />
            </Suspense>
          }
        />
      </div>

      <div className="flex w-full max-w-[360px] flex-col items-center gap-6">
        <ZoonkLogo className="size-8" />
        {children}
      </div>
    </>
  );
}
