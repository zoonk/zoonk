"use client";

import { type ExamView } from "@zoonk/core/exams/view/contract";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { ChevronRightIcon, GaugeIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { SectionLabel } from "../_components/section-label";
import { useScoreRange } from "../_utils/use-score-range";
import { LearnLink } from "../learn-link";
import { useExamScreen } from "./exam-context";

type MockSummary = ExamView["mocks"][number];

function useMeasureText() {
  const t = useExtracted();

  return (mock: MockSummary): string => {
    // An IRT score is only ever an estimate shown as a range (above, for the latest mocks), so a
    // past mock shows what it certainly was: its right answers.
    if (mock.scoring === "net") {
      return t("Net {score} of {total}", {
        score: String(mock.measure),
        total: String(mock.total),
      });
    }

    return t("{correct} of {total} right", {
      correct: String(mock.correct),
      total: String(mock.total),
    });
  };
}

function MockRow({ mock }: { mock: MockSummary }) {
  const t = useExtracted();
  const format = useFormatter();
  const { hrefs } = useExamScreen();
  const measure = useMeasureText();

  const content = (
    <>
      <span className="flex min-w-0 flex-col">
        <span className="font-medium">
          {t("Mock exam {number}", { number: String(mock.number) })}
        </span>
        <span className="text-muted-foreground text-xs">
          {format.dateTime(new Date(mock.finishedAt), { day: "numeric", month: "short" })}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1 text-sm tabular-nums">
        {measure(mock)}
        {mock.blockId && <ChevronRightIcon aria-hidden="true" className="size-4" />}
      </span>
    </>
  );

  return (
    <li>
      {mock.blockId ? (
        <LearnLink
          className="hover:bg-muted focus-visible:ring-ring/50 in-data-[mode=fun]:hover:bg-fun-soft flex min-h-12 items-center justify-between gap-3 rounded-2xl px-3 py-2 outline-none focus-visible:ring-[3px]"
          href={hrefs.mock(mock.blockId)}
        >
          {content}
        </LearnLink>
      ) : (
        <div className="flex min-h-12 items-center justify-between gap-3 px-3 py-2">{content}</div>
      )}
    </li>
  );
}

/** The estimated score after a mock (a range, labeled Estimated) and the mocks so far. */
export function ExamMocksSection() {
  const t = useExtracted();
  const scoreRange = useScoreRange();
  const { exam } = useExamScreen();
  const { estimate, mocks } = exam;

  if (mocks.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {t("Your first mock exam gives you an estimated score. Your plan schedules them weekly.")}
      </p>
    );
  }

  return (
    <section aria-labelledby="exam-mocks-title" className="flex flex-col gap-3">
      <SectionLabel id="exam-mocks-title">{t("Mock exams")}</SectionLabel>

      {estimate && (
        <p className="bg-muted/60 in-data-[mode=fun]:fun-glass flex items-start gap-3 rounded-2xl p-4 text-sm">
          <LineMarker aria-hidden="true">
            <GaugeIcon className="text-muted-foreground size-5" />
          </LineMarker>
          {t("Estimated score: {range}", { range: scoreRange(estimate) })}
        </p>
      )}

      <ol className="flex flex-col">
        {mocks.map((mock) => (
          <MockRow key={mock.finishedAt} mock={mock} />
        ))}
      </ol>
    </section>
  );
}
