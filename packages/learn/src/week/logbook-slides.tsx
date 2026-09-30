"use client";

import { Buddy } from "@zoonk/ui/components/buddy";
import { cn } from "@zoonk/ui/lib/utils";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { CalendarCheckIcon, CheckIcon, SearchCheckIcon, TargetIcon, TimerIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { useFormatShare } from "../_utils/percent";
import { useFormatDuration } from "../_utils/time-format";
import { BuddySpeech } from "../buddies/buddy-lines";
import { useBuddyName } from "../buddies/use-buddy-name";
import { useLogbook } from "./logbook-context";
import { TurnaroundChart } from "./turnaround-chart";

const DAYS_PER_WEEK = 7;

const EYEBROW_CLASS =
  "text-muted-foreground in-data-[mode=fun]:text-fun-accent-lime text-xs font-semibold tracking-[0.18em] uppercase";

const CARD_CLASS =
  "border-border in-data-[mode=fun]:fun-glass flex flex-col gap-1 rounded-3xl border p-4";

const BIG_NUMBER_CLASS = "in-data-[mode=fun]:font-fun-display text-4xl font-bold tabular-nums";

const ENDS_SENTENCE = /[.!?…]$/u;

function WeekDots() {
  const format = useFormatter();
  const { recap } = useLogbook();
  const studied = new Set(recap.week.daysStudied.map((day) => day.getTime()));

  return (
    <ol aria-hidden="true" className="flex gap-1.5">
      {Array.from({ length: DAYS_PER_WEEK }, (_, index) => {
        const day = new Date(recap.weekStart.getTime() + index * MS_PER_DAY);
        const isStudied = studied.has(day.getTime());

        return (
          <li
            className={cn(
              "flex size-7 items-center justify-center rounded-full text-xs font-semibold",
              isStudied
                ? "bg-foreground text-background in-data-[mode=fun]:bg-fun-lime in-data-[mode=fun]:text-fun-lime-foreground"
                : "text-muted-foreground border-border border",
            )}
            key={day.toISOString()}
          >
            {format.dateTime(day, { timeZone: "UTC", weekday: "narrow" })}
          </li>
        );
      })}
    </ol>
  );
}

/** "40 min more than last week!": only good news is compared; a quieter week just starts over. */
function useGainLine(): string | null {
  const t = useExtracted();
  const { recap } = useLogbook();
  const { minutes, questions } = recap.comparison;

  if (minutes > 0) {
    return t("{minutes} min more than last week!", { minutes: String(minutes) });
  }

  if (questions > 0) {
    return t(
      "{questions, plural, one {# more question than last week!} other {# more questions than last week!}}",
      { questions },
    );
  }

  return null;
}

function useWeekTitle(): string {
  const t = useExtracted();
  const { learnerName, recap } = useLogbook();

  if (recap.week.daysStudied.length === 0) {
    return t("A quiet week");
  }

  return learnerName ? t("What a week, {name}!", { name: learnerName }) : t("What a week!");
}

export function WeekSlide() {
  const t = useExtracted();
  const format = useFormatter();
  const { recap } = useLogbook();
  const title = useWeekTitle();
  const formatDuration = useFormatDuration();
  const studyTime = formatDuration(recap.week.minutes);
  const gain = useGainLine();
  const finished = recap.phasesFinished[0];
  const days = recap.week.daysStudied.length;

  return (
    <section aria-labelledby="logbook-week" className="flex flex-col gap-4">
      {finished && (
        <p className={EYEBROW_CLASS}>
          {t("Phase {phase} · {name} done", {
            name: finished.name,
            phase: String(finished.phase + 1),
          })}
        </p>
      )}
      <h2
        className="in-data-[mode=fun]:font-fun-display text-3xl font-bold text-balance"
        id="logbook-week"
      >
        {title}
      </h2>

      {days === 0 ? (
        <p className="text-muted-foreground">
          {t("Monday starts fresh, and your plan already made room.")}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {/* The days get the full row, so time and questions pair up under them. */}
          <div className={cn(CARD_CLASS, "sm:col-span-2")}>
            <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <CalendarCheckIcon aria-hidden="true" className="size-4" />
              {t("You studied")}
            </span>
            <span className={BIG_NUMBER_CLASS}>
              {t("{count, plural, one {# day} other {# days}}", { count: days })}
            </span>
            <WeekDots />
          </div>

          <div className={CARD_CLASS}>
            <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <TimerIcon aria-hidden="true" className="size-4" />
              {t("Study time")}
            </span>
            <span className={BIG_NUMBER_CLASS}>{studyTime}</span>
            <span className="text-muted-foreground text-sm">
              {t("{minutes} min a day on average", { minutes: String(recap.week.averageMinutes) })}
            </span>
          </div>

          <div className={CARD_CLASS}>
            <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <TargetIcon aria-hidden="true" className="size-4" />
              {t("Questions")}
            </span>
            <span className={BIG_NUMBER_CLASS}>{format.number(recap.week.questions)}</span>
            <span className="text-muted-foreground text-sm">{t("answered this week")}</span>
          </div>
        </div>
      )}

      {gain && <p className="font-semibold">{gain}</p>}
    </section>
  );
}

function useReason(): string | null {
  const t = useExtracted();
  const formatShare = useFormatShare();
  const { recap } = useLogbook();
  const turnaround = recap.turnaround;

  if (!turnaround) {
    return null;
  }

  if (turnaround.reason === "gold") {
    return t("The {skill} card turned gold: you remembered it on {count} different days.", {
      count: String(turnaround.rememberedOn.length),
      skill: turnaround.name,
    });
  }

  if (turnaround.reason === "solid") {
    return t("{skill} is Solid now: you kept getting it right on later days.", {
      skill: turnaround.name,
    });
  }

  return t("Practice paid off: from {from} to {to} right on {skill}.", {
    from: formatShare(turnaround.from),
    skill: turnaround.name,
    to: formatShare(turnaround.to),
  });
}

export function TurnaroundSlide() {
  const t = useExtracted();
  const format = useFormatter();
  const formatShare = useFormatShare();
  const { recap } = useLogbook();
  const reason = useReason();
  const turnaround = recap.turnaround;

  if (!turnaround) {
    return null;
  }

  return (
    <section aria-labelledby="logbook-turnaround" className="flex flex-col gap-4">
      <p className={EYEBROW_CLASS}>{t("The biggest turnaround")}</p>
      <h2
        className="in-data-[mode=fun]:font-fun-display text-2xl font-bold"
        id="logbook-turnaround"
      >
        {turnaround.name}
      </h2>
      <p className="in-data-[mode=fun]:font-fun-display in-data-[mode=fun]:fun-holo-text text-4xl font-bold tabular-nums">
        {t("{from} → {to}", { from: formatShare(turnaround.from), to: formatShare(turnaround.to) })}
      </p>
      <p className="text-muted-foreground text-sm">{t("right answers, in one week")}</p>

      <TurnaroundChart turnaround={turnaround} />

      {reason && (
        <div className={CARD_CLASS}>
          <p>{reason}</p>
          {turnaround.rememberedOn.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {turnaround.rememberedOn.map((day) => (
                <li
                  className="bg-muted flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                  key={day.toISOString()}
                >
                  <CheckIcon aria-hidden="true" className="size-3" />
                  {format.dateTime(day, { timeZone: "UTC", weekday: "short" })}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

export function FoodAndBadgesSlide() {
  const t = useExtracted();
  const format = useFormatter();
  const { buddy, recap } = useLogbook();
  const buddyName = useBuddyName(buddy ?? { kind: "zu", name: null });
  const badges = recap.badges.length;

  const foods = [
    { key: "newIdeas", label: t("new ideas"), value: recap.buddyAte.newIdeas },
    { key: "reviews", label: t("reviews"), value: recap.buddyAte.reviews },
    { key: "fixes", label: t("fixes"), value: recap.buddyAte.fixes },
  ];

  return (
    <section aria-labelledby="logbook-food" className="flex flex-col gap-4">
      <h2 className="in-data-[mode=fun]:font-fun-display text-2xl font-bold" id="logbook-food">
        {buddy ? t("What {buddy} ate", { buddy: buddyName }) : t("What you learned")}
      </h2>
      <dl className="grid grid-cols-3 gap-2">
        {foods.map((food) => (
          <div className={cn(CARD_CLASS, "flex-col-reverse justify-end px-3")} key={food.key}>
            {/* Three across on a phone: a long word ("Wiederholungen") breaks instead of overflowing. */}
            <dt className="text-muted-foreground text-xs wrap-break-word hyphens-auto">
              {food.label}
            </dt>
            <dd className="in-data-[mode=fun]:font-fun-display text-2xl font-bold tabular-nums">
              {format.number(food.value)}
            </dd>
          </div>
        ))}
      </dl>

      {badges > 0 && (
        <div className={cn(CARD_CLASS, "flex-row items-center gap-3")}>
          <SearchCheckIcon
            aria-hidden="true"
            className="in-data-[mode=fun]:text-fun-accent-cyan size-6 shrink-0"
          />
          <p className="font-medium">
            {t(
              "{count, plural, one {A Trap hunter badge} other {# Trap hunter badges}} this week",
              { count: badges },
            )}
          </p>
        </div>
      )}
    </section>
  );
}

/** "Next week: Linear functions. Shall we?", without a second period after a question title. */
function useNextWeekLine(): string {
  const t = useExtracted();
  const { recap } = useLogbook();
  const focus = recap.nextFocus?.title;

  if (!focus) {
    return t("Ready for next week?");
  }

  if (ENDS_SENTENCE.test(focus)) {
    return t("Next week: {focus} Shall we?", { focus });
  }

  return t("Next week: {focus}. Shall we?", { focus });
}

export function NextWeekSlide() {
  const t = useExtracted();
  const { buddy } = useLogbook();
  const line = useNextWeekLine();

  return (
    <section aria-label={t("Next week")} className="flex items-end gap-3">
      {buddy && (
        <Buddy
          beltColor={buddy.beltColor}
          className="size-20 shrink-0"
          energy={buddy.energy}
          expression="happy"
          glasses={buddy.glasses}
          kind={buddy.kind}
        />
      )}
      <BuddySpeech className="border-border in-data-[mode=fun]:fun-glass rounded-2xl rounded-bl-md border px-4 py-3 font-medium">
        {line}
      </BuddySpeech>
    </section>
  );
}
