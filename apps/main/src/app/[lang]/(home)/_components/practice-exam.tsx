import { AnswerPicture, AnswerPictures } from "@/components/public/answer-picture";
import { NUMERIC_CLASS } from "@/components/public/landing-styles";
import { Pair } from "@/components/public/pair";
import { ProductWindow } from "@/components/public/product-window";
import { type AnswerOptionResult } from "@zoonk/learn/answer-tone";
import { CHIP_CLASS } from "@zoonk/learn/chip";
import { KindMark } from "@zoonk/learn/kind-tile";
import { PAGE_SECTION_TITLE_CLASS } from "@zoonk/learn/page";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";
import { FRAME_EYEBROW_CLASS } from "./day-one-styles";
import { getExampleSet } from "./landing-examples";
import { CARD_CLASS } from "./practice-card-styles";

type ExamOption = { result?: AnswerOptionResult; tag?: string; text: string };

function ExamQuestionCard({
  context,
  explanation,
  label,
  options,
  question,
}: {
  context?: string;
  explanation: string;
  label: string;
  options: ExamOption[];
  question: string;
}) {
  return (
    <ProductWindow className={cn(CARD_CLASS, "gap-3")}>
      <p className={FRAME_EYEBROW_CLASS}>{label}</p>

      {context && (
        <p className="text-muted-foreground border-l-2 pl-3 text-sm leading-relaxed text-pretty">
          {context}
        </p>
      )}

      <p className="text-base leading-snug font-[560] tracking-[-0.01em] text-pretty">{question}</p>

      <AnswerPictures>
        {options.map((option, index) => (
          <AnswerPicture
            key={option.text}
            marker={index + 1}
            result={option.result}
            tag={option.tag}
          >
            {option.text}
          </AnswerPicture>
        ))}
      </AnswerPictures>

      <p className="text-sm leading-relaxed text-pretty">{explanation}</p>
    </ProductWindow>
  );
}

export async function ExamPractice() {
  const t = await getExtracted();
  const { exam } = await getExampleSet();
  const { mock, practice } = exam;
  const tags = { right: t("Correct"), wrong: t("Your answer") };

  const misses = mock.topics.reduce((sum, topic) => sum + topic.total - topic.right, 0);

  return (
    <Pair aria-label={t("A question and a mock exam")}>
      <ExamQuestionCard
        context={practice.context}
        explanation={t({
          description:
            "{explanation} says why the learner's answer was wrong. Follow it the way your language joins two sentences.",
          message: "{explanation} It goes to your Mistakes notebook, and your plan brings it back.",
          values: { explanation: practice.explanation },
        })}
        label={t({
          description:
            "{exam} is a national exam's short name (SAT, bac, 수능); {subject} is a subject.",
          message: "{exam} style · {subject}",
          values: { exam: exam.name, subject: practice.subject.name },
        })}
        options={practice.options.map((option) => ({
          ...option,
          tag: option.result && tags[option.result],
        }))}
        question={practice.question}
      />

      <ProductWindow className={cn(CARD_CLASS, "gap-4")}>
        <p className="flex items-center justify-between gap-3">
          <span className="text-[0.84375rem] font-medium">
            {t("Mock exam {number, number} finished", { number: 2 })}
          </span>
          <span className={CHIP_CLASS}>
            <span aria-hidden="true">{t("Plus")}</span>
            <span className="sr-only">{t("Available with Plus")}</span>
          </span>
        </p>

        <div className="flex flex-col gap-2">
          <p className="text-readout text-[2.75rem]">{mock.score}</p>
          <p className="text-muted-foreground text-[0.8125rem]">
            {t({
              description:
                "{part} is the exam (SAT) or the part of it (Mathematics) the result is for. Exams report a score, a grade or a band (13–15/20, 2–3등급): use a word that fits each.",
              message: "Estimated score · {part}",
              values: { part: mock.scoreOf },
            })}
          </p>
        </div>

        <div className="flex flex-col">
          <p className={cn(PAGE_SECTION_TITLE_CLASS, "pb-1")}>{t("By topic")}</p>
          <ul className="divided-rows flex flex-col">
            {mock.topics.map((topic) => (
              <li
                className="flex items-center justify-between gap-3 py-2 text-[0.84375rem]"
                key={topic.id}
              >
                <span className="min-w-0">{topic.name}</span>
                <span className={cn(NUMERIC_CLASS, "text-muted-foreground text-xs")}>
                  {t("{right, number} of {total, number}", topic)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-auto flex flex-col gap-1.5">
          <p className={PAGE_SECTION_TITLE_CLASS}>{t("Now")}</p>
          <p className="flex items-center gap-2.5 text-[0.84375rem]">
            <KindMark kind="mistakes" />
            {t("{count, plural, one {# mistake to review} other {# mistakes to review}}", {
              count: misses,
            })}
          </p>
        </div>
      </ProductWindow>
    </Pair>
  );
}
