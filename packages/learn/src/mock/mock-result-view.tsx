"use client";

import { type MockResult } from "@zoonk/core/exams/mocks/contract";
import { ProgressIndicator, ProgressRoot, ProgressTrack } from "@zoonk/ui/components/progress";
import { cn } from "@zoonk/ui/lib/utils";
import { CalendarCheckIcon, TrendingUpIcon } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { useFormatShare } from "../_utils/percent";
import { useFormatDuration } from "../_utils/time-format";
import { LearnLink } from "../learn-link";
import { TaskMainLink } from "../shell/task-frame";
import { useMockScreen } from "./mock-context";
import { MockFrame } from "./mock-frame";
import { useMockTitle } from "./mock-labels";
import { MockResultInsights } from "./mock-result-insights";
import { MockReview } from "./mock-review";

const NUMBER_CLASS = "in-data-[mode=fun]:font-fun-display font-semibold tabular-nums";

const CARD_CLASS =
  "border-border in-data-[mode=fun]:fun-glass rounded-3xl border p-5 in-data-[mode=fun]:border-transparent";

function Delta({ current, previous }: { current: number; previous: number | null }) {
  const t = useExtracted();

  if (previous === null || current === previous) {
    return null;
  }

  const change = current - previous;

  return (
    <p className={cn("flex items-center gap-1 text-sm", change > 0 && "text-success")}>
      {change > 0 && <TrendingUpIcon aria-hidden="true" className="size-4" />}
      {change > 0
        ? t("+{change} since the last one", { change: String(change) })
        : t("{change} since the last one", { change: String(change) })}
    </p>
  );
}

/** ENEM: the estimated score by item response theory, its range and each area's score. */
function IrtScore({ result }: { result: MockResult }) {
  const t = useExtracted();
  const irt = result.irt;

  if (!irt) {
    return null;
  }

  // One mock can't pin a score down, so it shows as the range it likely falls in, never one number.
  return (
    <section className={cn(CARD_CLASS, "flex flex-col gap-4")}>
      <div className="flex flex-col gap-1">
        <p className={cn(NUMBER_CLASS, "text-5xl")}>
          {t("{low}–{high}", { high: String(irt.high), low: String(irt.low) })}
        </p>
        <p className="text-muted-foreground text-sm">{t("Estimated")}</p>
        <Delta current={irt.score} previous={result.previous} />
      </div>
      {/* One area is the whole mock: its score would repeat the one above. */}
      {result.areas.length > 1 && (
        <ul className="grid grid-cols-2 gap-2">
          {result.areas.map((area) => (
            <li
              className="bg-muted/60 in-data-[mode=fun]:bg-fun-soft flex flex-col gap-0.5 rounded-2xl px-3 py-2"
              key={area.name}
            >
              <p className="text-muted-foreground text-xs leading-snug">{area.name}</p>
              <p className={cn(NUMBER_CLASS, "mt-auto text-xl")}>
                {area.score
                  ? t("{low}–{high}", {
                      high: String(area.score.high),
                      low: String(area.score.low),
                    })
                  : "–"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Cebraspe: the net score, right answers minus wrong ones, with blanks counted apart. */
function NetScore({ result }: { result: MockResult }) {
  const t = useExtracted();
  const net = result.net;

  if (!net) {
    return null;
  }

  return (
    <section className={cn(CARD_CLASS, "flex flex-col gap-2")}>
      <p className={cn(NUMBER_CLASS, "text-5xl")}>{net.net}</p>
      <p className="text-muted-foreground text-sm">
        {t(
          "Net score out of {max}: {right, plural, =0 {# right} one {# right} other {# right}}, {wrong, plural, =0 {# wrong} one {# wrong} other {# wrong}}, {blank} blank",
          { blank: String(net.blank), max: String(net.max), right: net.right, wrong: net.wrong },
        )}
      </p>
      <Delta current={net.net} previous={result.previous} />
    </section>
  );
}

function RawScore({ result }: { result: MockResult }) {
  const t = useExtracted();

  if (result.irt || result.net) {
    return null;
  }

  return (
    <section className={cn(CARD_CLASS, "flex flex-col gap-2")}>
      <p className={cn(NUMBER_CLASS, "text-5xl")}>
        {t("{correct} of {total}", {
          correct: String(result.correct),
          total: String(result.total),
        })}
      </p>
      <p className="text-muted-foreground text-sm">{t("Right answers")}</p>
    </section>
  );
}

const PERCENT = 100;

function PreparationChange({ result }: { result: MockResult }) {
  const t = useExtracted();
  const locale = useLocale();
  const formatShare = useFormatShare();
  const { runner } = useMockScreen();
  const change = result.preparation;

  if (!change) {
    return null;
  }

  return (
    <section className={cn(CARD_CLASS, "flex flex-col gap-3")}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-medium">
          {runner.view.examName
            ? t("{exam} preparation", { exam: runner.view.examName })
            : t("Preparation")}
        </p>
        <p className="tabular-nums">
          {t("{before} → {after}", {
            after: formatShare(change.after),
            before: formatShare(change.before),
          })}
        </p>
      </div>
      <ProgressRoot locale={locale} aria-label={t("Preparation")} value={change.after * PERCENT}>
        <ProgressTrack className="h-2">
          <ProgressIndicator className="in-data-[mode=fun]:bg-fun-accent-lime" />
        </ProgressTrack>
      </ProgressRoot>
    </section>
  );
}

function ResultFooter() {
  const t = useExtracted();
  const { hrefs, runner } = useMockScreen();
  const mistakes = runner.view.review.filter((entry) => entry.outcome === "wrong").length;

  return (
    <>
      {mistakes > 0 ? (
        <TaskMainLink href={hrefs.mistakes}>
          {t("{count, plural, one {Review the mistake} other {Review the # mistakes}}", {
            count: mistakes,
          })}
        </TaskMainLink>
      ) : (
        <TaskMainLink href={hrefs.continue}>{t("Continue")}</TaskMainLink>
      )}
      {mistakes > 0 && (
        <LearnLink
          className="text-muted-foreground py-3 text-center text-sm underline-offset-4 hover:underline"
          href={hrefs.continue}
        >
          {t("Continue today's session")}
        </LearnLink>
      )}
      <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-xs">
        <CalendarCheckIcon aria-hidden="true" className="size-3.5" />
        {t("It's all in your plan already.")}
      </p>
    </>
  );
}

/**
 * The result teaches: the score in the exam's own terms (estimated, as a range, where it's an
 * estimate), how preparation moved, then timing, consistency or calibration and the mistakes.
 */
export function MockResultView() {
  const t = useExtracted();
  const { ask, runner } = useMockScreen();
  const { result } = runner.view;
  const title = useMockTitle();
  const duration = useFormatDuration();

  if (!result) {
    return null;
  }

  return (
    <MockFrame footer={<ResultFooter />} headerEnd={ask}>
      <div className="flex flex-col gap-1 pt-4">
        <h1 className="in-data-[mode=fun]:font-fun-display text-3xl font-bold tracking-tight">
          {title(runner.view)}
        </h1>
        <p className="text-muted-foreground">
          {t("{count, plural, one {# question} other {# questions}} · {time}", {
            count: result.total,
            time: duration(Math.max(1, Math.round(result.minutesUsed))),
          })}
        </p>
      </div>

      <IrtScore result={result} />
      <NetScore result={result} />
      <RawScore result={result} />
      <PreparationChange result={result} />
      <MockResultInsights />
      <MockReview />
    </MockFrame>
  );
}
