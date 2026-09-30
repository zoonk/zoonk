"use client";

import { BRAIN_POWER_BONUS } from "@zoonk/core/sessions/brain-power";
import { Buddy } from "@zoonk/ui/components/buddy";
import { cn } from "@zoonk/ui/lib/utils";
import { BrainIcon, LockIcon, RocketIcon, TargetIcon, ZapIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { useState } from "react";
import { useFormatShare } from "../../_utils/percent";
import { useBuddyName } from "../../buddies/use-buddy-name";
import { BeltStripes } from "../../ceremonies/belt-stripes";
import { SummaryActions, SummaryMilestone } from "./summary-actions";
import { useSessionSummary } from "./summary-context";
import { PreparationChange, SkillMoves } from "./summary-parts";

/** Energy is kept 0–100; percentages format as shares so every language spaces "%" its way. */
const PERCENT = 100;

/**
 * What the buddy ate, only what there was, each food in its color as on the buddy's page: "2 new
 * ideas, 12 reviews and 1 fix". Nothing on a day with only questions that fed nothing new.
 */
function useMeal(): React.ReactNode {
  const t = useExtracted();
  const format = useFormatter();
  const { summary } = useSessionSummary();
  const { fixes, newIdeas, reviews } = summary.buddyAte;

  const foods = [
    newIdeas > 0 && (
      <strong className="text-fun-accent-lime font-semibold" key="ideas">
        {t("{count, plural, one {# new idea} other {# new ideas}}", { count: newIdeas })}
      </strong>
    ),
    reviews > 0 && (
      <strong className="text-fun-accent-cyan font-semibold" key="reviews">
        {t("{count, plural, one {# review} other {# reviews}}", { count: reviews })}
      </strong>
    ),
    fixes > 0 && (
      <strong className="text-fun-accent-pink font-semibold" key="fixes">
        {t("{count, plural, one {# fix} other {# fixes}}", { count: fixes })}
      </strong>
    ),
  ].filter((food) => food !== false);

  return foods.length > 0 ? format.list(foods, { type: "conjunction" }) : null;
}

function EatingBuddy({
  buddy,
}: {
  buddy: NonNullable<ReturnType<typeof useSessionSummary>["buddy"]>;
}) {
  const t = useExtracted();
  const meal = useMeal();
  const name = useBuddyName(buddy);

  return (
    <>
      <Buddy
        beltColor={buddy.beltColor}
        className="animate-fun-ceremony size-32"
        energy={buddy.energy}
        expression="cheer"
        glasses={buddy.glasses}
        kind={buddy.kind}
        label={name}
      />
      <h1 className="font-fun-display text-4xl leading-tight font-extrabold">
        {t("Flight plan complete!")}
      </h1>
      {meal && (
        <p className="text-fun-fg2">
          {t.rich("{name} ate <meal></meal>.", { meal: () => meal, name })}
        </p>
      )}
    </>
  );
}

function BuddyMeal() {
  const t = useExtracted();
  const meal = useMeal();
  const { buddy } = useSessionSummary();

  return (
    <header className="flex flex-col items-center gap-3 text-center" role="status">
      {buddy ? (
        <EatingBuddy buddy={buddy} />
      ) : (
        <>
          <h1 className="font-fun-display text-4xl leading-tight font-extrabold">
            {t("Flight plan complete!")}
          </h1>
          {meal && (
            <p className="text-fun-fg2">{t.rich("Today: <meal></meal>.", { meal: () => meal })}</p>
          )}
        </>
      )}
    </header>
  );
}

function StatTile({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: typeof BrainIcon;
  label: string;
  tone: string;
  value: string;
}) {
  return (
    <div className="fun-glass flex flex-col gap-1 rounded-3xl p-4">
      <p className={cn("font-fun-display flex items-center gap-2 text-2xl font-bold", tone)}>
        <Icon aria-hidden="true" className="size-5" />
        {value}
      </p>
      <p className="text-fun-fg2 text-sm">{label}</p>
    </div>
  );
}

function FunStats() {
  const t = useExtracted();
  const formatShare = useFormatShare();
  const { summary } = useSessionSummary();

  return (
    <div className="grid grid-cols-2 gap-2.5">
      <StatTile
        icon={BrainIcon}
        label={t("Brain Power")}
        tone="text-fun-accent-pink"
        value={t("+{points}", { points: String(summary.brainPower) })}
      />
      {summary.accuracy !== null && (
        <StatTile
          icon={TargetIcon}
          label={t("correct")}
          tone="text-fun-fg"
          value={formatShare(summary.accuracy)}
        />
      )}
      {summary.topHyperdrive > 1 && (
        <StatTile
          icon={RocketIcon}
          label={t("Top Hyperdrive")}
          tone="text-fun-accent-violet"
          value={t("x{level}", { level: String(summary.topHyperdrive) })}
        />
      )}
      {summary.energy && (
        <StatTile
          icon={ZapIcon}
          label={t("Energy · was {before}", {
            before: formatShare(Math.round(summary.energy.before) / PERCENT),
          })}
          tone="text-fun-accent-orange"
          value={formatShare(Math.round(summary.energy.after) / PERCENT)}
        />
      )}
    </div>
  );
}

/** A new study card: the idea on the front, tap to see the back. */
function NewCard({ card }: { card: { description: string; name: string } }) {
  const t = useExtracted();
  const [flipped, setFlipped] = useState(false);

  return (
    <button
      aria-label={
        flipped ? card.description : t("{name}, tap to see the back", { name: card.name })
      }
      aria-pressed={flipped}
      className="fun-card fun-card-indigo focus-visible:ring-ring flex min-h-24 w-36 shrink-0 flex-col justify-between gap-2 rounded-2xl p-3 text-left text-sm font-semibold outline-none focus-visible:ring-2 motion-safe:transition-transform"
      onClick={() => setFlipped(!flipped)}
      type="button"
    >
      <span className={cn(flipped && "text-fun-fg2 text-xs font-normal")}>
        {flipped ? card.description : card.name}
      </span>
      <span className="bg-fun-lime text-fun-lime-foreground w-fit rounded-full px-2 py-0.5 text-xs font-bold">
        {t("new")}
      </span>
    </button>
  );
}

function NewCards() {
  const t = useExtracted();
  const { summary } = useSessionSummary();

  if (summary.newCards.length === 0) {
    return null;
  }

  return (
    <section className="fun-glass flex flex-col gap-3 rounded-3xl p-4">
      <p className="font-semibold">
        {t("{count, plural, one {# new card} other {# new cards}}", {
          count: summary.newCards.length,
        })}
      </p>
      <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
        {summary.newCards.map((card) => (
          <NewCard card={card} key={card.skillId} />
        ))}
      </div>
    </section>
  );
}

function SealedCapsule() {
  const t = useExtracted();
  const format = useFormatter();
  const { summary } = useSessionSummary();
  const capsule = summary.capsulesSealed.find((candidate) => candidate.opensOn !== null);

  if (!capsule?.opensOn) {
    return null;
  }

  const day = format.dateTime(capsule.opensOn, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    weekday: "short",
  });

  return (
    <section className="fun-glass flex items-start gap-3 rounded-3xl p-4">
      <span className="bg-fun-lime text-fun-lime-foreground flex size-10 shrink-0 items-center justify-center rounded-full">
        <LockIcon aria-hidden="true" className="size-5" />
      </span>
      <div className="flex flex-col gap-0.5">
        <p className="font-semibold">{t("Capsule sealed")}</p>
        <p className="text-fun-fg2 text-sm">
          {t("{title} opens {day}, when recalling it helps it stick.", {
            day,
            title: capsule.title ?? t("Today's lesson"),
          })}
        </p>
      </div>
    </section>
  );
}

/** A full meal lights the next stripe on the belt: ten stripes per belt, the new ones glowing. */
function MealAndStripes() {
  const t = useExtracted();
  const { summary } = useSessionSummary();
  const { belt } = summary;

  if (!summary.fullMeal && !belt) {
    return null;
  }

  return (
    <section className="fun-glass flex flex-col gap-3 rounded-3xl p-4">
      {summary.fullMeal && (
        <p className="font-semibold">
          {t("Full meal: +{bonus} BP", { bonus: String(BRAIN_POWER_BONUS.fullMeal) })}
        </p>
      )}

      {belt && (
        <BeltStripes
          color={belt.after.color}
          level={belt.after.level}
          stripesGained={belt.stripesGained}
        />
      )}
    </section>
  );
}

/** Preparation and the skills that moved, in one glass card; nothing when neither changed. */
function PreparationAndMoves() {
  const { summary } = useSessionSummary();

  if (summary.preparation.after === null && summary.skillsMoved.length === 0) {
    return null;
  }

  return (
    <div className="fun-glass flex flex-col gap-3 rounded-3xl p-4">
      <PreparationChange />
      <SkillMoves />
    </div>
  );
}

/**
 * Fun's end of the day: the buddy eats what was learned, the numbers as glowing tiles, preparation,
 * the new cards, a capsule sealed with its opening date and the full meal lighting a stripe.
 * The ceremony itself, when there is one, comes from the host.
 */
export function FunSummary() {
  return (
    <div className="flex flex-1 flex-col gap-5" data-slot="fun-summary">
      <BuddyMeal />
      <FunStats />

      <PreparationAndMoves />

      <NewCards />
      <SealedCapsule />
      <MealAndStripes />
      <SummaryMilestone />
      <SummaryActions />
    </div>
  );
}
