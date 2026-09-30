import { Trickster } from "@zoonk/ui/components/trickster";
import { cn } from "@zoonk/ui/lib/utils";
import { ArrowRightIcon, PhoneIcon, SparklesIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";
import { getExampleMove } from "../example-move";

const SHIELD_BROKEN = 4;
const SHIELD_LEFT = 3;

/** The Trickster's shield: one segment breaks with each right answer. */
function Shield() {
  const segments = [
    ...Array.from({ length: SHIELD_BROKEN }, (_, index) => ({
      id: `broken-${index}`,
      isBroken: true,
    })),
    ...Array.from({ length: SHIELD_LEFT }, (_, index) => ({
      id: `left-${index}`,
      isBroken: false,
    })),
  ];

  return (
    <div aria-hidden="true" className="mt-2 flex gap-1.5 px-1">
      {segments.map((segment) => (
        <span
          className={cn(
            "h-3 flex-1 skew-x-[-18deg] rounded",
            segment.isBroken
              ? "border-fun-accent-lime/60 border border-dashed bg-white/5"
              : "bg-[linear-gradient(180deg,#d9c8ff,#8b5cf6_55%,#6d28d9)] shadow-[0_0_12px_rgb(167_139_250/0.55)]",
          )}
          key={segment.id}
        />
      ))}
    </div>
  );
}

function renderRight(chunks: ReactNode) {
  return <b className="text-fun-accent-lime">{chunks}</b>;
}

/** The boss at the end of each phase: exam-day conditions, and a rematch if it goes wrong. */
export async function VoyageBoss() {
  const t = await getExtracted();

  return (
    <div className="fun-glass relative overflow-hidden rounded-[28px] p-6 sm:p-7">
      <div className="absolute -top-1.5 -right-4 size-[210px] rounded-full bg-[radial-gradient(closest-side,rgb(168_85_247/0.35),transparent)]" />
      <Trickster className="absolute -top-1.5 right-0.5 size-[150px] sm:size-[172px]" pose="hero" />

      <div className="relative mt-[110px] sm:mt-[128px]">
        <h4 className="font-fun-display text-xl font-bold sm:text-[21px]">
          {t("Face the Trickster")}
        </h4>
        <p className="text-fun-fg2 mt-2 text-[15px] leading-relaxed">
          {t("10 mixed questions, no hints, like exam day. Lose, and you get a rematch tomorrow.")}
        </p>

        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-3">
          <p className="text-fun-fg2 text-xs font-semibold">{t("His shield")}</p>
          <p className="text-fun-fg2 text-xs">
            {t.rich("<b>4 right</b> · 3 to go", { b: renderRight })}
          </p>
        </div>
        <Shield />
      </div>
    </div>
  );
}

/**
 * A study card as it looks in the app. It grows with its title, and a long word breaks with a
 * hyphen in the page's language instead of running out of the card.
 */
function StudyCard({ badge, label, title }: { badge?: string; label: string; title: string }) {
  const isGold = Boolean(badge);

  return (
    <div
      className={cn(
        "fun-card fun-card-blue flex min-h-[132px] w-full max-w-28 flex-col justify-self-center rounded-2xl p-2.5",
        isGold ? "shadow-fun-gold" : "opacity-60 saturate-[0.1]",
      )}
    >
      <p className="text-[11px] leading-none font-bold tracking-wide wrap-break-word text-white/90 uppercase">
        {label}
      </p>
      <span className="mt-2 flex size-[38px] flex-none items-center justify-center rounded-[11px] border border-white/20 bg-white/15">
        <PhoneIcon className="size-[18px]" />
      </span>
      <p className="mt-auto pt-2 text-xs leading-tight font-extrabold wrap-break-word hyphens-auto text-white">
        {title}
      </p>
      {badge && (
        <span className="bg-fun-gold mt-1.5 inline-flex min-h-5 items-center gap-0.5 self-start rounded-full px-2 text-xs font-extrabold whitespace-nowrap text-amber-950">
          <SparklesIcon className="size-2.5 flex-none" />
          {badge}
        </span>
      )}
    </div>
  );
}

/** Cards fade until a time capsule brings them back; remembered on three days, they turn gold. */
export async function VoyageCards() {
  const [t, move] = await Promise.all([getExtracted(), getExampleMove()]);
  const label = t("{move, select, london {English} other {Spanish}}", { move });

  return (
    <div className="fun-glass relative overflow-hidden rounded-[28px] p-6 sm:p-7">
      {/* Cards on the first row, captions on the second; the capsule sits between the cards with
      its name under it and an arrow toward the card it brings back. */}
      <div
        aria-hidden="true"
        className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-x-1.5 gap-y-2.5"
      >
        <StudyCard label={label} title={t("Phone calls")} />

        <div className="flex max-w-14 flex-col items-center justify-center self-center text-center">
          <svg className="h-14 w-[45px] flex-none" viewBox="0 0 64 80">
            <rect
              fill="#c9cff0"
              height="64"
              rx="22"
              stroke="#5b64a8"
              strokeOpacity=".4"
              strokeWidth="1.5"
              width="44"
              x="10"
              y="3"
            />
            <path d="M10.5 46 H53.5" stroke="#5b64a8" strokeOpacity=".45" strokeWidth="1.5" />
            <circle cx="32" cy="26" fill="#2a2566" r="13" stroke="#5b64a8" strokeWidth="3" />
            <circle cx="32" cy="26" fill="#7cf5ff" r="9.5" />
            <path
              d="M32 26 V19.5 M32 26 L36.5 28.5"
              stroke="#16123a"
              strokeLinecap="round"
              strokeWidth="2.4"
            />
            <rect fill="#5b64a8" height="13" rx="6.5" width="56" x="4" y="62" />
          </svg>
          <p className="text-fun-fg2 mt-1.5 text-xs leading-tight font-semibold text-balance">
            {t("Capsule")}
          </p>
          <ArrowRightIcon className="text-fun-fg2 mt-1 size-4 flex-none" />
        </div>

        <StudyCard badge={t("gold")} label={label} title={t("Phone calls")} />

        <p className="text-fun-fg2 text-center text-xs font-semibold">{t("Fading")}</p>
        <span />
        <p className="text-fun-accent-amber text-center text-xs font-semibold">{t("Remembered")}</p>
      </div>

      <h4 className="font-fun-display mt-5 text-xl font-bold sm:text-[21px]">
        {t("Cards that turn gold")}
      </h4>
      <p className="text-fun-fg2 mt-2 text-[15px] leading-relaxed">
        {t(
          "A time capsule brings a card back before it fades. Remember it on 3 different days and it turns gold.",
        )}
      </p>
    </div>
  );
}
