import { Frame, FrameCaption, Frames } from "@/components/public/frames";
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
import { getMinutesFormatter } from "@/lib/public/public-labels";
import { CHOICE_CONTROL_CLASS, CHOICE_PICKED_ROW_CLASS } from "@zoonk/learn/choice-styles";
import {
  ListGroup,
  ListRow,
  ListRowContent,
  ListRowDescription,
  ListRowTitle,
} from "@zoonk/learn/list";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, FastForwardIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { FRAME_CARD_CLASS, FRAME_EYEBROW_CLASS } from "./day-one-styles";
import { getExamplePlans } from "./example-plans";
import { EXAMPLE_GOALS, GOAL_SWITCH } from "./landing-examples";
import { PlacedPlans } from "./placed-plans";
import { PlacementQuestions } from "./placement-questions";

const STOP_TITLE_ID = "stop-day-one";

async function LevelChoices() {
  const t = await getExtracted();
  const minutesText = await getMinutesFormatter();

  const choices = [
    {
      description: t("From scratch, with everyday examples"),
      id: "none",
      label: t("Nothing, I'm just starting"),
    },
    { description: t("I know a few things"), id: "basic", label: t("The basics") },
    {
      description: t("We'll skip what you already know"),
      id: "intermediate",
      label: t("I studied it before"),
    },
    { description: t("Only what's new or hard"), id: "advanced", label: t("I know it well") },
    {
      description: t("Adapts to your answers, about {time}", { time: minutesText(2) }),
      id: "test",
      label: t("Not sure, give me a quick test"),
    },
  ];

  return (
    <ListGroup className="isolate" role="list">
      {choices.map((choice) => {
        const picked = choice.id === "basic";

        return (
          <ListRow
            className={CHOICE_PICKED_ROW_CLASS}
            data-highlighted={picked || undefined}
            key={choice.id}
            role="listitem"
          >
            <ListRowContent className="py-2">
              <ListRowTitle>{choice.label}</ListRowTitle>
              <ListRowDescription>{choice.description}</ListRowDescription>
            </ListRowContent>

            <span
              aria-hidden="true"
              className={cn(CHOICE_CONTROL_CLASS, "grid place-items-center")}
              data-checked={picked || undefined}
            >
              {picked && <CheckIcon className="text-selected-foreground" strokeWidth={3} />}
            </span>
          </ListRow>
        );
      })}
    </ListGroup>
  );
}

async function LevelQuestion() {
  const t = await getExtracted();
  const plans = await getExamplePlans();

  return (
    <>
      <p className={FRAME_EYEBROW_CLASS}>
        {EXAMPLE_GOALS.map((goal) => (
          <Variant as="span" key={goal} name={GOAL_SWITCH} value={goal}>
            {plans[goal].shortName}
          </Variant>
        ))}
      </p>
      <p className="text-[1.1875rem] leading-tight font-[620] tracking-tight text-balance">
        {t("How much do you already know?")}
      </p>
      <LevelChoices />
    </>
  );
}

export async function StopDayOne() {
  const t = await getExtracted();

  return (
    <Stop aria-labelledby={STOP_TITLE_ID} rail>
      <StopHeader>
        <StopEyebrow>
          <StopMark>
            <FastForwardIcon className="text-muted-foreground size-3.5 fill-current" />
          </StopMark>
          {t("Day 1 · 2 minutes")}
        </StopEyebrow>

        <StopTitle id={STOP_TITLE_ID}>{t("Your plan starts where you are.")}</StopTitle>

        <StopLead>
          {t("A few quick questions find what you already know, and your plan skips it.")}
        </StopLead>
      </StopHeader>

      <StopBody>
        <Frames aria-label={t("Day 1, in three steps")}>
          <Frame>
            <ProductWindow className={FRAME_CARD_CLASS}>
              <LevelQuestion />
            </ProductWindow>
            <FrameCaption number={1}>{t("Say how much you know")}</FrameCaption>
          </Frame>

          <Frame>
            <ProductWindow className={FRAME_CARD_CLASS}>
              <PlacementQuestions />
            </ProductWindow>
            <FrameCaption number={2}>{t("Answer a few questions")}</FrameCaption>
          </Frame>

          <Frame>
            <ProductWindow className={FRAME_CARD_CLASS}>
              <PlacedPlans />
            </ProductWindow>
            <FrameCaption number={3}>{t("Your plan skips what you know")}</FrameCaption>
          </Frame>
        </Frames>
      </StopBody>
    </Stop>
  );
}
