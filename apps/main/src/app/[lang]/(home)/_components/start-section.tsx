import { ProductWindow } from "@/components/public/product-window";
import { Variant, VariantSwitch, VariantSwitchOption } from "@/components/public/variant-switch";
import { ANSWER_OPTION_CLASS, ANSWER_TONE } from "@zoonk/learn/answer-tone";
import {
  ListGroup,
  ListRow,
  ListRowContent,
  ListRowTitle,
  ListRowTrailing,
} from "@zoonk/learn/list";
import { StatusMark } from "@zoonk/learn/status-mark";
import { Kbd } from "@zoonk/ui/components/kbd";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted, getFormatter } from "next-intl/server";
import { Objection, ObjectionAnswer, ObjectionQuote, bold } from "./objection";

const TITLE_ID = "start-title";

const ANSWER_SWITCH = "landing-placement";
const ANSWERS = ["right", "wrong", "idk"] as const;

/** Not one of the answers, so nothing is picked until the visitor answers. */
const NO_ANSWER = "none";

const OPTIONS = [
  { right: false, share: 0.8 },
  { right: true, share: 0.96 },
  { right: false, share: 1 },
  { right: false, share: 1.04 },
];

const SKIPPED_LESSONS = 12;
const PERCENT_LESSONS = 4;

const PLACEMENT_OPTION_CLASS = cn(
  ANSWER_OPTION_CLASS,
  ANSWER_TONE.idle,
  "hover:bg-muted/60 min-h-12 cursor-pointer items-center transition-colors",
  "has-checked:bg-selected-tint has-checked:ring-selected has-checked:ring-2",
  "has-focus-visible:outline-ring has-focus-visible:outline-2 has-focus-visible:outline-offset-2",
);

const IDK_CLASS =
  "decoration-input has-checked:decoration-foreground has-focus-visible:outline-ring -ml-2.5 inline-flex min-h-11 cursor-pointer items-center rounded-lg px-2.5 text-[0.9375rem] font-medium underline underline-offset-4 has-checked:decoration-2 has-focus-visible:outline-2";

async function SkippedRow({ className, title }: { className?: string; title: string }) {
  // Its own namespace: a placed topic's "Skipped" agrees with topics of any gender and number.
  const tPlaced = await getExtracted("placedPlan");

  return (
    <ListRow className={className} role="listitem">
      <StatusMark className="self-center" status="skipped" />
      <ListRowContent>
        <ListRowTitle className="text-muted-foreground text-[0.9375rem] font-normal">
          {title}
        </ListRowTitle>
      </ListRowContent>
      <ListRowTrailing className="font-sans">{tPlaced("Skipped")}</ListRowTrailing>
    </ListRow>
  );
}

async function LessonsRow({
  className,
  lessons,
  title,
}: {
  className?: string;
  lessons: number;
  title: string;
}) {
  const t = await getExtracted();

  return (
    <ListRow className={className} role="listitem">
      <StatusMark className="self-center" status="todo" />
      <ListRowContent>
        <ListRowTitle className="text-[0.9375rem] font-normal">{title}</ListRowTitle>
      </ListRowContent>
      <ListRowTrailing>
        {t("{count, plural, one {# lesson} other {# lessons}}", { count: lessons })}
      </ListRowTrailing>
    </ListRow>
  );
}

function renderCount(chunks: React.ReactNode) {
  return <b className="text-foreground font-semibold tabular-nums">{chunks}</b>;
}

async function PlacedPlan() {
  const t = await getExtracted();
  const percentages = t("Percentages");

  return (
    <div className="bg-ground/60 flex flex-col border-t p-5.5 sm:p-6.5 md:border-t-0 md:border-l dark:bg-transparent">
      <p className="flex items-baseline justify-between gap-3">
        <span className="text-[1.0625rem] font-semibold tracking-[-0.015em]">{t("Your plan")}</span>
        <span className="text-muted-foreground grid text-sm *:col-start-1 *:row-start-1">
          <span className="group-has-[input[value=right]:checked]/placement:invisible">
            {t.rich("Lessons skipped: <b>{count, number}</b>", {
              b: renderCount,
              count: SKIPPED_LESSONS,
            })}
          </span>
          <span className="invisible group-has-[input[value=right]:checked]/placement:visible">
            {t.rich("Lessons skipped: <b>{count, number}</b>", {
              b: renderCount,
              count: SKIPPED_LESSONS + PERCENT_LESSONS,
            })}
          </span>
        </span>
      </p>

      <p className="text-muted-foreground [&_b]:text-foreground mt-1.5 grid text-sm leading-[1.45] *:col-start-1 *:row-start-1 [&_b]:font-semibold">
        <span className="group-has-checked/placement:invisible">
          {t("Answer the question and watch your plan change.")}
        </span>
        <Variant as="span" name={ANSWER_SWITCH} stacked value="right">
          {t.rich(
            "<b>You already know this.</b> Your plan skipped {count, plural, one {# lesson} other {# lessons}} on percentages.",
            { b: bold, count: PERCENT_LESSONS },
          )}
        </Variant>
        <Variant as="span" name={ANSWER_SWITCH} stacked value="wrong">
          {t.rich("<b>Noted.</b> Percentages stay in your plan.", { b: bold })}
        </Variant>
        <Variant as="span" name={ANSWER_SWITCH} stacked value="idk">
          {t.rich("<b>That's fine.</b> Your plan teaches percentages from the basics.", {
            b: bold,
          })}
        </Variant>
      </p>

      <ListGroup className="isolate mt-2" role="list">
        <SkippedRow title={t("Ratio and proportion")} />
        <SkippedRow
          title={t({
            description: "A math topic. In Brazilian Portuguese “Regra de três”.",
            message: "Cross-multiplication",
          })}
        />
        <SkippedRow
          className="hidden group-has-[input[value=right]:checked]/placement:flex"
          title={percentages}
        />
        <LessonsRow
          className="group-has-[input[value=right]:checked]/placement:hidden"
          lessons={PERCENT_LESSONS}
          title={percentages}
        />
        <LessonsRow lessons={6} title={t("Compound interest")} />
        <LessonsRow
          lessons={7}
          title={t({
            description: "A math topic. In Brazilian Portuguese “Funções do 1º grau”.",
            message: "Linear functions",
          })}
        />
      </ListGroup>
    </div>
  );
}

async function PlacementQuestion() {
  const t = await getExtracted();
  const format = await getFormatter();

  return (
    <div className="flex flex-col p-5.5 sm:p-6.5">
      <p className="text-faint text-[0.8125rem] font-medium">
        {t("Question {number, number} · {subject}", { number: 3, subject: t("Math") })}
      </p>
      <p className="mt-2 text-[1.0625rem] leading-[1.45] font-medium tracking-[-0.01em] text-pretty">
        {t("A price goes up 20%, then down 20%. What percent of the original price is it now?")}
      </p>

      <VariantSwitch
        aria-label={t("Answer options")}
        className="mt-4 flex flex-col gap-2"
        defaultValue={NO_ANSWER}
        name={ANSWER_SWITCH}
        values={ANSWERS}
      >
        {OPTIONS.map(({ right, share }, index) => (
          <VariantSwitchOption
            className={PLACEMENT_OPTION_CLASS}
            defaultValue={NO_ANSWER}
            key={share}
            name={ANSWER_SWITCH}
            value={right ? "right" : "wrong"}
          >
            <LineMarker aria-hidden="true">
              <Kbd>{index + 1}</Kbd>
            </LineMarker>
            <span className="tabular-nums">{format.number(share, { style: "percent" })}</span>
          </VariantSwitchOption>
        ))}

        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3">
          <VariantSwitchOption
            className={IDK_CLASS}
            defaultValue={NO_ANSWER}
            name={ANSWER_SWITCH}
            value="idk"
          >
            {t("I don't know yet")}
          </VariantSwitchOption>
          <p className="text-muted-foreground text-[0.84375rem]">{t("It's not scored.")}</p>
        </div>
      </VariantSwitch>
    </div>
  );
}

export async function StartSection() {
  const t = await getExtracted();

  return (
    <Objection
      band
      className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-20"
      titleId={TITLE_ID}
    >
      <div>
        <ObjectionQuote id={TITLE_ID}>
          {t({
            description:
              "A learner's own worry, in their casual words, shown as a big quote. In Brazilian Portuguese: “Não sei por onde começar.”",
            message: "I don't know where to start.",
          })}
        </ObjectionQuote>
        <ObjectionAnswer>
          {t.rich(
            "<b>Start with a few quick questions.</b> In about 2 minutes, Zoonk sees what you already know, and your plan skips that part.",
            { b: bold },
          )}
        </ObjectionAnswer>
      </div>

      <ProductWindow className="group/placement grid md:grid-cols-2">
        <PlacementQuestion />
        <PlacedPlan />
      </ProductWindow>
    </Objection>
  );
}
