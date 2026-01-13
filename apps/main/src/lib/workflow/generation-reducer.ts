type StepStatus = "started" | "completed" | "error";

export type StreamMessage<TStep extends string = string> = {
  step: TStep;
  status: StepStatus;
};

export type GenerationState<TStep extends string> = {
  completedSteps: TStep[];
  currentStep: TStep | null;
  error: string | null;
  runId: string | null;
  status: "idle" | "triggering" | "streaming" | "completed" | "error";
};

export type GenerationAction<TStep extends string> =
  | { type: "TRIGGER_START" }
  | { type: "TRIGGER_SUCCESS"; runId: string }
  | { type: "STEP_STARTED"; step: TStep }
  | { type: "STEP_COMPLETED"; step: TStep }
  | { type: "SET_ERROR"; error: string }
  | { type: "WORKFLOW_COMPLETED" }
  | { type: "RESET" };

export function generationReducer<TStep extends string>(
  state: GenerationState<TStep>,
  action: GenerationAction<TStep>,
): GenerationState<TStep> {
  switch (action.type) {
    case "TRIGGER_START":
      return { ...state, error: null, status: "triggering" };

    case "TRIGGER_SUCCESS":
      return { ...state, runId: action.runId, status: "streaming" };

    case "SET_ERROR":
      return { ...state, error: action.error, status: "error" };

    case "STEP_STARTED":
      return { ...state, currentStep: action.step };

    case "STEP_COMPLETED":
      return {
        ...state,
        completedSteps: state.completedSteps.includes(action.step)
          ? state.completedSteps
          : [...state.completedSteps, action.step],
        currentStep: null,
      };

    case "WORKFLOW_COMPLETED":
      return { ...state, status: "completed" };

    case "RESET":
      return {
        completedSteps: [],
        currentStep: null,
        error: null,
        runId: null,
        status: "idle",
      };

    default:
      return state;
  }
}

export function dispatchMessage<TStep extends string>(
  message: StreamMessage<TStep>,
  dispatch: React.Dispatch<GenerationAction<TStep>>,
) {
  switch (message.status) {
    case "started":
      dispatch({ step: message.step, type: "STEP_STARTED" });
      break;
    case "completed":
      dispatch({ step: message.step, type: "STEP_COMPLETED" });
      break;
    case "error":
      dispatch({ error: "Step failed", type: "SET_ERROR" });
      break;
  }
}
