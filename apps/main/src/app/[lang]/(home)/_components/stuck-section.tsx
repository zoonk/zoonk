import { AnswerPicture, AnswerPictures } from "@/components/public/answer-picture";
import { ProductWindow } from "@/components/public/product-window";
import { Variant, VariantSwitch, VariantSwitchOption } from "@/components/public/variant-switch";
import { KindMark } from "@zoonk/learn/kind-tile";
import { getExtracted } from "next-intl/server";
import { STUCK_SECTION_ID } from "./home-ids";
import { Objection, ObjectionAnswer, ObjectionQuote, bold } from "./objection";
import { Zu } from "./zu";

const TITLE_ID = "stuck-title";

const ASK_SWITCH = "landing-ask";
const ASKS = ["why", "simpler", "example"] as const;
const DEFAULT_ASK = "why";

type Ask = (typeof ASKS)[number];

const SUGGESTION_CLASS =
  "ring-input bg-card hover:bg-muted has-checked:ring-selected has-focus-visible:outline-ring inline-flex min-h-11 cursor-pointer items-center rounded-[0.625rem] px-3.5 text-[0.90625rem] font-medium ring-1 transition-colors ring-inset has-checked:ring-2 has-focus-visible:outline-2 has-focus-visible:outline-offset-2";

async function Question() {
  const t = await getExtracted();

  return (
    <div className="flex flex-col p-5.5 lg:p-7">
      <p className="text-faint text-[0.8125rem] font-medium">
        {t({
          description: "A school subject area. In Brazilian Portuguese “Ciências da Natureza”.",
          message: "Natural sciences",
        })}
      </p>
      <p className="text-muted-foreground mt-2.5 text-[0.9375rem] leading-normal text-pretty">
        {t(
          "In a pasture, grass is eaten by grasshoppers, grasshoppers by frogs and frogs by snakes.",
        )}
      </p>
      <p className="mt-2 text-[1.0625rem] leading-[1.45] font-medium tracking-[-0.01em] text-pretty">
        {t("The energy available shrinks at each level of this chain. What's the main reason?")}
      </p>

      <AnswerPictures className="mt-4">
        <AnswerPicture marker="A" result="wrong" tag={t("Your answer")}>
          {t("Predators eat less than their prey")}
        </AnswerPicture>
        <AnswerPicture marker="B" result="right" tag={t("Correct")}>
          {t("Part of the energy turns into heat as each living thing breathes")}
        </AnswerPicture>
        <AnswerPicture marker="C">{t("Plants photosynthesize less at night")}</AnswerPicture>
      </AnswerPictures>

      <p className="text-muted-foreground mt-3.5 flex items-center gap-2 text-sm">
        <KindMark kind="mistakes" />
        {t("Saved to your mistakes notebook")}
      </p>
    </div>
  );
}

async function Conversation() {
  const t = await getExtracted();
  const tBuddy = await getExtracted("buddyNames");

  const exchanges: Record<Ask, { answer: string; ask: string }> = {
    example: {
      answer: t({
        description:
          "The study buddy's casual joke: you don't gain the weight of the plate of food you ate.",
        message:
          "You eat lunch and don't gain the weight of the plate, right? Almost all of it becomes energy for your day. It's the same with the frog: only a small part of the grasshopper becomes frog.",
      }),
      ask: t({
        description:
          "A learner's casual message to their study buddy. In Brazilian Portuguese: “Me dá um exemplo”.",
        message: "Give me an example",
      }),
    },
    simpler: {
      answer: t(
        "Each animal uses almost all the energy it eats just to stay alive. Very little is left to become body. That little bit is what passes on to whoever eats it.",
      ),
      ask: t({
        description:
          "A learner's casual message to their study buddy. In Brazilian Portuguese: “Explica mais simples”.",
        message: "Explain it more simply",
      }),
    },
    why: {
      answer: t(
        "Because it's not about how much they eat. Every animal spends almost all the energy from its food just staying alive. Breathing releases that energy as heat. Only about 10% passes to the next level.",
      ),
      ask: t({
        description:
          "A learner's casual message asking why their pick, option A, was wrong. In Brazilian Portuguese: “Por que não é a A?”",
        message: "Why isn't it A?",
      }),
    },
  };

  return (
    <div className="bg-ground/60 flex flex-col gap-4 border-t p-5.5 lg:border-t-0 lg:border-l lg:p-7 dark:bg-transparent">
      <p className="flex items-center gap-3">
        <Zu className="size-14" />
        <span className="flex flex-col">
          <span className="font-semibold">{tBuddy("Zu")}</span>
          <span className="text-muted-foreground text-[0.84375rem]">{t("Your study buddy")}</span>
        </span>
      </p>

      <div className="grid gap-2.5">
        <div className="grid *:col-start-1 *:row-start-1">
          {ASKS.map((ask) => (
            <Variant
              className="bg-foreground text-background max-w-[94%] justify-self-end rounded-2xl rounded-br-md px-3.5 py-2.5 text-[0.9375rem] leading-normal"
              key={ask}
              name={ASK_SWITCH}
              stacked
              value={ask}
            >
              {exchanges[ask].ask}
            </Variant>
          ))}
        </div>

        <div className="grid *:col-start-1 *:row-start-1">
          {ASKS.map((ask) => (
            <Variant
              className="bg-card ring-border max-w-[94%] self-start justify-self-start rounded-2xl rounded-bl-md px-3.5 py-2.5 text-[0.9375rem] leading-normal text-pretty ring-1"
              key={ask}
              name={ASK_SWITCH}
              stacked
              value={ask}
            >
              {exchanges[ask].answer}
            </Variant>
          ))}
        </div>
      </div>

      <VariantSwitch
        aria-label={t("Questions for Zu")}
        className="mt-auto flex flex-wrap gap-2"
        defaultValue={DEFAULT_ASK}
        name={ASK_SWITCH}
        values={ASKS}
      >
        {ASKS.map((ask) => (
          <VariantSwitchOption
            className={SUGGESTION_CLASS}
            defaultValue={DEFAULT_ASK}
            key={ask}
            name={ASK_SWITCH}
            value={ask}
          >
            {exchanges[ask].ask}
          </VariantSwitchOption>
        ))}
      </VariantSwitch>
    </div>
  );
}

export async function StuckSection() {
  const t = await getExtracted();

  return (
    <Objection id={STUCK_SECTION_ID} titleId={TITLE_ID}>
      <ObjectionQuote id={TITLE_ID}>
        {t({
          description:
            "A learner's own worry, in their casual words, shown as a big quote. It's an exam question. In Brazilian Portuguese: “Travei numa questão.”",
          message: "I got stuck on a question.",
        })}
      </ObjectionQuote>
      <ObjectionAnswer>
        {t.rich({
          description:
            "In Brazilian Portuguese: “<b>Pergunte ali mesmo na questão.</b> Zu explica do jeito mais simples que você precisar.”",
          message: "<b>Ask right there in the question.</b> Zu explains it as simply as you need.",
          values: { b: bold },
        })}
      </ObjectionAnswer>

      <ProductWindow className="mt-11 grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Question />
        <Conversation />
      </ProductWindow>
    </Objection>
  );
}
