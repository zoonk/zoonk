import { NUMERIC_CLASS } from "@/components/public/landing-styles";
import { Pair } from "@/components/public/pair";
import { ProductWindow } from "@/components/public/product-window";
import { getMinutesFormatter } from "@/lib/public/public-labels";
import { PAGE_SECTION_TITLE_CLASS } from "@zoonk/learn/page";
import { DoneMark } from "@zoonk/learn/status-mark";
import { cn } from "@zoonk/ui/lib/utils";
import { LightbulbIcon, MicIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";
import { FRAME_EYEBROW_CLASS } from "./day-one-styles";
import { getExampleSet } from "./landing-examples";
import { CARD_CLASS } from "./practice-card-styles";

const RECORDING_BARS = [
  { height: 8, spoken: true },
  { height: 14, spoken: true },
  { height: 22, spoken: true },
  { height: 30, spoken: true },
  { height: 18, spoken: true },
  { height: 12, spoken: true },
  { height: 24, spoken: true },
  { height: 32, spoken: true },
  { height: 20, spoken: true },
  { height: 10, spoken: true },
  { height: 16, spoken: true },
  { height: 26, spoken: true },
  { height: 14, spoken: true },
  { height: 8, spoken: true },
  { height: 12, spoken: false },
  { height: 20, spoken: false },
  { height: 28, spoken: false },
  { height: 16, spoken: false },
  { height: 10, spoken: false },
  { height: 18, spoken: false },
  { height: 8, spoken: false },
];

const CALL_MINUTES = 4;

/** The sentence to say is in the language of the move, never in the page's own. */
const TARGET_SENTENCES = {
  london: {
    language: "en",
    next: "What do the bills include?",
    text: "Can I see the flat on Saturday?",
  },
  madrid: {
    language: "es",
    next: "¿Qué incluyen los gastos?",
    text: "¿Puedo ver el piso el sábado?",
  },
} as const;

function renderBold(chunks: ReactNode) {
  return <b className="font-semibold">{chunks}</b>;
}

function CallGoalMark({ done }: { done: boolean }) {
  if (done) {
    return <DoneMark />;
  }

  return (
    <span aria-hidden="true" className="flex size-4 shrink-0 items-center justify-center">
      <span className="ring-input size-3 rounded-full ring-[1.5px] ring-inset" />
    </span>
  );
}

export async function MovePractice() {
  const t = await getExtracted();
  const minutesText = await getMinutesFormatter();
  const set = await getExampleSet();
  const target = TARGET_SENTENCES[set.move];

  const goals = [
    { done: true, id: "rent", text: t("Ask about the rent") },
    { done: true, id: "visit", text: t("Book a visit") },
    { done: false, id: "bills", text: t("Ask what the bills include") },
  ];

  return (
    <Pair aria-label={t("Speaking practice and a practice call")}>
      <ProductWindow className={cn(CARD_CLASS, "gap-4")}>
        <p className={FRAME_EYEBROW_CLASS}>{t("Say it out loud")}</p>

        <div className="flex flex-col gap-1">
          <p
            className="text-xl leading-tight font-semibold tracking-[-0.02em] text-pretty"
            lang={target.language}
          >
            {target.text}
          </p>
          <p className="text-muted-foreground text-[0.84375rem]">
            {t("Can I see the apartment on Saturday?")}
          </p>
        </div>

        <div aria-hidden="true" className="flex items-center gap-3.5">
          <MicIcon className="text-muted-foreground size-4.5 shrink-0" />
          <span className="flex h-8 items-center gap-[3px] overflow-hidden">
            {RECORDING_BARS.map((bar, index) => (
              <i
                className={cn(
                  "block w-[3px] flex-none rounded-full",
                  bar.spoken ? "bg-foreground" : "bg-surface-3",
                )}
                // oxlint-disable-next-line react/no-array-index-key -- The bars never reorder.
                key={index}
                style={{ height: bar.height }}
              />
            ))}
          </span>
        </div>

        <p className="mt-auto flex gap-2 border-t pt-3.5 text-[0.84375rem] leading-snug">
          <LightbulbIcon aria-hidden="true" className="text-warning mt-px size-4 flex-none" />
          <span>
            {t.rich(
              "{move, select, london {Stress the first part: <b>SAT</b>-ur-day.} other {Stress the accent: <b>SÁ</b>-ba-do.}}",
              { b: renderBold, move: set.move },
            )}
          </span>
        </p>
      </ProductWindow>

      <ProductWindow className={cn(CARD_CLASS, "gap-4")}>
        <div className="flex flex-col gap-1">
          <p className={FRAME_EYEBROW_CLASS}>{t("Practice call")}</p>
          <p className="flex items-baseline justify-between gap-3">
            <span className="text-lg font-semibold tracking-[-0.02em]">{t("Renting a flat")}</span>
            <span className={cn(NUMERIC_CLASS, "text-muted-foreground text-xs")}>
              {minutesText(CALL_MINUTES)}
            </span>
          </p>
        </div>

        <div className="flex flex-col">
          <p className={cn(PAGE_SECTION_TITLE_CLASS, "pb-1")}>{t("Goals of the call")}</p>
          <ul className="divided-rows flex flex-col">
            {goals.map((goal) => (
              <li
                className={cn(
                  "flex items-center gap-2.5 py-2 text-[0.84375rem]",
                  !goal.done && "text-muted-foreground",
                )}
                key={goal.id}
              >
                <CallGoalMark done={goal.done} />
                <span className="min-w-0">{goal.text}</span>
                <span className="sr-only">{goal.done ? t("Done") : t("Not yet")}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-auto flex flex-col gap-1 text-[0.84375rem]">
          <p className={NUMERIC_CLASS}>
            {t("{done, number} of {total, number} goals", { done: 2, total: 3 })}
          </p>
          <p className="text-muted-foreground">
            {t("Next time:")} <q lang={target.language}>{target.next}</q>
          </p>
        </div>
      </ProductWindow>
    </Pair>
  );
}
