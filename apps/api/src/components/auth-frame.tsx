import { ZoonkLogo } from "@zoonk/ui/components/zoonk-logo";
import { MAIN_URL } from "@zoonk/utils/url";
import { getExtracted } from "next-intl/server";

/**
 * Every sign-in page as one centered unit: the brain on top, which also goes back to the app (so
 * leaving sign-in is always one tap), then the page's one step. From tablets up the unit sits on a
 * card, so it never floats in an empty screen.
 */
export async function AuthFrame({ children }: { children: React.ReactNode }) {
  const t = await getExtracted();

  return (
    <div className="sm:bg-background flex w-full max-w-sm flex-col items-center gap-6 sm:max-w-[440px] sm:rounded-[28px] sm:p-10 sm:shadow-[0_0_0_1px_rgb(0_0_0/0.04),0_1px_2px_rgb(0_0_0/0.04),0_16px_40px_-16px_rgb(0_0_0/0.16)] sm:dark:shadow-[0_0_0_1px_rgb(255_255_255/0.1)]">
      <a
        className="focus-visible:ring-ring/50 -m-2 rounded-2xl p-2 outline-none focus-visible:ring-[3px]"
        href={MAIN_URL}
      >
        <ZoonkLogo className="size-10" label={t("Back to Zoonk")} />
      </a>

      {children}
    </div>
  );
}
