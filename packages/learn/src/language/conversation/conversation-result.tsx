"use client";

import {
  type CallFeedback,
  type LanguageConversationView,
} from "@zoonk/core/language/conversations/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { BrainIcon, CircleCheckIcon, CircleIcon, StarIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { Callout } from "../../_components/callout";
import { FactChip, FactChips } from "../../_components/fact-chips";
import {
  StepCard,
  StepDetail,
  StepEyebrow,
  StepHeader,
  StepRow,
  StepRows,
  StepTitle,
} from "../../_components/step-card";
import { Steps, type StepsItem } from "../../_components/steps";
import { ItemLine } from "../../questions/item-text";
import { TaskMainLink } from "../../shell/task-frame";
import { useConversationTitle } from "./conversation-labels";
import { SpeakButton } from "./conversation-parts";

type Result = NonNullable<LanguageConversationView["result"]>;

type Objective = LanguageConversationView["objectives"][number];

const MAX_STARS = 3;

/**
 * The call's stars, from what the learner did and never at random: the result's anchor.
 */
function Stars({ stars }: { stars: number }) {
  const t = useExtracted();

  return (
    <div aria-label={t("{stars, number} of 3 stars", { stars })} className="flex gap-2" role="img">
      {Array.from({ length: MAX_STARS }, (_, index) => (
        <StarIcon
          aria-hidden="true"
          className={cn(
            "motion-safe:animate-badge-land size-11",
            index < stars
              ? "fill-amber-500 text-amber-600 dark:fill-amber-400 dark:text-amber-400"
              : "text-muted-foreground/40",
          )}
          // The stars never move, so their position identifies them.
          // oxlint-disable-next-line react/no-array-index-key
          key={index}
        />
      ))}
    </div>
  );
}

/** A checkpoint says whether it was passed; a practice call or a mock is named by its title. */
function useHeadline({
  conversation,
  result,
}: {
  conversation: LanguageConversationView;
  result: Result;
}): string {
  const t = useExtracted();

  if (conversation.kind !== "checkpoint") {
    return conversation.title;
  }

  return result.passed ? t("Challenge passed") : t("Not this time");
}

/** The stars, the call's verdict or name, what it came to, and how to earn the missing stars. */
function StarsStep({
  conversation,
  feedback,
  result,
}: {
  conversation: LanguageConversationView;
  feedback: CallFeedback | null;
  result: Result;
}) {
  const t = useExtracted();
  const title = useConversationTitle(conversation);
  const headline = useHeadline({ conversation, result });
  const lost = conversation.kind === "checkpoint" && !result.passed;

  return (
    <>
      <StepCard>
        <Stars stars={result.stars} />
        <StepHeader>
          <StepEyebrow>
            {conversation.kind === "checkpoint" ? conversation.title : title}
          </StepEyebrow>
          <StepTitle>{headline}</StepTitle>
          {feedback?.encouragement && <StepDetail>{feedback.encouragement}</StepDetail>}
        </StepHeader>

        {result.brainPower > 0 && (
          <FactChips className="justify-center">
            <FactChip>
              <BrainIcon aria-hidden="true" />
              {t("+{points} Brain Power", { points: String(result.brainPower) })}
            </FactChip>
          </FactChips>
        )}
      </StepCard>

      {lost && (
        <Callout>
          <StarIcon aria-hidden="true" />
          <p>{t("Nothing is lost: the call comes back so you can try again.")}</p>
        </Callout>
      )}

      {!lost && result.stars < MAX_STARS && (
        <Callout>
          <StarIcon aria-hidden="true" />
          <p>
            {t("A star for finishing, one for getting everything across and one without Help.")}
          </p>
        </Callout>
      )}
    </>
  );
}

function CheckRow({
  children,
  done,
  language,
}: {
  children: string;
  done: boolean;
  language: string;
}) {
  const t = useExtracted();

  return (
    <StepRow>
      {done ? (
        <CircleCheckIcon aria-hidden="true" className="text-success" />
      ) : (
        <CircleIcon aria-hidden="true" className="text-muted-foreground" />
      )}
      <span lang={language}>{children}</span>
      <span className="sr-only">{done ? t("done") : t("not yet")}</span>
    </StepRow>
  );
}

/** The goals the learner got across and the phrases they said well. */
function WentWellStep({
  feedback,
  language,
  met,
}: {
  feedback: CallFeedback | null;
  language: string;
  met: Objective[];
}) {
  const t = useExtracted();
  const phrases = feedback?.wentWell ?? [];

  return (
    <StepCard>
      <StepTitle>{t("What went well")}</StepTitle>

      {met.length > 0 && (
        <StepRows aria-label={t("Goals of the call")}>
          {met.map((objective) => (
            <CheckRow done key={objective.label} language={language}>
              {objective.label}
            </CheckRow>
          ))}
        </StepRows>
      )}

      {phrases.length > 0 && (
        <section aria-labelledby="went-well" className="flex w-full flex-col gap-2 text-left">
          <h2 className="text-muted-foreground text-sm font-medium" id="went-well">
            {t("Phrases you said well")}
          </h2>
          <ul className="flex flex-col gap-2">
            {phrases.map((phrase) => (
              <li className="font-medium" key={phrase}>
                <q lang={language}>{phrase}</q>
              </li>
            ))}
          </ul>
        </section>
      )}
    </StepCard>
  );
}

/** A word to practice saying: how it sounds in the learner's spelling, a tip and its sound. */
function PronunciationTip({
  item,
  language,
}: {
  item: CallFeedback["pronunciation"][number];
  language: string;
}) {
  return (
    <StepRow className="justify-between">
      <span className="flex min-w-0 flex-col gap-0.5">
        <span>
          <span className="font-medium" lang={language}>
            {item.word}
          </span>{" "}
          <span className="text-muted-foreground">{item.respelling}</span>
        </span>
        <span className="text-muted-foreground">
          <ItemLine text={item.tip} />
        </span>
      </span>
      <SpeakButton language={language} text={item.word} />
    </StepRow>
  );
}

/** One thing to say better (with its sound), the goals still to get across and words to practice. */
function ImproveStep({
  feedback,
  language,
  missed,
}: {
  feedback: CallFeedback | null;
  language: string;
  missed: Objective[];
}) {
  const t = useExtracted();
  const improve = feedback?.improve ?? null;
  const pronunciation = feedback?.pronunciation ?? [];

  return (
    <StepCard>
      <StepTitle>{t("To improve")}</StepTitle>

      {improve && (
        <div className="bg-muted/50 flex w-full flex-col gap-2 rounded-2xl p-4 text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <p className="text-muted-foreground line-through" lang={language}>
                <span className="sr-only">{t("You said:")} </span>
                {improve.said}
              </p>
              <p className="text-lg font-semibold" lang={language}>
                <span className="sr-only">{t("Better:")} </span>
                {improve.better}
              </p>
            </div>
            <SpeakButton language={language} text={improve.better} />
          </div>
          <p className="text-muted-foreground text-sm">{improve.why}</p>
        </div>
      )}

      {missed.length > 0 && (
        <StepRows aria-label={t("Goals still to get across")}>
          {missed.map((objective) => (
            <CheckRow done={false} key={objective.label} language={language}>
              {objective.label}
            </CheckRow>
          ))}
        </StepRows>
      )}

      {pronunciation.length > 0 && (
        <section aria-labelledby="pronunciation" className="flex w-full flex-col gap-2 text-left">
          <h2 className="text-muted-foreground text-sm font-medium" id="pronunciation">
            {t("Words to practice saying")}
          </h2>
          <StepRows>
            {pronunciation.map((item) => (
              <PronunciationTip item={item} key={item.word} language={language} />
            ))}
          </StepRows>
        </section>
      )}
    </StepCard>
  );
}

/**
 * After a call, one thing at a time: the stars (and whether a checkpoint was passed) with what the
 * call came to, what went well (the goals got across, the phrases said well), then what to
 * improve: one better way to say something, with its sound, the goals still missing and words to
 * practice. A lost checkpoint costs nothing and comes back.
 */
export function ConversationResult({
  conversation,
  exitHref,
  nextHref,
  result,
}: {
  conversation: LanguageConversationView;
  exitHref: string;
  nextHref: string;
  result: Result;
}) {
  const t = useExtracted();
  const feedback = result.feedback?.kind === "call" ? result.feedback : null;
  const language = conversation.targetLanguage;
  const met = conversation.objectives.filter((objective) => objective.met);
  const missed = conversation.objectives.filter((objective) => !objective.met);
  const wentWell = met.length > 0 || (feedback?.wentWell.length ?? 0) > 0;

  const toImprove =
    missed.length > 0 || Boolean(feedback?.improve) || (feedback?.pronunciation.length ?? 0) > 0;

  const items: StepsItem[] = [
    {
      content: <StarsStep conversation={conversation} feedback={feedback} result={result} />,
      id: "stars",
    },
    wentWell && {
      content: <WentWellStep feedback={feedback} language={language} met={met} />,
      id: "wentWell",
    },
    toImprove && {
      content: <ImproveStep feedback={feedback} language={language} missed={missed} />,
      id: "improve",
    },
  ].filter((item) => item !== false);

  return (
    <Steps
      exitHref={exitHref}
      finalAction={<TaskMainLink href={nextHref}>{t("Continue")}</TaskMainLink>}
      items={items}
    />
  );
}
