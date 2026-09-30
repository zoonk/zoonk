import { Buddy } from "@zoonk/ui/components/buddy";
import { Trickster } from "@zoonk/ui/components/trickster";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, FlagIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { type ExampleDate, getExampleDates } from "../example-dates";
import { getExampleMove } from "../example-move";

const BUDDY_ENERGY = 85;

/** Each phase is a moon with its own color; they share a soft glow. */
const MOON_CLASS = {
  blue: "bg-[radial-gradient(circle_at_35%_30%,#c8f7ff,#38bdf8_60%,#0c4a8a)] shadow-[0_0_30px_rgb(56_189_248/0.5)]",
  lime: "bg-[radial-gradient(circle_at_35%_30%,#eaffc2,#a3e635_60%,#3f6212)] shadow-[0_0_30px_rgb(200_255_77/0.4)]",
  orange:
    "bg-[radial-gradient(circle_at_35%_30%,#ffd1a1,#ff8a3d_60%,#8a3a12)] shadow-[0_0_24px_rgb(255_138_61/0.4)]",
  violet:
    "bg-[radial-gradient(circle_at_35%_30%,#e2d4ff,#a78bfa_60%,#4c2a9e)] shadow-[0_0_24px_rgb(167_139_250/0.4)]",
} as const;

type Stop = { date?: ExampleDate; moon: keyof typeof MOON_CLASS; note: string; title: string };

/** Below tablet width the route is a list, so every phase keeps its full name. */
function RouteList({ stops, dates }: { dates: Record<ExampleDate, string>; stops: Stop[] }) {
  return (
    <ol className="mt-5 flex flex-col gap-4 md:hidden">
      {stops.map((stop) => (
        <li className="flex items-center gap-3" key={stop.title}>
          <span className={cn("size-9 flex-none rounded-full", MOON_CLASS[stop.moon])} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">{stop.title}</p>
            <p className="text-fun-fg2 text-xs">{stop.date ? dates[stop.date] : stop.note}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * The hero's plan as a voyage: phases are moons on the way to the goal's
 * planet, Zu marks where the learner is, and the Trickster waits at the end of
 * the phase.
 */
export async function VoyageRoute() {
  const [t, dates, move] = await Promise.all([getExtracted(), getExampleDates(), getExampleMove()]);

  const stops: Stop[] = [
    { moon: "lime", note: t("Skipped"), title: t("The basics") },
    { moon: "blue", note: t("You are here"), title: t("Arriving") },
    { date: "workPhase", moon: "violet", note: "", title: t("At work") },
    { date: "dailyLife", moon: "orange", note: "", title: t("Daily life") },
  ];

  return (
    <div className="fun-glass relative overflow-hidden rounded-[28px] p-6 sm:col-span-2 sm:p-7 md:aspect-697/420">
      <div className="relative z-10 max-w-[330px]">
        <h4 className="font-fun-display text-xl font-bold sm:text-[21px]">
          {t("{move, select, london {The route to London} other {The route to Madrid}}", { move })}
        </h4>
        <p className="text-fun-fg2 mt-2 text-[15px] leading-relaxed">
          {t("Each phase is a moon, and a boss waits at the end of it.")}
        </p>
      </div>

      <RouteList dates={dates} stops={stops} />

      <div aria-hidden="true" className="absolute inset-0 hidden md:block">
        <svg
          className="absolute inset-0 size-full"
          preserveAspectRatio="none"
          viewBox="0 0 697 420"
        >
          <path
            className="stroke-fun-dash"
            d="M-10 350 C 30 344, 66 330, 96 318 S 170 302, 217 293 S 292 276, 322 262 S 390 242, 414 226 S 464 198, 487 176 S 512 152, 526 144"
            fill="none"
            strokeDasharray="3 7"
            strokeLinecap="round"
            strokeWidth="2"
          />
        </svg>

        <div className="fun-planet absolute top-[10%] left-[71.4%] aspect-square w-[21.5%]" />
        <div className="absolute top-[23.8%] left-[68.3%] h-[7.6%] w-[28%] rotate-[-14deg] rounded-[50%] border-[3px] border-[#ffd9a8]/60" />
        <span className="fun-glass absolute top-[52.8%] right-[4.4%] inline-flex h-8 items-center gap-2 rounded-full px-3 text-[13px] font-semibold whitespace-nowrap">
          <FlagIcon className="text-fun-accent-lime size-3.5 flex-none" />
          {t("{move, select, london {London · {date}} other {Madrid · {date}}}", {
            date: dates.movingDay,
            move,
          })}
        </span>

        <div
          className={cn(
            "absolute top-[70.2%] left-[10.5%] flex size-[46px] items-center justify-center rounded-full text-[#1a2e05]",
            MOON_CLASS.lime,
          )}
        >
          <CheckIcon className="size-5" strokeWidth={3} />
        </div>
        <div className="absolute top-[83.3%] left-[8.6%]">
          <p className="text-sm font-bold">{t("The basics")}</p>
          <p className="text-fun-fg2 text-xs">{t("Skipped")}</p>
        </div>

        <div className="absolute top-[61.4%] left-[26.1%] size-[70px] rounded-full border-[1.5px] border-dashed border-[#7cf5ff]/60" />
        <div
          className={cn(
            "absolute top-[63.6%] left-[27.4%] size-[52px] rounded-full",
            MOON_CLASS.blue,
          )}
        />
        <Buddy
          beltColor="yellow"
          className="absolute top-[49%] left-[26.7%] size-[62px]"
          energy={BUDDY_ENERGY}
          expression="cheer"
          kind="zu"
        />
        <div className="absolute top-[80.5%] left-[25.3%]">
          <p className="text-fun-accent-cyan text-xs font-bold tracking-widest uppercase">
            {t("You are here")}
          </p>
          <p className="text-sm font-bold">{t("Arriving")}</p>
        </div>

        <Trickster className="absolute top-[54.3%] left-[41.6%] size-16" />
        <span className="absolute top-[71%] left-[41.6%] inline-flex h-6 items-center rounded-full bg-violet-600 px-2 text-xs font-bold whitespace-nowrap text-white">
          {t("Boss · {date}", { date: dates.bossDuel })}
        </span>

        <div
          className={cn("absolute top-[49%] left-[56.5%] size-10 rounded-full", MOON_CLASS.violet)}
        />
        <div className="absolute top-[60.5%] left-[57.4%]">
          <p className="text-sm font-bold">{t("At work")}</p>
          <p className="text-fun-fg2 text-xs">{dates.workPhase}</p>
        </div>

        <div
          className={cn(
            "absolute top-[37.9%] left-[67.4%] size-[34px] rounded-full",
            MOON_CLASS.orange,
          )}
        />
        <div className="absolute top-[31.4%] right-[33.7%] text-right">
          <p className="text-sm font-bold">{t("Daily life")}</p>
          <p className="text-fun-fg2 text-xs">{dates.dailyLife}</p>
        </div>
      </div>
    </div>
  );
}
