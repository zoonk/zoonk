import {
  SECTION_CLASS,
  SECTION_LEAD_CLASS,
  SECTION_TITLE_CLASS,
} from "@/components/public/landing-styles";
import { cn } from "@zoonk/ui/lib/utils";
import { type SupportedLocale } from "@zoonk/utils/locale";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";
import { FOCUS_AND_FUN_ID } from "./home-ids";
import { FocusLessonPreview } from "./previews/focus-lesson-preview";
import { FunLessonPreview } from "./previews/fun-lesson-preview";
import { getLessonPrices } from "./previews/lesson-prices";
import { VoyageBuddy } from "./voyage/voyage-buddy";
import { VoyageBoss, VoyageCards } from "./voyage/voyage-challenges";
import { VoyageRoute } from "./voyage/voyage-route";

const FOCUS_TITLE_ID = "focus-mode-title";
const FUN_TITLE_ID = "fun-mode-title";

/**
 * One mode's pitch beside its lesson screen: what it's like, in words a visitor already knows.
 * Both modes put their pitch on the same side, so the two read as one comparison.
 */
function ModeIntro({
  badge,
  children,
  description,
  title,
  titleClassName,
  titleId,
}: {
  badge: ReactNode;
  children: ReactNode;
  description: string;
  title: string;
  titleClassName: string;
  titleId: string;
}) {
  return (
    <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div className="mx-auto max-w-[480px] text-center lg:mx-0 lg:text-left">
        {badge}
        <h3 className={cn("mt-4 font-bold text-balance", titleClassName)} id={titleId}>
          {title}
        </h3>
        <p className="text-muted-foreground mt-3 text-base leading-relaxed text-pretty sm:mt-4 sm:text-lg">
          {description}
        </p>
      </div>

      <div className="flex justify-center">{children}</div>
    </div>
  );
}

/**
 * Focus and Fun, one after the other, each with its pitch and its own screen of the same lesson.
 * Fun goes on to show what makes it a game (the voyage, the buddy, the boss and the cards), so
 * everything playful stays inside Fun's space. Fun here is the real Fun mode, so it's deep space on
 * every device, like the app.
 */
export async function ModesSection({ locale }: { locale: SupportedLocale }) {
  const [t, prices] = await Promise.all([getExtracted(), getLessonPrices(locale)]);

  return (
    <section
      aria-labelledby={`${FOCUS_AND_FUN_ID}-title`}
      className="mt-24 scroll-mt-20 sm:mt-40"
      id={FOCUS_AND_FUN_ID}
    >
      <div className={cn(SECTION_CLASS, "text-center")}>
        <h2 className={SECTION_TITLE_CLASS} id={`${FOCUS_AND_FUN_ID}-title`}>
          {t("Calm or playful. Same plan.")}
        </h2>
        <p className={cn(SECTION_LEAD_CLASS, "mx-auto max-w-[640px]")}>
          {t(
            "Pick the look that keeps you going. Your lessons, plan and progress are the same in both, and you can switch any time.",
          )}
        </p>
      </div>

      <section
        aria-labelledby={FOCUS_TITLE_ID}
        className="bg-muted/60 dark:bg-card mt-10 py-14 sm:mt-14 sm:py-20"
      >
        <div className={SECTION_CLASS}>
          <ModeIntro
            badge={
              <span className="bg-background inline-flex min-h-8 items-center rounded-full px-3.5 text-sm font-semibold shadow-[0_0_0_1px_rgb(0_0_0/0.06)]">
                {t("Focus")}
              </span>
            }
            description={t(
              "Just the lesson and your progress on a quiet screen, so nothing pulls your attention away.",
            )}
            title={t("Calm and simple")}
            titleClassName="text-[28px] leading-[1.1] tracking-[-0.03em] sm:text-4xl"
            titleId={FOCUS_TITLE_ID}
          >
            <FocusLessonPreview prices={prices} />
          </ModeIntro>
        </div>
      </section>

      <section aria-labelledby={FUN_TITLE_ID} className="fun-space py-14 sm:py-20" data-mode="fun">
        <div className={SECTION_CLASS}>
          <ModeIntro
            badge={
              <span className="bg-fun-lime text-fun-lime-foreground inline-flex min-h-8 items-center rounded-full px-3.5 text-sm font-bold">
                {t("Fun")}
              </span>
            }
            description={t(
              "Your plan becomes a space voyage to your goal. A buddy comes along, daily missions keep you going, and you earn rewards as you learn.",
            )}
            title={t("Learning that feels like a game")}
            titleClassName="font-fun-display text-[26px] leading-[1.15] tracking-[-0.01em] sm:text-[34px]"
            titleId={FUN_TITLE_ID}
          >
            <FunLessonPreview prices={prices} />
          </ModeIntro>

          <div className="mt-14 grid grid-cols-1 gap-4 sm:mt-20 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            <VoyageRoute />
            <VoyageBuddy />
            <VoyageBoss />
            <VoyageCards />
          </div>
        </div>
      </section>
    </section>
  );
}
