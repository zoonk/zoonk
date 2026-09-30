import { Buddy } from "@zoonk/ui/components/buddy";
import { type BeltColor } from "@zoonk/utils/belt-level";
import { type BuddyKind } from "@zoonk/utils/buddy";
import { CircleCheckIcon, CircleDashedIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";

const BUDDY_ENERGY = 70;
const CALM_ENERGY = 60;

/** The four buddies to pick from, each wearing a different belt so they look their age. */
const BUDDY_CHOICES: { belt: BeltColor; kind: BuddyKind }[] = [
  { belt: "yellow", kind: "zu" },
  { belt: "white", kind: "noodle" },
  { belt: "orange", kind: "beep" },
  { belt: "green", kind: "otto" },
];

function MealItem({ children, icon }: { children: ReactNode; icon: ReactNode }) {
  return (
    <li className="bg-fun-soft flex min-w-0 flex-col items-center gap-1.5 rounded-2xl px-1.5 py-2.5">
      {icon}
      <span className="text-fun-fg2 text-xs leading-tight font-semibold text-balance wrap-break-word">
        {children}
      </span>
    </li>
  );
}

/** A buddy fed by learning: today's missions are a review, something new and a fixed mistake. */
export async function VoyageBuddy() {
  const t = await getExtracted();

  return (
    <div className="fun-glass relative flex flex-col overflow-hidden rounded-[28px] p-6 sm:row-span-2 sm:p-7">
      <h4 className="font-fun-display text-xl font-bold sm:text-[21px]">
        {t("A buddy you feed by learning")}
      </h4>
      <p className="text-fun-fg2 mt-2 text-[15px] leading-relaxed">
        {t(
          "Lessons, reviews and fixed mistakes are its food. It grows as you learn and never gets sick.",
        )}
      </p>

      <div
        aria-hidden="true"
        className="relative mt-4 flex h-[260px] items-end justify-center sm:h-[300px] lg:h-[336px]"
      >
        <div className="absolute top-[46%] left-1/2 size-[280px] -translate-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(124_245_255/0.22),rgb(167_139_250/0.1)_55%,transparent)]" />
        <Buddy
          beltColor="blue"
          className="relative size-[240px] sm:size-[280px]"
          energy={BUDDY_ENERGY}
          expression="happy"
          kind="zu"
        />
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-3">
        <p className="text-fun-fg2 text-[13px] font-semibold">{t("Today's missions")}</p>
        <p className="text-fun-fg2 text-xs whitespace-nowrap">{t("2 of 3")}</p>
      </div>

      <ul className="mt-2 grid grid-cols-3 gap-2 text-center">
        <MealItem
          icon={<CircleCheckIcon aria-hidden="true" className="text-fun-accent-cyan size-4" />}
        >
          {t("Review")}
        </MealItem>
        <MealItem
          icon={<CircleCheckIcon aria-hidden="true" className="text-fun-accent-lime size-4" />}
        >
          {t("Something new")}
        </MealItem>
        <MealItem
          icon={<CircleDashedIcon aria-hidden="true" className="text-fun-accent-pink size-4" />}
        >
          {t("Fix a mistake")}
        </MealItem>
      </ul>

      <div className="border-fun-line mt-6 border-t pt-5 sm:mt-auto">
        <p className="text-fun-fg2 text-[13px] font-semibold">
          {t("Pick {zu}, {noodle}, {beep} or {otto}", {
            beep: t("Beep"),
            noodle: t("Noodle"),
            otto: t("Otto"),
            zu: t("Zu"),
          })}
        </p>
        <div aria-hidden="true" className="mt-2 flex items-end justify-between gap-1">
          {BUDDY_CHOICES.map((choice) => (
            <Buddy
              beltColor={choice.belt}
              className="size-14 sm:size-16"
              energy={CALM_ENERGY}
              expression="happy"
              key={choice.kind}
              kind={choice.kind}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
