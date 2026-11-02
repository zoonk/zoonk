import { DayList, DaySegments } from "@/components/public/day-list";
import { NUMERIC_CLASS } from "@/components/public/landing-styles";
import { ProductWindow } from "@/components/public/product-window";
import {
  SEGMENTED_OPTION_CLASS,
  SEGMENTED_TRACK_CLASS,
  Variant,
  VariantSwitch,
  VariantSwitchOption,
} from "@/components/public/variant-switch";
import { getMinutesFormatter } from "@/lib/public/public-labels";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted, getFormatter } from "next-intl/server";
import { Fragment } from "react";
import { type HeroExample } from "./hero-example";
import { getHeroExamples } from "./hero-examples";
import { HeroMess } from "./hero-mess";
import { STUCK_SECTION_ID } from "./home-ids";
import { EXAMPLE_GOALS, GOAL_SWITCH } from "./landing-examples";
import { Zu } from "./zu";

const VIEW_SWITCH = "landing-view";
const VIEWS = ["without", "with"] as const;
const DEFAULT_VIEW = "with";

/** Glued to the topic before it, so a line never starts with one. */
const DOT = "\u00A0·";

const VIEW_OPTION_CLASS = cn(SEGMENTED_OPTION_CLASS, "h-10 flex-1 px-3.5 text-sm sm:flex-none");

function isPicked({ example, topic }: { example: HeroExample; topic: string }) {
  return example.steps.some((step) => step.topic === topic);
}

function getPicks(example: HeroExample): string[] {
  return example.topics.filter((topic) => isPicked({ example, topic }));
}

function Wall({ example }: { example: HeroExample }) {
  const last = example.topics.length - 1;

  return (
    <p
      className={cn(
        "text-foreground/27 contrast-more:text-foreground/62 h-full overflow-hidden mask-b-from-55% mask-b-to-97% text-[0.84375rem] leading-[1.75] tracking-[-0.005em] text-pretty *:not-first:whitespace-nowrap sm:text-lg sm:leading-[2.3]",
        "opacity-0 transition-[opacity,color] duration-200 ease-out sm:opacity-100",
        "without-zoonk:text-foreground/76 without-zoonk:opacity-100",
      )}
    >
      <span className="text-muted-foreground font-medium after:content-[':_'] sm:mb-1.5 sm:block sm:text-[0.84375rem] sm:after:content-none">
        {example.label}
      </span>

      {example.topics.flatMap((topic, index) => {
        const dot = index < last ? DOT : "";

        return [
          " ",
          isPicked({ example, topic }) ? (
            <span key={topic}>
              <b className="text-foreground without-zoonk:text-inherit font-semibold transition-colors">
                {topic}
              </b>
              {dot}
            </span>
          ) : (
            <span key={topic}>{`${topic}${dot}`}</span>
          ),
        ];
      })}
    </p>
  );
}

function WallSummary({ example }: { example: HeroExample }) {
  const picks = getPicks(example);

  return (
    <p className="text-muted-foreground text-[0.8125rem] leading-[1.7]">
      <span className="font-medium">{`${example.label}: `}</span>
      {picks.map((topic, index) => (
        <Fragment key={topic}>
          {index > 0 && " "}
          <b className="text-foreground font-semibold whitespace-nowrap">
            {topic}
            {index < picks.length - 1 && DOT}
          </b>
        </Fragment>
      ))}
    </p>
  );
}

async function TodayCard({ example }: { example: HeroExample }) {
  const t = await getExtracted();
  const minutesText = await getMinutesFormatter();
  const minutes = example.steps.reduce((sum, step) => sum + step.minutes, 0);

  return (
    <>
      <div className="flex flex-col px-4.5 pt-4 pb-3">
        <p className="flex items-baseline justify-between gap-3">
          <span className="text-[1.3125rem] leading-tight font-semibold tracking-tight">
            {t("Today")}
          </span>
          <span className={cn(NUMERIC_CLASS, "text-muted-foreground text-sm")}>
            {minutesText(minutes)}
          </span>
        </p>

        <p className="text-muted-foreground truncate text-sm">
          {[t("Example"), example.name].join(" · ")}
        </p>

        <DaySegments className="mt-3" steps={example.steps} />
      </div>

      <DayList
        className="px-4.5 pb-1.5 **:data-[slot=list-row-description]:text-[0.8125rem] **:data-[slot=list-row-title]:text-[0.9375rem]"
        minutesText={minutesText}
        steps={example.steps}
      />
    </>
  );
}

export async function HeroStage() {
  const t = await getExtracted();
  const format = await getFormatter();
  const examples = await getHeroExamples();

  return (
    <div className="group/stage relative flex min-w-0 flex-col" data-slot="hero-stage">
      <VariantSwitch
        aria-label={t("Compare")}
        className="relative z-4 flex"
        defaultValue={DEFAULT_VIEW}
        name={VIEW_SWITCH}
        values={VIEWS}
      >
        <span className={cn(SEGMENTED_TRACK_CLASS, "w-full sm:w-auto")}>
          <VariantSwitchOption
            className={VIEW_OPTION_CLASS}
            defaultValue={DEFAULT_VIEW}
            name={VIEW_SWITCH}
            value="without"
          >
            {t("Without Zoonk")}
          </VariantSwitchOption>

          <VariantSwitchOption
            className={VIEW_OPTION_CLASS}
            defaultValue={DEFAULT_VIEW}
            name={VIEW_SWITCH}
            value="with"
          >
            {t("With Zoonk")}
          </VariantSwitchOption>
        </span>
      </VariantSwitch>

      <div
        aria-hidden="true"
        className="without-zoonk:opacity-0 relative z-2 mt-2.5 grid transition-opacity duration-200 *:col-start-1 *:row-start-1 sm:hidden"
      >
        {EXAMPLE_GOALS.map((goal) => (
          <Variant key={goal} name={GOAL_SWITCH} stacked value={goal}>
            <WallSummary example={examples[goal]} />
          </Variant>
        ))}
      </div>

      {EXAMPLE_GOALS.map((goal) => (
        <Variant key={goal} name={GOAL_SWITCH} value={goal}>
          <p className="without-zoonk:invisible sr-only">
            {t({
              description:
                "{everything} names everything a learner could study, such as “Everything that can come up on the SAT”; {topics} lists a few topics.",
              message: "{everything}. Today Zoonk picked {topics}.",
              values: {
                everything: examples[goal].label,
                topics: format.list(getPicks(examples[goal]), { type: "conjunction" }),
              },
            })}
          </p>
        </Variant>
      ))}

      <p className="without-zoonk:visible invisible sr-only">
        {t(
          "Without Zoonk: a search for where to start, a pile of open tabs and a study schedule abandoned in week two.",
        )}
      </p>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-15 bottom-0 z-1 sm:top-16.5"
      >
        {EXAMPLE_GOALS.map((goal) => (
          <Variant className="h-full" key={goal} name={GOAL_SWITCH} value={goal}>
            <Wall example={examples[goal]} />
            <HeroMess example={examples[goal]} />
          </Variant>
        ))}
      </div>

      <ProductWindow
        className={cn(
          "relative z-3 mt-2.5 shadow-[0_1px_2px_oklch(0_0_0/5%),0_18px_44px_-18px_oklch(0_0_0/20%)] sm:mt-43 sm:w-105 sm:self-end dark:shadow-[0_1px_2px_oklch(0_0_0/50%),0_24px_56px_-20px_oklch(0_0_0/75%)]",
          "transition-[opacity,translate,scale,visibility] duration-200 ease-out motion-reduce:transition-[opacity,visibility]",
          "without-zoonk:invisible without-zoonk:translate-y-4.5 without-zoonk:scale-97 without-zoonk:opacity-0",
        )}
      >
        <div className="grid *:col-start-1 *:row-start-1">
          {EXAMPLE_GOALS.map((goal) => (
            <Variant key={goal} name={GOAL_SWITCH} stacked value={goal}>
              <TodayCard example={examples[goal]} />
            </Variant>
          ))}
        </div>

        <a
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex min-h-11 items-center gap-2.5 border-t px-4.5 py-2.5 text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-inset"
          href={`#${STUCK_SECTION_ID}`}
        >
          <Zu className="size-7.5" crop="face" />
          {t("Stuck? Ask Zu.")}
        </a>
      </ProductWindow>
    </div>
  );
}
