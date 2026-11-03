import { NUMERIC_CLASS } from "@/components/public/landing-styles";
import { CHIP_CLASS } from "@zoonk/learn/chip";
import { KindMark } from "@zoonk/learn/kind-tile";
import { DoneMark } from "@zoonk/learn/status-mark";
import { getExtracted, getFormatter } from "next-intl/server";
import { ExampleCard, ExampleCardHead } from "./example-card";
import { GoalSection } from "./goal-section";
import { getExampleSet } from "./landing-examples";

const TITLE_ID = "exams-title";

function bold(chunks: React.ReactNode) {
  return <b className="font-semibold">{chunks}</b>;
}

function keepNumbersWithUnits(text: string): string {
  return text.replaceAll(/(?<=\d) /gu, " ");
}

/** A range like "10–12 Punkte" or "62–70点": its numbers big, its unit small. */
function splitScore(range: string): { number: string; unit: string } {
  const match = /^(?<number>.*[\d%])(?<unit>.*)$/u.exec(range);
  return { number: match?.groups?.number ?? range, unit: match?.groups?.unit ?? "" };
}

async function MockResult() {
  const t = await getExtracted();
  const format = await getFormatter();
  const { exam } = await getExampleSet();
  const { mock } = exam;
  const list = (topics: readonly string[]) => format.list(topics, { type: "conjunction" });

  return (
    <ExampleCard>
      <ExampleCardHead
        aside={
          <span className={CHIP_CLASS}>
            <span aria-hidden="true">{t("Plus")}</span>
            <span className="sr-only">{t("Available with Plus")}</span>
          </span>
        }
        detail={
          mock.details && (
            <span className={NUMERIC_CLASS}>{keepNumbersWithUnits(mock.details)}</span>
          )
        }
        title={t("Mock exam {number, number} · {name}", { name: mock.name, number: 2 })}
      />

      <div className="@container mt-6 flex flex-wrap items-end gap-x-8 gap-y-6">
        {mock.scores.map((score) => {
          const { number, unit } = splitScore(score.range);

          return (
            <div className="flex min-w-0 flex-col" key={score.label}>
              <p className="text-muted-foreground text-[0.8125rem]">{score.label}</p>
              <p className="text-readout mt-1.5 text-[clamp(1.75rem,10.5cqi,3.75rem)] whitespace-nowrap">
                {number}
                {unit && (
                  <span className="text-muted-foreground text-[max(0.3em,0.9375rem)] font-medium tracking-normal">
                    {unit}
                  </span>
                )}
              </p>
              <p className="text-muted-foreground mt-2 text-xs">
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

      <ul className="divided-rows mt-6 border-t text-[0.9375rem] leading-snug">
        <li className="flex min-h-12 items-center gap-3 py-2.5">
          <DoneMark />
          <span>{t.rich("<b>Solid:</b> {topics}", { b: bold, topics: list(mock.firm) })}</span>
        </li>
        <li className="flex min-h-12 items-center gap-3 py-2.5">
          <KindMark className="size-4" kind="review" />
          <span>
            {t.rich("<b>To review:</b> {topics}", { b: bold, topics: list(mock.review) })}
          </span>
        </li>
        <li className="flex min-h-12 items-center gap-3 py-2.5">
          <KindMark className="size-4" kind="mistakes" />
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

      <p className="text-muted-foreground mt-3 text-[0.8125rem] leading-normal text-pretty">
        {t(
          "The score is only an estimate, made from your answers. Mock exams are available with Plus.",
        )}
      </p>
    </ExampleCard>
  );
}

export async function ExamSection() {
  const t = await getExtracted();
  const { exams } = await getExampleSet();

  return (
    <GoalSection
      label={t({
        description:
          "A section label for goals like school-leaving, entrance and civil service exams. In Brazilian Portuguese: “Provas e concursos”.",
        message: "Tests and exams",
      })}
      lead={t({
        description:
          "{exams} lists the exams people in your country study for, such as “Enem, vestibular, concurso ou OAB”, and opens the sentence. In Brazilian Portuguese: “{exams}: o plano segue as matérias e os tópicos da sua prova. Na reta final, simulados no formato e no tempo da prova real mostram uma estimativa da sua pontuação e o que ainda falta.”",
        message:
          "{exams}: your plan follows your exam's subjects and topics. In the final stretch, mock exams in the real exam's format and time show an estimate of your score and what's still missing.",
        values: { exams },
      })}
      subject="exams"
      title={t({
        description: "In Brazilian Portuguese: “Tudo o que cai, dividido até o dia da prova.”",
        message: "Everything on the exam, split up until exam day.",
      })}
      titleId={TITLE_ID}
    >
      <MockResult />
    </GoalSection>
  );
}
