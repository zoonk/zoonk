import { DayList } from "@/components/public/day-list";
import { NUMERIC_CLASS } from "@/components/public/landing-styles";
import { ProductWindow } from "@/components/public/product-window";
import { getMinutesFormatter } from "@/lib/public/public-labels";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted, getFormatter } from "next-intl/server";
import { LAST_DAY, REVIEW_DAYS, TODAY_DAY, dayShare, getForgettingCurve } from "./forgetting-curve";
import { getHeroExamples } from "./hero-examples";
import { addDays, getExampleCalendar, getExampleSet } from "./landing-examples";
import { Objection, ObjectionAnswer, ObjectionQuote, bold } from "./objection";

const TITLE_ID = "forget-title";

const PERCENT = 100;
const MORE_MISTAKES = 2;

function percent(day: number): string {
  return `${dayShare(day) * PERCENT}%`;
}

async function getMoveReview() {
  const t = await getExtracted();
  const set = await getExampleSet();

  return set.move === "mexico-city"
    ? { item: "Doblar", topic: t("Asking for directions") }
    : { item: "Look after", topic: t("Phrasal verbs for travel") };
}

async function CurvePlot() {
  const t = await getExtracted();
  const format = await getFormatter();
  const { today } = await getExampleCalendar();
  const curve = getForgettingCurve();

  const formatDay = (day: number) =>
    format.dateTime(addDays(today, day - TODAY_DAY), {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });

  const pastReviews = REVIEW_DAYS.filter((day) => day < TODAY_DAY);

  return (
    <>
      <div
        aria-label={t(
          "Illustration. Without reviews, you forget almost everything in a few days. With reviews on {dates} and today, it comes back each time, and the gaps between reviews grow.",
          {
            dates: format.list(
              pastReviews.map((day) => formatDay(day)),
              { type: "conjunction" },
            ),
          },
        )}
        className="relative mt-5 h-49 sm:h-57.5"
        role="img"
      >
        <svg
          aria-hidden="true"
          className="absolute inset-0 size-full overflow-visible fill-none [stroke-linecap:round] [stroke-linejoin:round]"
          preserveAspectRatio="none"
          viewBox="0 0 1000 1000"
        >
          <line
            className="stroke-input"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            x1={dayShare(TODAY_DAY) * 1000}
            x2={dayShare(TODAY_DAY) * 1000}
            y1={60}
            y2={1000}
          />
          <path
            className="stroke-faint opacity-75 [stroke-dasharray:5_6]"
            d={curve.unreviewed}
            strokeWidth={1.75}
            vectorEffect="non-scaling-stroke"
          />
          <path
            className="stroke-success"
            d={curve.reviewed}
            strokeWidth={2.25}
            vectorEffect="non-scaling-stroke"
          />
          <path
            className="stroke-success opacity-80 [stroke-dasharray:1_6]"
            d={curve.next}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {REVIEW_DAYS.map((day) => (
          <span
            className={cn(
              "absolute top-[6%] -translate-1/2 rounded-full",
              day < TODAY_DAY && "bg-success ring-card size-2.5 ring-3",
              day === TODAY_DAY &&
                "bg-card ring-success shadow-success/20 size-3.5 shadow-[0_0_0_7px] ring-2",
              day > TODAY_DAY && "bg-card ring-success/70 size-2.5 ring-2 ring-inset",
            )}
            key={day}
            style={{ left: percent(day) }}
          />
        ))}

        <span className="text-success-text absolute top-[30%] left-[60%] text-[0.78125rem] font-medium whitespace-nowrap">
          {t("With reviews")}
        </span>
        <span className="text-muted-foreground absolute top-[70%] left-[60%] text-[0.78125rem] whitespace-nowrap">
          {t("Without reviewing")}
        </span>
      </div>

      <div
        aria-hidden="true"
        className={cn(NUMERIC_CLASS, "text-muted-foreground relative mt-1.5 h-6.5 text-xs")}
      >
        <span className="absolute top-1.5 left-[2%]">{formatDay(0)}</span>
        <span
          className="text-foreground absolute top-1.5 -translate-x-1/2 font-medium"
          style={{ left: percent(TODAY_DAY) }}
        >
          {t({ description: "Marks today on a timeline; lowercase.", message: "today" })}
        </span>
        <span className="absolute top-1.5 right-[2%]">{formatDay(LAST_DAY)}</span>
      </div>
    </>
  );
}

export async function ForgetSection() {
  const t = await getExtracted();
  const minutesText = await getMinutesFormatter();
  const examples = await getHeroExamples();
  const review = await getMoveReview();
  const today = t({ description: "Marks today on a timeline; lowercase.", message: "today" });

  return (
    <Objection
      band
      className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center lg:gap-20"
      titleId={TITLE_ID}
    >
      <div className="lg:order-2">
        <ObjectionQuote id={TITLE_ID}>
          {t({
            description:
              "A learner's own worry, in their casual words, shown as a big quote. In Brazilian Portuguese: “Estudo e esqueço.”",
            message: "I study and forget.",
          })}
        </ObjectionQuote>
        <ObjectionAnswer>
          {t.rich(
            "<b>Zoonk brings back what you studied right before you'd forget it.</b> And every mistake comes back for you to practice until you get it right.",
            { b: bold },
          )}
        </ObjectionAnswer>
      </div>

      <figure className="min-w-0">
        <ProductWindow className="px-5 pt-5 pb-1.5 sm:px-6 sm:pt-6">
          <p className="text-[1.0625rem] font-semibold tracking-[-0.015em]">{review.topic}</p>
          <p className="text-muted-foreground mt-0.5 text-[0.84375rem]">
            {[t("Example"), examples.move.name].join(" · ")}
          </p>

          <CurvePlot />

          <DayList
            className="mt-1 border-t **:data-[slot=list-row-title]:text-[0.9375rem]"
            minutesText={minutesText}
            steps={[
              {
                detail: [review.topic, today].join(" · "),
                id: "review",
                kind: "review",
                minutes: 2,
                state: "ahead",
                title: t("Quick review"),
              },
              {
                detail: [
                  t({
                    description:
                      "{item} is a word or phrase in the language being learned. Use your language's quote marks.",
                    message: "“{item}” and {count, number} more",
                    values: { count: MORE_MISTAKES, item: review.item },
                  }),
                  today,
                ].join(" · "),
                id: "mistakes",
                kind: "mistakes",
                minutes: 4,
                state: "ahead",
                title: t("Practice your mistakes"),
              },
            ]}
          />
        </ProductWindow>

        <figcaption className="text-muted-foreground mt-3 text-[0.84375rem]">
          {t("An illustration of the forgetting curve. Review dates change with your answers.")}
        </figcaption>
      </figure>
    </Objection>
  );
}
