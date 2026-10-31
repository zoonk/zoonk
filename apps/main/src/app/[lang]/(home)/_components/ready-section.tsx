import { NUMERIC_CLASS } from "@/components/public/landing-styles";
import { ProductWindow } from "@/components/public/product-window";
import { CHIP_CLASS } from "@zoonk/learn/chip";
import { KindMark } from "@zoonk/learn/kind-tile";
import { DoneMark } from "@zoonk/learn/status-mark";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted, getFormatter } from "next-intl/server";
import { getExampleSet } from "./landing-examples";
import { Objection, ObjectionAnswer, ObjectionQuote, bold } from "./objection";

const TITLE_ID = "ready-title";

function keepNumbersWithUnits(text: string): string {
  return text.replaceAll(/(?<=\d) /gu, "\u00A0");
}

/** A range like "10–12 Punkte" or "62–70点": its numbers big, its unit small. */
function splitScore(range: string): { number: string; unit: string } {
  const match = /^(?<number>.*[\d%])(?<unit>.*)$/u.exec(range);
  return { number: match?.groups?.number ?? range, unit: match?.groups?.unit ?? "" };
}

export async function ReadySection() {
  const t = await getExtracted();
  const format = await getFormatter();
  const { exam } = await getExampleSet();
  const { mock } = exam;
  const list = (topics: readonly string[]) => format.list(topics, { type: "conjunction" });

  return (
    <Objection band titleId={TITLE_ID}>
      <div className="flex flex-col items-center text-center" data-centered>
        <ObjectionQuote id={TITLE_ID}>
          {t({
            description:
              "A learner's own worry, in their casual words, shown as a big quote. In Brazilian Portuguese: “Será que já sei o suficiente?”",
            message: "Do I know enough yet?",
          })}
        </ObjectionQuote>
        <ObjectionAnswer>
          {t.rich(
            "<b>Take mock exams in the real exam's format and time.</b> At the end, you see an estimate of your score and what's still missing.",
            { b: bold },
          )}
        </ObjectionAnswer>
      </div>

      <ProductWindow className="mx-auto mt-11 w-full max-w-225 p-5.5 sm:px-9 sm:py-8">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <p className="text-[1.0625rem] font-semibold tracking-[-0.015em]">
              {t("Mock exam {number, number} · {name}", { name: mock.name, number: 2 })}
            </p>
            <p className="text-muted-foreground text-[0.84375rem]">
              {t("Example")}
              {mock.details && (
                <span className={NUMERIC_CLASS}>{` · ${keepNumbersWithUnits(mock.details)}`}</span>
              )}
            </p>
          </div>

          <span className={CHIP_CLASS}>
            <span aria-hidden="true">{t("Plus")}</span>
            <span className="sr-only">{t("Available with Plus")}</span>
          </span>
        </div>

        <div className="mt-6.5 grid gap-6 sm:grid-cols-2 sm:gap-8">
          {mock.scores.map((score) => {
            const { number, unit } = splitScore(score.range);

            return (
              <div className="flex min-w-0 flex-col" key={score.label}>
                <p className="text-muted-foreground text-sm">{score.label}</p>
                <p className="text-readout mt-1 text-[clamp(3.25rem,13vw,4.5rem)] sm:text-[clamp(3.25rem,6.2vw,5.25rem)]">
                  {number}
                  {unit && (
                    <span className="text-muted-foreground text-[max(0.3em,0.9375rem)] font-medium tracking-normal">
                      {unit}
                    </span>
                  )}
                </p>
                <p className="text-muted-foreground mt-2 text-[0.84375rem]">
                  {t({
                    description:
                      "Exams report a score, a grade or a band (13–15/20, 2–3등급): use the word that fits your country's exam.",
                    message: "Estimated score",
                  })}
                </p>
              </div>
            );
          })}
        </div>

        <ul className="mt-6.5 border-t text-[0.9375rem] [&_b]:font-semibold">
          <li className="flex min-h-12.5 items-center gap-3 border-b">
            <DoneMark />
            <span>{t.rich("<b>Solid:</b> {topics}", { b: bold, topics: list(mock.firm) })}</span>
          </li>
          <li className="flex min-h-12.5 items-center gap-3 border-b">
            <KindMark kind="review" />
            <span>
              {t.rich("<b>To review:</b> {topics}", { b: bold, topics: list(mock.review) })}
            </span>
          </li>
          <li className="flex min-h-12.5 items-center gap-3 border-b">
            <KindMark kind="mistakes" />
            <span>
              {t.rich({
                description:
                  "In Brazilian Portuguese: “<b>7 erros</b> foram para o seu caderno de erros”.",
                message:
                  "<b>{count, plural, one {# mistake} other {# mistakes}}</b> went to your mistakes notebook",
                values: { b: bold, count: mock.mistakes },
              })}
            </span>
          </li>
        </ul>

        <p className={cn("text-muted-foreground mt-3.5 text-[0.84375rem] leading-normal")}>
          {t(
            "The score is only an estimate, made from your answers. Mock exams are available with Plus.",
          )}
        </p>
      </ProductWindow>
    </Objection>
  );
}
