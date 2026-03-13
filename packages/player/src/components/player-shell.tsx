"use client";

import { useExtracted } from "next-intl";
import { usePlayer } from "../player-context";
import { InPlayStickyHeader } from "./in-play-sticky-header";
import { PlayerBottomBar, PlayerBottomBarAction, PlayerBottomBarNav } from "./player-bottom-bar";
import { PlayerCloseLink, PlayerHeader } from "./player-header";
import { PlayerStage } from "./player-stage";
import { StageContent } from "./stage-content";

export function PlayerShell() {
  const t = useExtracted();
  const {
    check,
    completionResult,
    continue: handleContinue,
    currentResult,
    currentStep,
    currentStepIndex,
    dimensions,
    hasAnswer,
    isCompleted,
    isFirstStep,
    isIntro,
    isStaticStep,
    lessonHref,
    navigateNext,
    navigatePrev,
    nextActivityHref,
    phase,
    progressValue,
    restart,
    results,
    selectAnswer,
    selectedAnswer,
    showBottomBar,
    showHeader,
    startChallenge,
    totalSteps,
  } = usePlayer();

  const hasDimensions = Object.keys(dimensions).length > 0;
  const buttonLabel = phase === "feedback" ? t("Continue") : t("Check");

  return (
    <main className="flex h-dvh flex-col overflow-hidden">
      {isIntro && (
        <div className="bg-background/95 sticky top-0 z-30 backdrop-blur-sm">
          <PlayerHeader>
            <PlayerCloseLink href={lessonHref} />
            <div className="size-9" aria-hidden="true" />
          </PlayerHeader>
        </div>
      )}

      {showHeader && (
        <InPlayStickyHeader
          currentStepIndex={currentStepIndex}
          dimensions={dimensions}
          hasDimensions={hasDimensions}
          lessonHref={lessonHref}
          progressValue={progressValue}
          totalSteps={totalSteps}
        />
      )}

      <PlayerStage isStatic={isStaticStep && phase === "playing"} phase={phase}>
        <StageContent
          completionResult={completionResult}
          currentResult={currentResult}
          currentStep={currentStep}
          currentStepIndex={currentStepIndex}
          dimensions={dimensions}
          isCompleted={isCompleted}
          isFirst={isFirstStep}
          lessonHref={lessonHref}
          nextActivityHref={nextActivityHref}
          onNavigateNext={navigateNext}
          onNavigatePrev={navigatePrev}
          onRestart={restart}
          onSelectAnswer={selectAnswer}
          onStartChallenge={startChallenge}
          phase={phase}
          results={results}
          selectedAnswer={selectedAnswer}
        />
      </PlayerStage>

      {showBottomBar && (
        <PlayerBottomBar className={isStaticStep ? "lg:hidden" : undefined}>
          {isStaticStep ? (
            <PlayerBottomBarNav
              isFirstStep={isFirstStep}
              onNavigateNext={navigateNext}
              onNavigatePrev={navigatePrev}
            />
          ) : (
            <PlayerBottomBarAction
              disabled={phase === "playing" && !hasAnswer}
              onClick={phase === "feedback" ? handleContinue : check}
            >
              {buttonLabel}
            </PlayerBottomBarAction>
          )}
        </PlayerBottomBar>
      )}
    </main>
  );
}
