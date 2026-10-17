import { AnswerPicture, AnswerPictures } from "@/components/public/answer-picture";
import { Variant } from "@/components/public/variant-switch";
import { ANSWER_LETTERS } from "@zoonk/learn/answer-tone";
import { getExtracted } from "next-intl/server";
import { FRAME_EYEBROW_CLASS } from "./day-one-styles";
import { EXAMPLE_GOALS, type ExampleGoal, GOAL_SWITCH, getExampleSet } from "./landing-examples";

type PlacementQuestion = {
  label: string;
  /** The answers' language when they're in the language being learned. */
  lang?: string;
  options: string[];
  question: string;
};

/** Each example goal's third placement question, as the visitor would see it, answered. */
async function getPlacementQuestions(): Promise<Record<ExampleGoal, PlacementQuestion>> {
  const t = await getExtracted();
  const set = await getExampleSet();

  const percent = {
    options: ["96%", "100%", "104%", "80%"],
    question: t(
      "A price goes up 20%, then down 20%. What percent of the original price is it now?",
    ),
  };

  return {
    exam: {
      ...percent,
      label: t("Question {number, number} of {total, number} · {subject}", {
        number: 3,
        subject: set.exam === "enem" ? t("Mathematics") : t("Math"),
        total: 8,
      }),
    },
    job: {
      label: t("Question {number, number} of {total, number} · {subject}", {
        number: 3,
        subject: t("Spreadsheets"),
        total: 8,
      }),
      // A spreadsheet's functions are named in its language: Brazil's say SOMA and split with ";".
      options:
        set.market === "brazil"
          ? ["=SOMA(B2:B9)", "=SOMAR(B2:B9)", "=SOMA(B2;B9)"]
          : ["=SUM(B2:B9)", "=ADD(B2:B9)", "=SUM(B2,B9)"],
      question: t("Which formula adds up the values in B2 through B9?"),
    },
    move:
      set.move === "madrid"
        ? {
            label: t("Question {number, number} of {total, number} · {subject}", {
              number: 3,
              subject: t("Spanish"),
              total: 8,
            }),
            lang: "es",
            options: [
              "Me gustaría un café, por favor.",
              "Me gusta un café, por favor.",
              "Tengo un café, por favor.",
            ],
            question: t("Which one means “I'd like a coffee, please”?"),
          }
        : {
            label: t("Question {number, number} of {total, number} · {subject}", {
              number: 3,
              subject: t("English"),
              total: 8,
            }),
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

/** A placement question answered: its place in the test, the question and its answers, one picked. */
function PlacementPicture({ question }: { question: PlacementQuestion }) {
  return (
    <>
      <p className={FRAME_EYEBROW_CLASS}>{question.label}</p>
      <p className="text-[0.9375rem] leading-snug font-[560] text-pretty">{question.question}</p>

      <AnswerPictures>
        {question.options.map((option, index) => (
          <AnswerPicture
            key={option}
            lang={question.lang}
            marker={ANSWER_LETTERS[index] ?? ""}
            picked={index === 0}
          >
            {option}
          </AnswerPicture>
        ))}
      </AnswerPictures>
    </>
  );
}

/** The placement question for each example goal, the one the visitor picked showing. */
export async function PlacementQuestions() {
  const questions = await getPlacementQuestions();

  return EXAMPLE_GOALS.map((goal) => (
    <Variant className="flex flex-col gap-3" key={goal} name={GOAL_SWITCH} value={goal}>
      <PlacementPicture question={questions[goal]} />
    </Variant>
  ));
}
