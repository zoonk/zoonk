import {
  PREVIEW_CARD_CLASS,
  SECTION_CLASS,
  SECTION_LEAD_CLASS,
  SECTION_TITLE_CLASS,
  TILE_CLASS,
} from "@/components/public/landing-styles";
import { Buddy } from "@zoonk/ui/components/buddy";
import { Trickster } from "@zoonk/ui/components/trickster";
import { cn } from "@zoonk/ui/lib/utils";
import { CircleCheckIcon, CircleDashedIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";

/** A buddy fed today: awake and cheerful. */
const BUDDY_ENERGY = 70;

/** The Trickster's shield: one segment breaks with each right answer, and 7 win the duel. */
const SHIELD_SIZE = 7;
const SHIELD_BROKEN = 4;

const SHIELD_SEGMENTS = Array.from({ length: SHIELD_SIZE }, (_, index) => ({
  id: index,
  isBroken: index < SHIELD_BROKEN,
}));

function MotivationTile({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <li className={cn(TILE_CLASS, "flex flex-col p-5 sm:p-7")}>
      <h3 className="text-[19px] font-semibold tracking-[-0.015em] sm:text-[21px]">{title}</h3>
      <p className="text-muted-foreground mt-1 max-w-[460px] text-sm leading-relaxed text-pretty sm:mt-1.5 sm:text-[15px]">
        {description}
      </p>
      {/* The previews line up at the bottom when the descriptions wrap differently. */}
      <div aria-hidden="true" className="mt-5 flex flex-1 flex-col justify-end sm:mt-6">
        <div className={cn(PREVIEW_CARD_CLASS, "p-4 sm:p-5")}>{children}</div>
      </div>
    </li>
  );
}

function Mission({ children, isDone }: { children: ReactNode; isDone: boolean }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {isDone ? (
        <CircleCheckIcon className="size-4 flex-none text-emerald-600 dark:text-emerald-400" />
      ) : (
        <CircleDashedIcon className="text-muted-foreground size-4 flex-none" />
      )}
      <span className={cn(isDone && "text-muted-foreground")}>{children}</span>
    </li>
  );
}

/** The buddy and today's three missions, as the app shows them. */
async function BuddyPreview() {
  const t = await getExtracted();

  return (
    <div className="flex items-center gap-4">
      <Buddy beltColor="yellow" className="size-20 sm:size-24" energy={BUDDY_ENERGY} kind="zu" />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[15px] font-semibold">{t("Today's missions")}</p>
          <p className="text-muted-foreground text-[13px] whitespace-nowrap">{t("2 of 3")}</p>
        </div>

        <ul className="mt-2 flex flex-col gap-1.5">
          <Mission isDone>{t("Review")}</Mission>
          <Mission isDone>{t("Something new")}</Mission>
          <Mission isDone={false}>{t("Fix a mistake")}</Mission>
        </ul>
      </div>
    </div>
  );
}

/** The Trickster with its shield half broken, mid-duel. */
async function TricksterPreview() {
  const t = await getExtracted();

  return (
    <div className="flex items-center gap-4">
      <Trickster className="size-20 sm:size-24" />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[15px] font-semibold">{t("Shield")}</p>
          <p className="text-muted-foreground text-[13px] whitespace-nowrap">
            {t("4 right · 3 to go")}
          </p>
        </div>

        <div className="mt-3 flex gap-1">
          {SHIELD_SEGMENTS.map((segment) => (
            <span
              className={cn(
                "h-2.5 flex-1 rounded-full",
                segment.isBroken ? "bg-border" : "bg-violet-500 dark:bg-violet-400",
              )}
              key={segment.id}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * What keeps people going, in the app's own calm look: a buddy fed by the day's three missions and
 * the Trickster at the end of each phase. Rewards come from learning, and losing costs nothing.
 */
export async function MotivationSection() {
  const t = await getExtracted();

  return (
    <section aria-labelledby="motivation-title" className={cn(SECTION_CLASS, "mt-24 sm:mt-40")}>
      <div className="max-w-[700px]">
        <h2 className={SECTION_TITLE_CLASS} id="motivation-title">
          {t("Small wins every day")}
        </h2>
        <p className={SECTION_LEAD_CLASS}>
          {t(
            "Studying feeds your buddy, and every phase ends with a challenge. Mistakes never cost you anything.",
          )}
        </p>
      </div>

      <ul className="mt-8 grid grid-cols-1 gap-3 sm:mt-12 sm:grid-cols-2 sm:gap-5">
        <MotivationTile
          description={t(
            "Three missions a day: a review, something new and a mistake to fix. Your buddy grows as you learn.",
          )}
          title={t("A buddy you feed by learning")}
        >
          <BuddyPreview />
        </MotivationTile>

        <MotivationTile
          description={t(
            "Each phase ends with 10 questions and no hints. Get 7 right to win. If you lose, you get a rematch tomorrow.",
          )}
          title={t("Face the Trickster")}
        >
          <TricksterPreview />
        </MotivationTile>
      </ul>
    </section>
  );
}
