import { type StepStreamMessage } from "@zoonk/core/workflows/steps";

export type GenerationStatus = "idle" | "triggering" | "streaming" | "completed" | "error";

export type GenerationState<TStep extends string = string> = {
  completedSteps: TStep[];
  currentStep: TStep | null;
  error: string | null;
  reconnectCount: number;
  runId: string | null;
  startedSteps: TStep[];
  status: GenerationStatus;
};

export type GenerationAction<TStep extends string = string> =
  | { type: "reconnect" }
  | { type: "reset" }
  | { type: "setError"; error: string }
  | { type: "stepCompleted"; step: TStep }
  | { type: "stepStarted"; step: TStep }
  | { type: "streamEnded"; completionStep?: TStep }
  | { type: "triggerStart" }
  | { type: "triggerSuccess"; runId: string };

export function initialGenerationState<TStep extends string = string>(
  overrides?: Partial<GenerationState<TStep>>,
): GenerationState<TStep> {
  return {
    completedSteps: [] as TStep[],
    currentStep: null,
    error: null,
    reconnectCount: 0,
    runId: null,
    startedSteps: [] as TStep[],
    status: "idle",
    ...overrides,
  };
}

export function generationReducer<TStep extends string>(
  state: GenerationState<TStep>,
  action: GenerationAction<TStep>,
): GenerationState<TStep> {
  switch (action.type) {
    case "reconnect":
      return { ...state, reconnectCount: state.reconnectCount + 1 };
    case "reset":
      return initialGenerationState<TStep>();
    case "setError":
      return { ...state, error: action.error, status: "error" };
    case "stepCompleted":
      return {
        ...state,
        completedSteps: state.completedSteps.includes(action.step)
          ? state.completedSteps
          : [...state.completedSteps, action.step],
        currentStep: state.currentStep === action.step ? null : state.currentStep,
      };
    case "stepStarted":
      return {
        ...state,
        currentStep: action.step,
        startedSteps: state.startedSteps.includes(action.step)
          ? state.startedSteps
          : [...state.startedSteps, action.step],
      };
    case "streamEnded":
      if (state.status === "completed" || state.status === "error") {
        return state;
      }
      if (action.completionStep && !state.completedSteps.includes(action.completionStep)) {
        return {
          ...state,
          error: "Generation ended unexpectedly. Please try again.",
          status: "error",
        };
      }
      return { ...state, status: "completed" };

    case "triggerStart":
      return { ...state, error: null, status: "triggering" };
    case "triggerSuccess":
      return { ...state, runId: action.runId, status: "streaming" };
    default: {
      const exhaustiveCheck: never = action;
      throw new Error(`Unexpected action: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
}

export function handleStepStreamMessage<TStep extends string>(params: {
  completionStep?: TStep;
  dispatch: (action: GenerationAction<TStep>) => void;
  entityId?: number;
  message: StepStreamMessage<TStep>;
}) {
  const { completionStep, dispatch, entityId, message } = params;

  switch (message.status) {
    case "started":
      dispatch({ step: message.step, type: "stepStarted" });
      break;
    case "completed":
      dispatch({ step: message.step, type: "stepCompleted" });
      if (completionStep && message.step === completionStep) {
        const entityMatches = entityId === undefined || message.entityId === entityId;

        if (entityMatches) {
          dispatch({ completionStep, type: "streamEnded" });
        }
      }
      break;
    case "error": {
      const errorMessage = message.reason
        ? `${message.step}: ${message.reason}`
        : `Step "${message.step}" failed`;
      dispatch({ error: errorMessage, type: "setError" });
      break;
    }
    default: {
      const exhaustiveCheck: never = message.status;
      throw new Error(`Unexpected status: ${String(exhaustiveCheck)}`);
    }
  }
}
