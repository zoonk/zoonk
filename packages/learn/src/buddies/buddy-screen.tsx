"use client";

import { type BuddyStatusResult } from "@zoonk/core/milestones/buddy";
import { Buddy, type BuddyExpression } from "@zoonk/ui/components/buddy";
import { cn } from "@zoonk/ui/lib/utils";
import { type BuddyGlasses } from "@zoonk/utils/buddy";
import {
  ArrowRightLeftIcon,
  BookOpenIcon,
  ChevronRightIcon,
  OrbitIcon,
  PencilIcon,
  ZapIcon,
} from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { Meter, MeterFill } from "../_components/meter";
import { useFormatShare } from "../_utils/percent";
import { toBeltColor, useBeltName } from "../_utils/use-belt-name";
import { LearnLink } from "../learn-link";
import { useExperienceMode } from "../mode-provider";
import { BuddyGlassesShelf } from "./buddy-glasses-shelf";
import { BuddyStageName } from "./buddy-labels";
import { BuddySpeech, useBuddyLine } from "./buddy-lines";
import { type LearnBuddy, useBuddyName } from "./use-buddy-name";

export type BuddyStatusView = Extract<BuddyStatusResult, { status: "ready" }>["buddy"];

/** Where the buddy page leads: Appearance to switch or rename, the logbook and preparation. */
export type BuddyScreenHrefs = { appearance: string; logbook: string; preparation: string };

const PERCENT = 100;

/**
 * The page knows whether the learner studied today, so a buddy low on Energy is awake after a
 * session instead of napping: learning is what wakes it.
 */
const BUDDY_EXPRESSION: Record<BuddyStatusView["energy"]["state"], BuddyExpression> = {
  awake: "happy",
  glowing: "cheer",
  napping: "sleepy",
};

function useEnergyWord(state: BuddyStatusView["energy"]["state"]): string {
  const t = useExtracted();

  if (state === "glowing") {
    return t("well fed");
  }

  return state === "napping" ? t("napping") : t("awake");
}

/** "Grows to Young at Orange belt": the next stage and the belt that brings it. */
function GrowthLabel({ belt, stage }: { belt: string; stage: BuddyStatusView["stage"] }) {
  const t = useExtracted();

  switch (stage) {
    case "adult":
      return t("Grows to Adult at {belt}", { belt });
    case "wise":
      return t("Grows to Wise at {belt}", { belt });
    case "baby":
    case "young":
      return t("Grows to Young at {belt}", { belt });
    default:
      return t("Grows to Young at {belt}", { belt });
  }
}

function EnergyAndGrowth({ buddy, status }: { buddy: LearnBuddy; status: BuddyStatusView }) {
  const t = useExtracted();
  const format = useFormatter();
  const beltName = useBeltName();
  const buddyName = useBuddyName(buddy);
  const energyWord = useEnergyWord(status.energy.state);
  const formatShare = useFormatShare();
  const next = status.nextStage;
  const nextBelt = next ? toBeltColor(next.belt) : null;
  const total = status.belt.totalBrainPower;

  return (
    <section className="fun-glass flex flex-col gap-4 rounded-3xl p-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <ZapIcon aria-hidden="true" className="text-fun-energy size-4" />
            {t("Energy")}
            <span className="text-fun-fg2 font-normal">{energyWord}</span>
          </span>
          <span className="font-fun-display text-fun-accent-orange text-lg font-bold tabular-nums">
            {formatShare(status.energy.current / PERCENT)}
          </span>
        </div>
        <Meter className="h-2">
          <MeterFill className="bg-fun-energy" share={status.energy.current / PERCENT} />
        </Meter>
      </div>

      {next && nextBelt ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-semibold">
              <GrowthLabel belt={beltName(nextBelt)} stage={next.stage} />
            </span>
            <span className="text-fun-fg2 text-xs tabular-nums">
              {t("{points} BP to go", { points: format.number(next.brainPowerToGo) })}
            </span>
          </div>
          <Meter className="h-2">
            <MeterFill
              className="bg-fun-accent-pink"
              share={total / Math.max(1, total + next.brainPowerToGo)}
            />
          </Meter>
        </div>
      ) : (
        <p className="text-fun-fg2 text-sm">
          {t("{buddy} is fully grown and wise.", { buddy: buddyName })}
        </p>
      )}
    </section>
  );
}

function Diet({ buddy, status }: { buddy: LearnBuddy; status: BuddyStatusView }) {
  const t = useExtracted();
  const format = useFormatter();
  const buddyName = useBuddyName(buddy);

  const foods = [
    {
      dot: "bg-fun-accent-lime",
      key: "newIdeas",
      label: t("new ideas"),
      value: status.thisWeek.newIdeas,
    },
    {
      dot: "bg-fun-accent-cyan",
      key: "reviews",
      label: t("reviews"),
      value: status.thisWeek.reviews,
    },
    { dot: "bg-fun-accent-pink", key: "fixes", label: t("fixes"), value: status.thisWeek.fixes },
  ];

  return (
    <section className="fun-glass flex flex-col gap-3 rounded-3xl p-4">
      <h2 className="text-sm font-semibold">{t("This week {buddy} ate", { buddy: buddyName })}</h2>
      <dl className="grid grid-cols-3 gap-2">
        {foods.map((food) => (
          <div className="flex flex-col-reverse" key={food.key}>
            <dt className="text-fun-fg2 text-xs">{food.label}</dt>
            <dd className="font-fun-display flex items-center gap-1.5 text-xl font-bold tabular-nums">
              <span aria-hidden="true" className={cn("size-2 rounded-full", food.dot)} />
              {format.number(food.value)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function PageLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <LearnLink
      className="fun-glass focus-visible:ring-ring/50 flex min-h-12 items-center gap-3 rounded-2xl px-4 text-sm font-semibold outline-none focus-visible:ring-[3px]"
      href={href}
    >
      {icon}
      <span className="flex-1">{label}</span>
      <ChevronRightIcon aria-hidden="true" className="text-fun-fg2 size-4" />
    </LearnLink>
  );
}

function BuddyHero({
  hrefs,
  buddy,
  status,
}: {
  hrefs: BuddyScreenHrefs;
  buddy: LearnBuddy;
  status: BuddyStatusView;
}) {
  const t = useExtracted();
  const beltName = useBeltName();
  const name = useBuddyName(buddy);
  const isNapping = status.energy.state === "napping";
  const line = useBuddyLine(isNapping ? "welcomeBack" : "fedToday");

  return (
    <section className="flex flex-col items-center gap-2 text-center">
      <LearnLink
        className="fun-glass text-fun-fg2 hover:text-fun-fg flex min-h-11 items-center gap-1.5 self-end rounded-full px-3 text-xs font-medium"
        href={hrefs.appearance}
      >
        <ArrowRightLeftIcon aria-hidden="true" className="size-3.5" />
        {t("Switch buddy")}
      </LearnLink>

      {/* The buddy's drawing has headroom, so its line sits closer to keep them together. */}
      {status.energy.studiedToday && (
        <div className="relative z-20 -mb-8">
          <BuddySpeech>{line}</BuddySpeech>
        </div>
      )}

      <div className="relative flex flex-col items-center">
        <Buddy
          beltColor={buddy.beltColor}
          className="relative z-10 size-36 sm:size-40"
          energy={status.energy.current}
          expression={BUDDY_EXPRESSION[status.energy.state]}
          studiedToday={status.energy.studiedToday}
          glasses={buddy.glasses}
          kind={buddy.kind}
          label={name}
        />
        <span aria-hidden="true" className="fun-planet -mt-6 size-24 opacity-90" />
      </div>

      <h1 className="font-fun-display flex items-center gap-2 text-3xl font-bold">
        {name}
        <LearnLink
          className="text-fun-fg2 hover:text-fun-fg flex size-11 items-center justify-center rounded-full"
          href={hrefs.appearance}
        >
          <PencilIcon aria-hidden="true" className="size-4" />
          <span className="sr-only">{t("Rename {buddy}", { buddy: name })}</span>
        </LearnLink>
      </h1>

      <p className="text-fun-fg2 text-sm">
        <BuddyStageName stage={status.stage} />
        {" · "}
        {t("{belt}, level {level}", {
          belt: beltName(status.belt.color),
          level: String(status.belt.level),
        })}
      </p>

      {isNapping && (
        <p className="text-fun-fg2 max-w-xs text-sm">
          {t("{buddy} took a nap. Everything you learn helps it wake up.", { buddy: name })}
        </p>
      )}
    </section>
  );
}

/**
 * Buddies live in Fun: Focus learners get a way there instead of an empty page, and a Fun learner
 * who switched modes without picking one is sent to pick it.
 */
function NoBuddyNote({ hrefs }: { hrefs: BuddyScreenHrefs }) {
  const t = useExtracted();
  const mode = useExperienceMode();

  return (
    <div className="flex flex-col gap-3 pt-6">
      <h1 className="in-data-[mode=fun]:font-fun-display text-2xl font-semibold">
        {mode === "fun" ? t("Pick your buddy") : t("Buddies live in Fun mode")}
      </h1>
      <p className="text-muted-foreground in-data-[mode=fun]:text-fun-fg2">
        {mode === "fun"
          ? t("Pick a buddy in Appearance. You feed it by learning.")
          : t("Switch to Fun in Appearance to pick a buddy you feed by learning.")}
      </p>
      <LearnLink
        className="inline-flex min-h-11 items-center self-start text-sm font-semibold underline"
        href={hrefs.appearance}
      >
        {t("Open Appearance")}
      </LearnLink>
    </div>
  );
}

/**
 * The buddy's page in Fun: its Energy (awake, napping or glowing), how far it is from growing, what
 * it ate this week and the glasses it earned. Growth comes from the belt and glow from Energy, so
 * the buddy has no economy of its own, and it never suffers: at worst it naps.
 */
export function BuddyScreen({
  hrefs,
  onWearGlasses,
  status,
}: {
  hrefs: BuddyScreenHrefs;
  onWearGlasses: (glasses: BuddyGlasses) => Promise<boolean>;
  status: BuddyStatusView;
}) {
  const t = useExtracted();
  const mode = useExperienceMode();

  if (mode !== "fun" || !status.buddy) {
    return <NoBuddyNote hrefs={hrefs} />;
  }

  const buddy: LearnBuddy = {
    beltColor: status.belt.color,
    energy: status.energy.current,
    glasses: status.buddy.glasses,
    kind: status.buddy.kind,
    name: status.buddy.name,
    studiedToday: status.energy.studiedToday,
  };

  return (
    <div className="flex flex-col gap-5" data-slot="buddy-screen">
      <BuddyHero hrefs={hrefs} buddy={buddy} status={status} />
      <EnergyAndGrowth buddy={buddy} status={status} />
      <Diet buddy={buddy} status={status} />
      <BuddyGlassesShelf glasses={status.glasses} onWear={onWearGlasses} buddy={buddy} />

      <nav aria-label={t("More about your progress")} className="flex flex-col gap-2">
        <PageLink
          href={hrefs.logbook}
          icon={<BookOpenIcon aria-hidden="true" className="text-fun-accent-cyan size-5" />}
          label={t("This week's logbook")}
        />
        <PageLink
          href={hrefs.preparation}
          icon={<OrbitIcon aria-hidden="true" className="text-fun-accent-violet size-5" />}
          label={t("Preparation")}
        />
      </nav>
    </div>
  );
}
