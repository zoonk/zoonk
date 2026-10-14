import { ProductWindow } from "@/components/public/product-window";
import {
  Stop,
  StopBody,
  StopEyebrow,
  StopHeader,
  StopLead,
  StopMark,
  StopTitle,
} from "@/components/public/stop";
import { Variant } from "@/components/public/variant-switch";
import { Buddy } from "@zoonk/ui/components/buddy";
import { CornerDownRightIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import {
  EXAMPLE_GOALS,
  type ExampleGoal,
  GOAL_SWITCH,
  SQL_NAMES,
  getExampleSet,
} from "./landing-examples";

const STOP_TITLE_ID = "stop-buddy";

/** The default buddy, as a new learner meets it: Zu, with round glasses, before any Energy. */
function ZuFace({ className }: { className?: string }) {
  return (
    <Buddy
      beltColor="white"
      className={className}
      crop="face"
      energy={null}
      glasses="round"
      kind="zu"
    />
  );
}

type Exchange = {
  /** The learner's question, and where they asked it: the question or lesson the page just showed. */
  answer: string;
  ask: string;
  context: string;
  /** The quote's language when it's the one being learned. */
  lang?: string;
  quote: string;
};

/** Each example goal's late question to the buddy, about the practice the page just showed. */
async function getExchanges(): Promise<Record<ExampleGoal, Exchange>> {
  const t = await getExtracted();
  const set = await getExampleSet();
  const sql = SQL_NAMES[set.market];

  const exam: Exchange =
    set.exam === "enem"
      ? {
          answer: t(
            "Because it's not about how much they eat. Every animal spends most of the energy in its food on staying alive, and respiration releases that energy as heat. That's why only about 10% moves up to the next level.",
          ),
          ask: t("Why not A?"),
          context: t("Mock exam 2 · Question 4 · Natural Sciences"),
          quote: t(
            "In a food chain, the available energy decreases at each trophic level. What is the main reason?",
          ),
        }
      : {
          answer: t(
            "308 is what you get if you divide all of the $15.40 by 5 cents. But $12 of it is the monthly fee. Only the $3.40 left pays for texts, and $3.40 ÷ $0.05 = 68.",
          ),
          ask: t("Why isn't it 308?"),
          context: t("Mock exam 2 · Question 4 · Math"),
          quote: t(
            "A phone plan costs $12 a month plus $0.05 per text. Ana paid $15.40 in March. How many texts did she send?",
          ),
        };

  return {
    exam,
    job: {
      answer: t(
        "Without it, SUM adds every row into one total. GROUP BY {column} makes one total per region, so you can compare them, and ORDER BY puts the biggest first.",
        { column: sql.region },
      ),
      ask: t("Why do I need GROUP BY here?"),
      context: t("Real problem · Sales by region"),
      quote: `SELECT ${sql.region}, SUM(${sql.sales}) AS total FROM ${sql.orders}…`,
    },
    move:
      set.move === "madrid"
        ? {
            answer: t(
              "Both work. In Spain people usually say “piso” for a flat in a building. “Apartamento” often means a small one, like a holiday rental, so “piso” sounds more natural when you're renting in Madrid.",
            ),
            ask: t("Why “piso” and not “apartamento”?"),
            context: t("Lesson · Calling about an apartment"),
            lang: "es",
            quote: "¿Puedo ver el piso el sábado?",
          }
        : {
            answer: t(
              "Both work, but in London people say “flat”. “Apartment” is more common in the US, so “flat” sounds more natural when you're renting there.",
            ),
            ask: t("Why “flat” and not “apartment”?"),
            context: t("Lesson · Calling about an apartment"),
            lang: "en",
            quote: "Can I see the flat on Saturday?",
          },
  };
}

/**
 * One exchange as the buddy's conversation shows it: where the learner asked (the question
 * quoted), their question in a bubble, the buddy's answer as plain text on the page under its face
 * and name, and the one-tap follow-ups it offers after a miss.
 */
async function Conversation({ exchange }: { exchange: Exchange }) {
  const t = await getExtracted();
  const tBuddy = await getExtracted("buddyNames");

  return (
    <ProductWindow className="flex flex-col gap-5 p-5 sm:p-7">
      <div className="flex flex-col gap-1 border-l-2 pl-3.5">
        <p className="text-faint font-mono text-xs leading-4 uppercase">{exchange.context}</p>
        <p className="text-muted-foreground line-clamp-2 text-sm leading-snug" lang={exchange.lang}>
          {exchange.quote}
        </p>
      </div>

      <p className="bg-muted ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-[0.9375rem] leading-snug text-pretty">
        {exchange.ask}
      </p>

      <div className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3">
        <ZuFace className="size-9" />

        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-[0.8125rem] font-semibold">{tBuddy("Zu")}</p>
          <p className="max-w-column text-base leading-relaxed text-pretty">{exchange.answer}</p>

          <p className="text-muted-foreground mt-3 flex items-start gap-2 text-[0.8125rem] leading-snug">
            <CornerDownRightIcon aria-hidden="true" className="mt-px size-3.5 shrink-0" />
            <span className="text-pretty">
              {[t("Explain it more simply"), t("I want to go deeper")].join(" · ")}
            </span>
          </p>
        </div>
      </div>
    </ProductWindow>
  );
}

/**
 * Stuck late at night: the buddy explains the question the page just showed, as simply as the
 * learner needs, where they got stuck. Its lead says it's AI.
 */
export async function StopBuddy() {
  const t = await getExtracted();
  const exchanges = await getExchanges();

  return (
    <Stop aria-labelledby={STOP_TITLE_ID}>
      <StopHeader>
        <StopEyebrow>
          <StopMark>
            <ZuFace className="size-5" />
          </StopMark>
          {t("11 pm · one question")}
        </StopEyebrow>

        <StopTitle id={STOP_TITLE_ID}>{t("Stuck? Ask Zu.")}</StopTitle>

        <StopLead>
          {t(
            "Your AI study buddy explains any question as simply as you need, right where you got stuck.",
          )}
        </StopLead>
      </StopHeader>

      <StopBody className="max-w-form">
        {EXAMPLE_GOALS.map((goal) => (
          <Variant key={goal} name={GOAL_SWITCH} value={goal}>
            <Conversation exchange={exchanges[goal]} />
          </Variant>
        ))}
      </StopBody>
    </Stop>
  );
}
