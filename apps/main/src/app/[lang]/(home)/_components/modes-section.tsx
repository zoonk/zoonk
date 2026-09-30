import {
  SECTION_CLASS,
  SECTION_LEAD_CLASS,
  SECTION_TITLE_CLASS,
} from "@/components/public/landing-styles";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@zoonk/ui/components/tabs";
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

/**
 * One mode's pitch beside its lesson screen: what it's like, in words a visitor already knows.
 * Both modes put their pitch on the same side, so switching reads as one comparison.
 */
function ModeIntro({
  children,
  description,
  title,
  titleClassName,
}: {
  children: ReactNode;
  description: string;
  title: string;
  titleClassName: string;
}) {
  return (
    <div
      className={cn(SECTION_CLASS, "grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16")}
    >
      <div className="mx-auto max-w-[480px] text-center lg:mx-0 lg:text-left">
        <h3 className={cn("font-bold text-balance", titleClassName)}>{title}</h3>
        <p className="text-muted-foreground mt-3 text-base leading-relaxed text-pretty sm:mt-4 sm:text-lg">
          {description}
        </p>
      </div>

      <div className="flex justify-center">{children}</div>
    </div>
  );
}

/**
 * Focus and Fun as a switch over the same lesson, so the section shows its point (one plan, two
 * looks, change any time) and phones scroll past one mode instead of both. Fun goes on to show what
 * makes it a game (the voyage, the buddy, the boss and the cards), so everything playful stays
 * inside Fun's tab. Both panels stay in the page for search engines and for a switch without
 * waiting. Fun here is the real Fun mode, so it's deep space on every device, like the app.
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

      <Tabs className="mt-8 gap-0 sm:mt-10" defaultValue="focus">
        <TabsList className="self-center group-data-horizontal/tabs:h-11">
          <TabsTrigger className="min-w-28 px-5 text-[15px]" value="focus">
            {t("Focus")}
          </TabsTrigger>
          <TabsTrigger className="min-w-28 px-5 text-[15px]" value="fun">
            {t("Fun")}
          </TabsTrigger>
        </TabsList>

        <TabsContent
          className="bg-muted/60 dark:bg-card mt-8 rounded-none py-14 text-base sm:mt-10 sm:py-20"
          keepMounted
          value="focus"
        >
          <ModeIntro
            description={t(
              "Just the lesson and your progress on a quiet screen, so nothing pulls your attention away.",
            )}
            title={t("Calm and simple")}
            titleClassName="text-[28px] leading-[1.1] tracking-[-0.03em] sm:text-4xl"
          >
            <FocusLessonPreview prices={prices} />
          </ModeIntro>
        </TabsContent>

        <TabsContent
          className="fun-space mt-8 rounded-none py-14 text-base sm:mt-10 sm:py-20"
          data-mode="fun"
          keepMounted
          value="fun"
        >
          <ModeIntro
            description={t(
              "Your plan becomes a space voyage to your goal. A buddy comes along, daily missions keep you going, and you earn rewards as you learn.",
            )}
            title={t("Learning that feels like a game")}
            titleClassName="font-fun-display text-[26px] leading-[1.15] tracking-[-0.01em] sm:text-[34px]"
          >
            <FunLessonPreview prices={prices} />
          </ModeIntro>

          <div
            className={cn(
              SECTION_CLASS,
              "mt-14 grid grid-cols-1 gap-4 sm:mt-20 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3",
            )}
          >
            <VoyageRoute />
            <VoyageBuddy />
            <VoyageBoss />
            <VoyageCards />
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
