import { AnswerPicture, AnswerPictures } from "@/components/public/answer-picture";
import { Variant } from "@/components/public/variant-switch";
import { getExtracted, getFormatter } from "next-intl/server";
import { FRAME_EYEBROW_CLASS } from "./day-one-styles";
import { EXAMPLE_GOALS, type ExampleGoal, GOAL_SWITCH, getExampleSet } from "./landing-examples";

const PRICE_SHARES = [{ share: 0.96 }, { share: 1 }, { share: 1.04 }, { share: 0.8 }];

type PlacementQuestion = { label: string; lang?: string; options: string[]; question: string };

async function getPlacementQuestions(): Promise<Record<ExampleGoal, PlacementQuestion>> {
  const t = await getExtracted();
  const format = await getFormatter();
  const set = await getExampleSet();

  const percent = {
    options: PRICE_SHARES.map(({ share }) => format.number(share, { style: "percent" })),
    question: t(
      "A price goes up 20%, then down 20%. What percent of the original price is it now?",
    ),
  };

  return {
    exam: {
      ...percent,
      label: t("Question {number, number} · {subject}", {
        number: 3,
        subject: set.exam.placed.subject.name,
      }),
    },
    job: {
      label: t("Question {number, number} · {subject}", { number: 3, subject: t("Spreadsheets") }),
      options: [...set.job.formulas],
      question: t("Which formula adds up the values in B2 through B9?"),
    },
    move:
      set.move === "mexico-city"
        ? {
            label: t("Question {number, number} · {subject}", { number: 3, subject: t("Spanish") }),
            lang: "es",
            options: [
              "Me gustaría un café, por favor.",
              "Me gusta un café, por favor.",
              "Tengo un café, por favor.",
            ],
            question: t("Which one means “I'd like a coffee, please”?"),
          }
        : {
            label: t("Question {number, number} · {subject}", { number: 3, subject: t("English") }),
            lang: "en",
            options: [
              "I'd like a coffee, please.",
              "I like a coffee, please.",
              "I have a coffee, please.",
            ],
            question: t("Which sentence asks for a coffee politely?"),
          },
  };
}

function PlacementPicture({ question }: { question: PlacementQuestion }) {
  return (
    <>
      <p className={FRAME_EYEBROW_CLASS}>{question.label}</p>
      <p className="text-[0.9375rem] leading-snug font-[560] text-pretty">{question.question}</p>

      <AnswerPictures>
        {question.options.map((option, index) => (
          <AnswerPicture key={option} lang={question.lang} marker={index + 1} picked={index === 0}>
            {option}
          </AnswerPicture>
        ))}
      </AnswerPictures>
    </>
  );
}

export async function PlacementQuestions() {
  const questions = await getPlacementQuestions();

  return EXAMPLE_GOALS.map((goal) => (
    <Variant className="flex flex-col gap-3" key={goal} name={GOAL_SWITCH} value={goal}>
      <PlacementPicture question={questions[goal]} />
    </Variant>
  ));
}
