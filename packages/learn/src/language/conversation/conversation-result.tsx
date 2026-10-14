"use client";

import {
  type CallFeedback,
  type LanguageConversationView,
} from "@zoonk/core/language/conversations/contract";
import { type MissionMomentView } from "@zoonk/core/sessions/completion-contract";
import { useExtracted } from "next-intl";
import { DiffLines } from "../../_components/diff-lines";
import { StepCard, StepTitle } from "../../_components/step-card";
import { Steps, type StepsItem } from "../../_components/steps";
import { ItemLine } from "../../questions/item-text";
import { TaskMainLink } from "../../shell/task-frame";
import { ChecklistRow, ChecklistRows } from "../checklist-rows";
import { StarsStep } from "./call-stars-step";
import { SpeakButton } from "./conversation-parts";
import { ResultGroup, ResultRow, ResultRows } from "./result-rows";

type Result = NonNullable<LanguageConversationView["result"]>;

type Objective = LanguageConversationView["objectives"][number];

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
        <ChecklistRows aria-label={t("Goals of the call")}>
          {met.map((objective) => (
            <ChecklistRow done key={objective.label} lang={language}>
              {objective.label}
            </ChecklistRow>
          ))}
        </ChecklistRows>
      )}

      {phrases.length > 0 && (
        <ResultGroup id="went-well" label={t("Phrases you said well")}>
          <ResultRows>
            {phrases.map((phrase) => (
              <ResultRow className="font-medium" key={phrase}>
                <q lang={language}>{phrase}</q>
              </ResultRow>
            ))}
          </ResultRows>
        </ResultGroup>
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
    <ResultRow>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span>
          <span className="font-medium" lang={language}>
            {item.word}
          </span>{" "}
          <span className="text-muted-foreground font-mono text-xs">{item.respelling}</span>
        </span>
        <span className="text-muted-foreground text-pretty">
          <ItemLine text={item.tip} />
        </span>
      </span>
      <SpeakButton language={language} text={item.word} />
    </ResultRow>
  );
}

/**
 * One thing to say better, as a change: what was said on a red line, the better way on a green
 * one, then why, with the better way's sound beside it.
 */
function BetterWay({
  improve,
  language,
}: {
  improve: NonNullable<CallFeedback["improve"]>;
  language: string;
}) {
  const t = useExtracted();

  return (
    <div className="flex w-full flex-col gap-2 text-left">
      <div lang={language}>
        <DiffLines
          labels={{ added: t("Better"), removed: t("You said") }}
          lines={[
            { kind: "removed", text: improve.said },
            { kind: "added", text: improve.better },
          ]}
        />
      </div>
      <div className="flex items-start justify-between gap-3">
        <p className="text-muted-foreground text-[0.8125rem] leading-snug text-pretty">
          {improve.why}
        </p>
        <SpeakButton language={language} personal text={improve.better} />
      </div>
    </div>
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

      {improve && <BetterWay improve={improve} language={language} />}

      {missed.length > 0 && (
        <ChecklistRows aria-label={t("Goals still to get across")}>
          {missed.map((objective) => (
            <ChecklistRow done={false} key={objective.label} lang={language}>
              {objective.label}
            </ChecklistRow>
          ))}
        </ChecklistRows>
      )}

      {pronunciation.length > 0 && (
        <ResultGroup id="pronunciation" label={t("Words to practice saying")}>
          <ResultRows>
            {pronunciation.map((item) => (
              <PronunciationTip item={item} key={item.word} language={language} />
            ))}
          </ResultRows>
        </ResultGroup>
      )}
    </StepCard>
  );
}

/**
 * After a call, one thing at a time: the stars (and whether a checkpoint was passed) with what the
 * call came to and what it did to the day's missions, what went well (the goals got across, the phrases said well), then what to
 * improve: one better way to say something, with its sound, the goals still missing and words to
 * practice. A lost checkpoint costs nothing and shows whether another try needs Plus.
 */
export function ConversationResult({
  conversation,
  exitHref,
  missionMoment,
  nextHref,
  result,
}: {
  conversation: LanguageConversationView;
  exitHref: string;
  /** What the call just did to the day's missions; null when it did nothing or was opened later. */
  missionMoment: MissionMomentView | null;
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
      content: (
        <StarsStep
          conversation={conversation}
          feedback={feedback}
          missionMoment={missionMoment}
          result={result}
        />
      ),
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
