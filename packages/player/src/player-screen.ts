import { type PlayerState } from "./player-reducer";
import { type PlayerStepDescriptor, describePlayerStep } from "./player-step";
import {
  getPlayerStepBehavior,
  getPlayerStepScene,
  hasFeedbackScreen,
  hasStaticNavigation,
} from "./player-step-behavior";
import { canNavigatePrev as getCanNavigatePrev } from "./step-navigation";

type PlayerPrimaryActionKind = "begin" | "check" | "continue";
type PlayerPrimaryActionRun = "check" | "continue" | "navigateNext";
type InPlayScreenScene = "choice" | "feedback" | "read";

type PlayerBottomBarModel =
  | {
      canNavigatePrev: boolean;
      kind: "navigation";
    }
  | {
      button: PlayerPrimaryActionKind;
      disabled: boolean;
      kind: "primaryAction";
      run: PlayerPrimaryActionRun;
    };

export type PlayerKeyboardModel = {
  canRestart: boolean;
  enterAction: "check" | "continue" | "navigateNext" | "nextOrEscape" | null;
  leftAction: "navigatePrev" | null;
  rightAction: "navigateNext" | null;
};

type InPlayScreenModel = {
  bottomBar: PlayerBottomBarModel;
  canNavigatePrev: boolean;
  keyboard: PlayerKeyboardModel;
  scene: InPlayScreenScene;
  showChrome: true;
  stageIsFullBleed: boolean;
  stageIsStatic: boolean;
  step: PlayerStepDescriptor;
};

export type PlayerCompletedScreenModel = {
  bottomBar: null;
  keyboard: PlayerKeyboardModel;
  kind: "completed";
  scene: "completion";
  showChrome: false;
  stageIsFullBleed: false;
  stageIsStatic: false;
};

export type PlayerFeedbackScreenModel = InPlayScreenModel & {
  kind: "feedbackScreen";
  scene: "feedback";
};

export type PlayerStepScreenModel = InPlayScreenModel & {
  kind: "step";
};

export type PlayerScreenModel =
  | PlayerCompletedScreenModel
  | PlayerFeedbackScreenModel
  | PlayerStepScreenModel;

/**
 * A completed player only exposes completion controls. Keeping this in a
 * helper lets the main screen model focus on active play and gives the
 * keyboard hook a consistent shape even when there is no current step.
 */
function getCompletedScreenModel(): PlayerCompletedScreenModel {
  return {
    bottomBar: null,
    keyboard: {
      canRestart: true,
      enterAction: "nextOrEscape",
      leftAction: null,
      rightAction: null,
    },
    kind: "completed",
    scene: "completion",
    showChrome: false,
    stageIsFullBleed: false,
    stageIsStatic: false,
  };
}

/**
 * The bottom bar is the clearest description of the player's current control
 * mode. Building it in one place prevents shell and keyboard code from
 * independently re-deriving which action should be active.
 */
function getBottomBarModel({
  canMovePrev,
  hasAnswer,
  phase,
  step,
}: {
  canMovePrev: boolean;
  hasAnswer: boolean;
  phase: PlayerState["phase"];
  step: PlayerStepDescriptor;
}): PlayerBottomBarModel {
  const behavior = getPlayerStepBehavior(step);

  if (!behavior) {
    return { canNavigatePrev: canMovePrev, kind: "navigation" };
  }

  if (phase === "feedback") {
    return {
      button: "continue",
      disabled: false,
      kind: "primaryAction",
      run: "continue",
    };
  }

  if (step.kind === "intro") {
    return {
      button: "begin",
      disabled: false,
      kind: "primaryAction",
      run: "navigateNext",
    };
  }

  if (behavior.layout === "navigable") {
    return { canNavigatePrev: canMovePrev, kind: "navigation" };
  }

  return {
    button: "check",
    disabled: !hasAnswer,
    kind: "primaryAction",
    run: "check",
  };
}

/**
 * Keyboard shortcuts should mirror the same control mode shown in the bottom
 * bar. Deriving them from the screen model avoids subtle drift where the UI
 * shows one action but Enter or arrow keys trigger another.
 */
function getKeyboardModel({
  bottomBar,
  canMovePrev,
  phase,
  step,
}: {
  bottomBar: PlayerBottomBarModel;
  canMovePrev: boolean;
  phase: PlayerState["phase"];
  step: PlayerStepDescriptor;
}): PlayerKeyboardModel {
  if (phase === "completed") {
    return {
      canRestart: true,
      enterAction: "nextOrEscape",
      leftAction: null,
      rightAction: null,
    };
  }

  const enterAction =
    bottomBar.kind === "primaryAction" && !bottomBar.disabled ? bottomBar.run : null;
  const behavior = getPlayerStepBehavior(step);

  return {
    canRestart: false,
    enterAction,
    leftAction: phase === "playing" && canMovePrev ? "navigatePrev" : null,
    rightAction: phase === "playing" && behavior?.layout === "navigable" ? "navigateNext" : null,
  };
}

/**
 * Reduces the player's screen routing to a small set of UI scenes.
 *
 * This lets the shell think in broad layouts like read, choice, feedback, and
 * completion without making the shell inspect each concrete step kind.
 */
function getPlayerScreenScene({
  phase,
  step,
}: {
  phase: PlayerState["phase"];
  step: PlayerStepDescriptor;
}): InPlayScreenScene {
  if (phase === "feedback") {
    return "feedback";
  }

  return getPlayerStepScene(step) ?? "read";
}

/**
 * Returns the player's canonical screen model from raw reducer state.
 *
 * This is the shared UI/control source of truth for shell layout, keyboard
 * shortcuts, and stage routing. Callers should prefer this over rebuilding
 * screen mode from scattered booleans.
 */
export function getPlayerScreenModel(state: PlayerState): PlayerScreenModel {
  if (state.phase === "completed") {
    return getCompletedScreenModel();
  }

  const currentStep = state.steps[state.currentStepIndex];

  if (!currentStep) {
    return getCompletedScreenModel();
  }

  const step = describePlayerStep(currentStep);

  if (!step) {
    return getCompletedScreenModel();
  }

  const hasAnswer = Boolean(state.selectedAnswers[currentStep.id]);

  const canMovePrev = getCanNavigatePrev({
    currentStepIndex: state.currentStepIndex,
    steps: state.steps,
  });

  const bottomBar = getBottomBarModel({
    canMovePrev,
    hasAnswer,
    phase: state.phase,
    step,
  });

  const keyboard = getKeyboardModel({
    bottomBar,
    canMovePrev,
    phase: state.phase,
    step,
  });

  const scene = getPlayerScreenScene({ phase: state.phase, step });
  const behavior = getPlayerStepBehavior(step);

  const model = {
    bottomBar,
    canNavigatePrev: canMovePrev,
    keyboard,
    scene,
    showChrome: true as const,
    stageIsFullBleed: behavior?.layout === "hero",
    stageIsStatic: state.phase === "playing" && hasStaticNavigation(step),
    step,
  };

  if (state.phase === "feedback" && hasFeedbackScreen(step)) {
    return { ...model, kind: "feedbackScreen", scene: "feedback" };
  }

  return { ...model, kind: "step" };
}
