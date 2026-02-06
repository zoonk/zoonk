import { createStore } from "@xstate/store";

export type StepStatus = "started" | "completed" | "error";
export type GenerationStatus = "idle" | "triggering" | "streaming" | "completed" | "error";

export type StreamMessage<TStep extends string = string> = {
  step: TStep;
  status: StepStatus;
};

export type GenerationContext<TStep extends string = string> = {
  completedSteps: TStep[];
  currentStep: TStep | null;
  error: string | null;
  runId: string | null;
  status: GenerationStatus;
};

export function createGenerationStore<TStep extends string = string>(
  initialContext?: Partial<GenerationContext<TStep>>,
) {
  return createStore({
    context: {
      completedSteps: [] as TStep[],
      currentStep: null as TStep | null,
      error: null as string | null,
      runId: null as string | null,
      status: "idle" as GenerationStatus,
      ...initialContext,
    },
    on: {
      reset: () => ({
        completedSteps: [] as TStep[],
        currentStep: null as TStep | null,
        error: null as string | null,
        runId: null as string | null,
        status: "idle" as GenerationStatus,
      }),

      setError: (ctx, event: { error: string }) => ({
        ...ctx,
        error: event.error,
        status: "error" as const,
      }),

      stepCompleted: (ctx, event: { step: TStep }) => ({
        ...ctx,
        completedSteps: ctx.completedSteps.includes(event.step)
          ? ctx.completedSteps
          : [...ctx.completedSteps, event.step],
        currentStep: ctx.currentStep === event.step ? null : ctx.currentStep,
      }),

      stepStarted: (ctx, event: { step: TStep }) => ({
        ...ctx,
        currentStep: event.step,
      }),
      triggerStart: (ctx) => ({
        ...ctx,
        error: null,
        status: "triggering" as const,
      }),

      triggerSuccess: (ctx, event: { runId: string }) => ({
        ...ctx,
        runId: event.runId,
        status: "streaming" as const,
      }),

      workflowCompleted: (ctx) => {
        // Don't transition to completed if there was an error
        if (ctx.status === "error") {
          return ctx;
        }
        return {
          ...ctx,
          status: "completed" as const,
        };
      },
    },
  });
}

export function handleStreamMessage<TStep extends string>(
  message: StreamMessage<TStep>,
  store: ReturnType<typeof createGenerationStore<TStep>>,
  completionStep?: TStep,
) {
  switch (message.status) {
    case "started":
      store.send({ step: message.step, type: "stepStarted" });
      break;
    case "completed":
      store.send({ step: message.step, type: "stepCompleted" });
      if (completionStep && message.step === completionStep) {
        store.send({ type: "workflowCompleted" });
      }
      break;
    case "error":
      store.send({ error: "Step failed", type: "setError" });
      break;
    default: {
      const exhaustiveCheck: never = message.status;
      throw new Error(`Unexpected status: ${String(exhaustiveCheck)}`);
    }
  }
}
