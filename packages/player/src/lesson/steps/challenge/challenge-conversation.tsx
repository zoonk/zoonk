"use client";

import { getChallengeMeters } from "@zoonk/core/library/challenges/run";
import { QuestionTitle } from "@zoonk/learn/question-title";
import { LessonVisual } from "@zoonk/learn/visual";
import { getScrollBehavior } from "@zoonk/ui/lib/scroll-behavior";
import { useExtracted } from "next-intl";
import { type Ref, useEffect, useRef } from "react";
import {
  PlayerChoiceSceneOptionText,
  PlayerChoiceSceneOptions,
} from "../../../components/player-choice-scene";
import { PlayerReadScene } from "../../../components/player-read-scene";
import { LessonRichText } from "../../_components/lesson-rich-text";
import { type ChallengeProgress } from "../../_utils/challenge-progress";
import { type StepOf } from "../lesson-step-view-props";
import { ChallengeEffectsView, ChallengeMeters } from "./challenge-meters";
import { ChallengeMessageView, ChallengePickView, ChallengeTimeJump } from "./challenge-parts";
import { type ChallengeNames } from "./use-challenge-names";

type ChallengeContent = StepOf<"challenge">["content"];
type ChallengeNode = ChallengeContent["nodes"][number];
type ChallengeChoice = ChallengeNode["choices"][number];
type PlayingProgress = Exclude<ChallengeProgress, { stage: "intro" }>;

function ChallengeTurn({
  choice,
  content,
  names,
  node,
  visualRef,
}: {
  choice: ChallengeChoice | null;
  content: ChallengeContent;
  names: ChallengeNames;
  node: ChallengeNode;
  visualRef?: Ref<HTMLLIElement>;
}) {
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
      {node.visual && (
        <li className="scroll-mt-4" data-slot="challenge-visual" ref={visualRef}>
          <LessonVisual visual={node.visual} />
        </li>
      )}
      {choice && (
        <>
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
      )}
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
    <div className="flex flex-col gap-4" data-slot="challenge-decision">
      <div id={`challenge-prompt-${node.id}`}>
        <QuestionTitle text={names.fill(node.prompt)} />
      </div>

      <PlayerChoiceSceneOptions
        ariaLabel={t("Your options")}
        isLocked={isLocked}
        onSelect={(id) => onPick(id === progress.pendingChoiceId ? null : id)}
        options={node.choices.map((choice) => ({
          content: (
            <PlayerChoiceSceneOptionText>
              <LessonRichText text={names.fill(choice.text)} />
            </PlayerChoiceSceneOptionText>
          ),
          isCorrect: false,
          key: choice.id,
        }))}
        selectedKey={progress.pendingChoiceId}
      />
    </div>
  );
}

/**
 * Brings the new decision into view. When it shows a chart, the chart and the decision under it
 * come into view together when they fit, and the chart's top when they don't.
 */
function useNewestInView(count: number) {
  const decisionRef = useRef<HTMLDivElement>(null);
  const visualRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    const decision = decisionRef.current;
    const visual = visualRef.current;

    if (count === 0 || !decision) {
      return;
    }

    if (visual) {
      const below = decision.getBoundingClientRect().bottom - visual.getBoundingClientRect().bottom;
      const margin = getComputedStyle(decision).scrollMarginBottom;
      visual.style.scrollMarginBottom = `calc(${String(below)}px + ${margin})`;
    }

    (visual ?? decision).scrollIntoView({ behavior: getScrollBehavior(), block: "nearest" });
  }, [count]);

  return { decisionRef, visualRef };
}

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
  const { decisionRef, visualRef } = useNewestInView(steps.length);

  const turns = [
    ...steps,
    ...(progress.stage === "deciding" ? [{ choice: null, node: progress.walk.node }] : []),
  ];

  return (
    <PlayerReadScene className="items-stretch gap-5 sm:gap-5">
      <ChallengeMeters
        fill={names.fill}
        hasMoved={steps.length > 0}
        meters={getChallengeMeters(content, steps)}
      />

      <div aria-label={t("Conversation")} role="log">
        <ol className="flex flex-col gap-4">
          {turns.map((turn) => (
            <ChallengeTurn
              choice={turn.choice}
              content={content}
              key={turn.node.id}
              names={names}
              node={turn.node}
              visualRef={turn.choice ? undefined : visualRef}
            />
          ))}
        </ol>
      </div>

      <div className="scroll-mb-32" ref={decisionRef}>
        {progress.stage === "deciding" ? (
          <ChallengeDecision
            isLocked={isLocked}
            names={names}
            onPick={onPick}
            progress={progress}
          />
        ) : null}
      </div>
    </PlayerReadScene>
  );
}
