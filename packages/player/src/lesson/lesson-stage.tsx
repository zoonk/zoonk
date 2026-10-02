"use client";

import { LineMarker } from "@zoonk/ui/components/line-marker";
import { PencilIcon, RotateCcwIcon, ZapIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { PlayerContentFrame } from "../components/step-layouts";
import { LessonCitation } from "./_components/lesson-citation";
import { LessonEyebrow } from "./_components/lesson-step-text";
import { isLanguageStep } from "./_utils/lesson-steps";
import { MissedIdeaHelp } from "./controls/simpler-offer";
import { LessonResultNotes } from "./feedback/lesson-result-notes";
import { LessonStepResultView } from "./feedback/lesson-step-result";
import { useLessonPlayer, useLessonPlayerConfig } from "./lesson-player-context";
import { LessonStepView, showsOwnResult } from "./steps/lesson-step-view";

/** "I know this" in progress, a language answer to fix first, or back after a missed quick check. */
function LessonNotice() {
  const t = useExtracted();
  const { screen, state } = useLessonPlayer();

  if (screen.quickCheck) {
    return (
      <PlayerContentFrame className="pt-4">
        <LessonEyebrow icon={<ZapIcon aria-hidden="true" />}>
          {t("Quick check · {current} of {total}", {
            current: String(screen.quickCheck.current + 1),
            total: String(screen.quickCheck.total),
          })}
        </LessonEyebrow>
      </PlayerContentFrame>
    );
  }

  if (state.notice === "selfCorrect") {
    return (
      <PlayerContentFrame className="pt-4">
        <p className="text-muted-foreground flex items-start gap-2 text-sm" role="status">
          <LineMarker>
            <PencilIcon aria-hidden="true" className="size-4" />
          </LineMarker>
          {t("Not quite. Look again and fix it yourself, then check.")}
        </p>
      </PlayerContentFrame>
    );
  }

  if (state.notice === "quickCheckMissed") {
    return (
      <PlayerContentFrame className="pt-4">
        <p className="text-muted-foreground flex items-start gap-2 text-sm" role="status">
          <LineMarker>
            <RotateCcwIcon aria-hidden="true" className="size-4" />
          </LineMarker>
          {t("Let's go through it together. What you got right still counts.")}
        </p>
      </PlayerContentFrame>
    );
  }

  return null;
}

/** First-try right answers at the end of the lesson so far, for the companion's cheers. */
function countRightInARow(firstVerdicts: Record<string, boolean>): number {
  const verdicts = Object.values(firstVerdicts);
  const lastWrong = verdicts.lastIndexOf(false);

  return verdicts.length - lastWrong - 1;
}

/** The screen in view and, after a check, its result, laid out by the skin. */
export function LessonStage() {
  const { actions, screen, state } = useLessonPlayer();
  const { skin, slots } = useLessonPlayerConfig();
  const { Screen } = skin;
  const { step } = screen;

  if (!step) {
    return null;
  }

  const result = state.results[step.id];

  const view = (
    <LessonStepView
      answer={state.answers[step.id]}
      isLocked={state.phase !== "playing"}
      key={`${step.id}-${state.position}`}
      onAnswer={(answer) => actions.selectAnswer(step.id, answer)}
      result={result}
      step={step}
    />
  );

  const willReturn = Boolean(
    result && !result.isCorrect && state.queue.includes(step.id, state.position + 1),
  );

  return (
    <Screen
      companion={slots.companion?.({
        position: state.position,
        result:
          state.phase === "feedback" && result
            ? { isCorrect: result.isCorrect, isGuess: step.kind === "hook" }
            : null,
        rightInARow: countRightInARow(state.firstVerdicts),
      })}
      feedback={
        state.phase === "feedback" && result
          ? {
              isCorrect: result.isCorrect,
              notes: (
                <div className="flex flex-col gap-2">
                  <LessonResultNotes
                    nextReviewAt={result.nextReviewAt}
                    savedMistake={result.savedMistake && !result.isCorrect}
                    willReturn={willReturn}
                  />
                  {screen.simplerOffer && <MissedIdeaHelp step={screen.simplerOffer} />}
                </div>
              ),
              result: showsOwnResult(step) ? null : (
                <LessonStepResultView result={result} step={step} />
              ),
            }
          : null
      }
      question={
        <>
          {/* Right above the question it's about, not floating at the top of the screen. */}
          <LessonNotice />
          {view}
          {!isLanguageStep(step) && <LessonCitation citation={step.citation} />}
        </>
      }
    />
  );
}
