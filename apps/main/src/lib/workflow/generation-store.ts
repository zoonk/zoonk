export type StepStatus = "started" | "completed" | "error";
export type GenerationStatus = "idle" | "triggering" | "streaming" | "completed" | "error";

export type StreamMessage<TStep extends string = string> = {
  reason?: string;
  step: TStep;
  status: StepStatus;
};

export type GenerationState<TStep extends string = string> = {
  completedSteps: TStep[];
  currentStep: TStep | null;
  error: string | null;
  runId: string | null;
  startedSteps: TStep[];
  status: GenerationStatus;
};

export type GenerationAction<TStep extends string = string> =
  | { type: "reset" }
  | { type: "setError"; error: string }
  | { type: "stepCompleted"; step: TStep }
  | { type: "stepStarted"; step: TStep }
  | { type: "triggerStart" }
  | { type: "triggerSuccess"; runId: string }
  | { type: "workflowCompleted" };

export function initialGenerationState<TStep extends string = string>(
  overrides?: Partial<GenerationState<TStep>>,
): GenerationState<TStep> {
  return {
    completedSteps: [] as TStep[],
    currentStep: null,
    error: null,
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
    case "triggerStart":
      return { ...state, error: null, status: "triggering" };
    case "triggerSuccess":
      return { ...state, runId: action.runId, status: "streaming" };
    case "workflowCompleted":
      return state.status === "error" ? state : { ...state, status: "completed" };
    default: {
      const exhaustiveCheck: never = action;
      throw new Error(`Unexpected action: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
}

export function handleStreamMessage<TStep extends string>(
  message: StreamMessage<TStep>,
  dispatch: (action: GenerationAction<TStep>) => void,
  completionStep?: TStep,
) {
  switch (message.status) {
    case "started":
      dispatch({ step: message.step, type: "stepStarted" });
      break;
    case "completed":
      dispatch({ step: message.step, type: "stepCompleted" });
      if (completionStep && message.step === completionStep) {
        dispatch({ type: "workflowCompleted" });
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
