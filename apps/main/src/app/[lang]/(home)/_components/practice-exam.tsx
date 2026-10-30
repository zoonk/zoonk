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
  const set = await getExampleSet();
  const isEnem = set.exam === "enem";

  const notebook = t("It goes to your Mistakes notebook, and your plan brings it back.");

  const card = isEnem ? (
    <ExamQuestionCard
      context={t(
        "In a pasture, grass is eaten by grasshoppers, grasshoppers by frogs, and frogs by snakes.",
      )}
      explanation={[
        t("How much they eat isn't it: any animal turns only a small part of its food into body."),
        notebook,
      ].join(" ")}
      label={t("ENEM style · Natural Sciences")}
      options={[
        { result: "wrong", tag: t("Your answer"), text: t("Predators eat less than their prey") },
        {
          result: "right",
          tag: t("Correct"),
          text: t("Part of the energy is lost as heat in each organism's respiration"),
        },
        { text: t("Plants photosynthesize less at night") },
        { text: t("Decomposers use up the energy first") },
        { text: t("Energy turns into matter") },
      ]}
      question={t(
        "In a food chain, the available energy decreases at each trophic level. What is the main reason?",
      )}
    />
  ) : (
    <ExamQuestionCard
      explanation={[
        t(
          "Not quite. $12 of it is the monthly fee: only $3.40 pays for texts, and $3.40 ÷ $0.05 = 68.",
        ),
        notebook,
      ].join(" ")}
      label={t("SAT style · Math")}
      options={[
        { text: "58" },
        { result: "right", tag: t("Correct"), text: "68" },
        { text: "72" },
        { result: "wrong", tag: t("Your answer"), text: "308" },
      ]}
      question={t(
        "A phone plan costs $12 a month plus $0.05 per text. Ana paid $15.40 in March. How many texts did she send?",
      )}
    />
  );

  const topics = isEnem
    ? [
        { id: "ecology", name: t("Ecology"), right: 2, total: 4 },
        { id: "electricity", name: t("Electricity"), right: 3, total: 4 },
        { id: "waves", name: t("Waves"), right: 3, total: 3 },
        { id: "bonds", name: t("Chemical bonds"), right: 3, total: 3 },
      ]
    : [
        { id: "linear", name: t("Linear equations"), right: 3, total: 4 },
        { id: "percentages", name: t("Percentages"), right: 3, total: 4 },
        { id: "words", name: t("Words in context"), right: 3, total: 4 },
        {
          id: "transitions",
          name: t({
            description: "A writing lesson on linking words, such as “however” and “therefore”.",
            message: "Transitions",
          }),
          right: 3,
          total: 3,
        },
      ];

  const misses = topics.reduce((sum, topic) => sum + topic.total - topic.right, 0);

  return (
    <Pair aria-label={t("A question and a mock exam")}>
      {card}

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
          <p className="text-readout text-[2.75rem]">{isEnem ? "610–690" : "1180–1260"}</p>
          <p className="text-muted-foreground text-[0.8125rem]">
            {isEnem ? t("Estimated score · Natural Sciences") : t("Estimated score · SAT")}
          </p>
        </div>

        <div className="flex flex-col">
          <p className={cn(PAGE_SECTION_TITLE_CLASS, "pb-1")}>{t("By topic")}</p>
          <ul className="divided-rows flex flex-col">
            {topics.map((topic) => (
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
