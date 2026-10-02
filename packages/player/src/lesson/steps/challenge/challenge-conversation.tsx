"use client";

import { type ChallengeStep } from "@zoonk/core/library/challenges/graph";
import { getChallengeMeters } from "@zoonk/core/library/challenges/run";
import { getScrollBehavior } from "@zoonk/ui/lib/scroll-behavior";
import { useExtracted } from "next-intl";
import { useEffect, useRef } from "react";
import {
  PlayerChoiceSceneOptionText,
  PlayerChoiceSceneOptions,
} from "../../../components/player-choice-scene";
import { PlayerReadScene } from "../../../components/player-read-scene";
import { LessonRichText } from "../../_components/lesson-rich-text";
import { type ChallengeProgress } from "../../_utils/challenge-progress";
import { type StepOf } from "../lesson-step-view-props";
import { ChallengeEffectsView, ChallengeMeters } from "./challenge-meters";
import {
  ChallengeLabel,
  ChallengeMessageView,
  ChallengePickView,
  ChallengeTimeJump,
} from "./challenge-parts";
import { type ChallengeNames } from "./use-challenge-names";

type ChallengeContent = StepOf<"challenge">["content"];
type PlayingProgress = Exclude<ChallengeProgress, { stage: "intro" }>;

/** One decision already taken: what was said, the learner's pick, the replies and any time jump. */
function ChallengeTurn({
  content,
  names,
  step,
}: {
  content: ChallengeContent;
  names: ChallengeNames;
  step: ChallengeStep;
}) {
  const { choice, node } = step;
  const slots = content.team;

  return (
    <>
      {node.messages.map((message, index) => (
        <ChallengeMessageView
          key={`${node.id}-message-${String(index)}`}
          message={message}
          names={names}
          slots={slots}
        />
      ))}
      <ChallengePickView text={names.fill(choice.text)} />
      <ChallengeEffectsView choice={choice} fill={names.fill} meters={content.meters} />
      {choice.replies.map((reply, index) => (
        <ChallengeMessageView
          key={`${node.id}-reply-${String(index)}`}
          message={reply}
          names={names}
          slots={slots}
        />
      ))}
      {choice.timeJump && <ChallengeTimeJump fill={names.fill} jump={choice.timeJump} />}
    </>
  );
}

function ChallengeDecision({
  isLocked,
  names,
  onPick,
  progress,
}: {
  isLocked: boolean;
  names: ChallengeNames;
  onPick: (choiceId: string | null) => void;
  progress: Extract<PlayingProgress, { stage: "deciding" }>;
}) {
  const t = useExtracted();
  const { node } = progress.walk;

  return (
    <div className="flex flex-col gap-3" data-slot="challenge-decision">
      <h3 className="text-foreground text-lg font-semibold" id={`challenge-prompt-${node.id}`}>
        <LessonRichText text={names.fill(node.prompt)} />
      </h3>

      <PlayerChoiceSceneOptions
        ariaLabel={t("Your options")}
        keyboardEnabled={!isLocked}
        onSelect={(index) => {
          const choice = node.choices[index];

          if (choice && !isLocked) {
            onPick(choice.id === progress.pendingChoiceId ? null : choice.id);
          }
        }}
        options={node.choices.map((choice) => ({
          content: (
            <PlayerChoiceSceneOptionText>
              <LessonRichText text={names.fill(choice.text)} />
            </PlayerChoiceSceneOptionText>
          ),
          disabled: isLocked,
          isDimmed: progress.pendingChoiceId !== null && progress.pendingChoiceId !== choice.id,
          isSelected: progress.pendingChoiceId === choice.id,
          key: choice.id,
        }))}
      />
    </div>
  );
}

/** Keeps the newest part of the case in view as the conversation grows. */
function useNewestInView(count: number) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (count === 0) {
      return;
    }

    ref.current?.scrollIntoView({ behavior: getScrollBehavior(), block: "nearest" });
  }, [count]);

  return ref;
}

/**
 * The case as a conversation at work: what the decisions moved so far, what the team said, each
 * pick with its replies and time jumps, then the decision on screen (number keys pick, Confirm
 * sends) or, once the path ends, what happened.
 */
export function ChallengeConversation({
  content,
  isLocked,
  names,
  onPick,
  progress,
}: {
  content: ChallengeContent;
  isLocked: boolean;
  names: ChallengeNames;
  onPick: (choiceId: string | null) => void;
  progress: PlayingProgress;
}) {
  const t = useExtracted();
  const { steps } = progress.walk;
  const newest = useNewestInView(steps.length);

  return (
    <PlayerReadScene className="items-stretch gap-5 sm:gap-5">
      <ChallengeMeters
        fill={names.fill}
        hasMoved={steps.length > 0}
        meters={getChallengeMeters(content, steps)}
      />

      <div aria-label={t("Conversation")} role="log">
        <ol className="flex flex-col gap-4">
          {steps.map((step) => (
            <ChallengeTurn content={content} key={step.node.id} names={names} step={step} />
          ))}

          {progress.stage === "deciding" &&
            progress.walk.node.messages.map((message, index) => (
              <ChallengeMessageView
                key={`${progress.walk.node.id}-message-${String(index)}`}
                message={message}
                names={names}
                slots={content.team}
              />
            ))}
        </ol>
      </div>

      <div className="scroll-mb-32" ref={newest}>
        {progress.stage === "deciding" ? (
          <ChallengeDecision
            isLocked={isLocked}
            names={names}
            onPick={onPick}
            progress={progress}
          />
        ) : (
          <section
            aria-labelledby="challenge-outcome"
            className="bg-muted/50 flex flex-col gap-2 rounded-2xl p-4"
            data-slot="challenge-outcome"
          >
            <ChallengeLabel as="h3" id="challenge-outcome">
              {t("What happened")}
            </ChallengeLabel>
            <p className="text-foreground text-base leading-relaxed">
              <LessonRichText text={names.fill(progress.walk.ending.outcome)} />
            </p>
          </section>
        )}
      </div>
    </PlayerReadScene>
  );
}
