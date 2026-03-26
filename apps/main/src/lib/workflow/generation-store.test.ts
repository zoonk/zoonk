import { type StepStreamMessage } from "@zoonk/core/workflows/steps";
import { describe, expect, it } from "vitest";
import {
  type GenerationAction,
  type GenerationState,
  generationReducer,
  handleStepStreamMessage,
  initialGenerationState,
} from "./generation-store";

describe(generationReducer, () => {
  describe("stepCompleted", () => {
    it("adds step to completedSteps", () => {
      const state = generationReducer(initialGenerationState(), {
        step: "stepA",
        type: "stepCompleted",
      });
      expect(state.completedSteps).toEqual(["stepA"]);
    });

    it("does not add duplicate steps", () => {
      const first = generationReducer(initialGenerationState(), {
        step: "stepA",
        type: "stepCompleted",
      });
      const second = generationReducer(first, { step: "stepA", type: "stepCompleted" });
      expect(second.completedSteps).toEqual(["stepA"]);
    });

    it("clears currentStep when it matches the completed step", () => {
      const state = generationReducer(initialGenerationState({ currentStep: "stepA" }), {
        step: "stepA",
        type: "stepCompleted",
      });
      expect(state.currentStep).toBeNull();
    });

    it("does NOT clear currentStep when a different step completes", () => {
      const state = generationReducer(initialGenerationState({ currentStep: "stepB" }), {
        step: "stepA",
        type: "stepCompleted",
      });
      expect(state.currentStep).toBe("stepB");
    });
  });

  describe("stepStarted", () => {
    it("sets currentStep", () => {
      const state = generationReducer(initialGenerationState(), {
        step: "stepA",
        type: "stepStarted",
      });
      expect(state.currentStep).toBe("stepA");
    });
  });

  describe("reconnect", () => {
    it("increments reconnectCount", () => {
      const state = generationReducer(initialGenerationState({ status: "streaming" }), {
        type: "reconnect",
      });
      expect(state.reconnectCount).toBe(1);
    });

    it("accumulates across multiple dispatches", () => {
      const first = generationReducer(initialGenerationState({ status: "streaming" }), {
        type: "reconnect",
      });
      const second = generationReducer(first, { type: "reconnect" });
      expect(second.reconnectCount).toBe(2);
    });
  });

  describe("reset", () => {
    it("resets reconnectCount to 0", () => {
      const state = generationReducer(
        initialGenerationState({ reconnectCount: 3, status: "streaming" }),
        { type: "reset" },
      );
      expect(state.reconnectCount).toBe(0);
    });
  });

  describe("streamEnded", () => {
    it("does not transition from error state", () => {
      const state = generationReducer(
        initialGenerationState({ error: "Some error", status: "error" }),
        { type: "streamEnded" },
      );
      expect(state.status).toBe("error");
    });

    it("does not transition from completed state", () => {
      const state = generationReducer(initialGenerationState({ status: "completed" }), {
        type: "streamEnded",
      });
      expect(state.status).toBe("completed");
    });

    it("transitions to completed from streaming state", () => {
      const state = generationReducer(initialGenerationState({ status: "streaming" }), {
        type: "streamEnded",
      });
      expect(state.status).toBe("completed");
    });

    it("transitions to completed when completionStep is in completedSteps", () => {
      const state = generationReducer(
        initialGenerationState({ completedSteps: ["done"], status: "streaming" }),
        { completionStep: "done", type: "streamEnded" },
      );
      expect(state.status).toBe("completed");
    });

    it("transitions to error when completionStep is missing from completedSteps", () => {
      const state = generationReducer(initialGenerationState({ status: "streaming" }), {
        completionStep: "done",
        type: "streamEnded",
      });
      expect(state.status).toBe("error");
      expect(state.error).toBe("Generation ended unexpectedly. Please try again.");
    });
  });
});

describe(handleStepStreamMessage, () => {
  function applyActions(actions: GenerationAction[], initial: GenerationState) {
    let state = initial;
    for (const action of actions) {
      state = generationReducer(state, action);
    }
    return state;
  }

  function applyMessage(
    message: StepStreamMessage,
    initial?: Parameters<typeof initialGenerationState>[0],
  ) {
    const actions: GenerationAction[] = [];
    handleStepStreamMessage({ dispatch: (a) => actions.push(a), message });
    return applyActions(actions, initialGenerationState(initial));
  }

  it("routes 'started' to stepStarted", () => {
    const state = applyMessage({ status: "started", step: "stepA" });
    expect(state.currentStep).toBe("stepA");
  });

  it("routes 'completed' to stepCompleted", () => {
    const state = applyMessage({ status: "completed", step: "stepA" });
    expect(state.completedSteps).toEqual(["stepA"]);
  });

  it("triggers streamEnded on completionStep match", () => {
    const actions: GenerationAction[] = [];
    handleStepStreamMessage({
      completionStep: "done",
      dispatch: (a) => actions.push(a),
      message: { status: "completed", step: "done" },
    });
    const state = applyActions(actions, initialGenerationState({ status: "streaming" }));
    expect(state.status).toBe("completed");
  });

  it("triggers streamEnded when entityId matches the completed activity", () => {
    const actions: GenerationAction[] = [];
    handleStepStreamMessage({
      completionStep: "done",
      dispatch: (a) => actions.push(a),
      entityId: 42,
      message: { entityId: 42, status: "completed", step: "done" },
    });
    const state = applyActions(actions, initialGenerationState({ status: "streaming" }));
    expect(state.status).toBe("completed");
  });

  it("does not trigger streamEnded when entityId does not match", () => {
    const actions: GenerationAction[] = [];
    handleStepStreamMessage({
      completionStep: "done",
      dispatch: (a) => actions.push(a),
      entityId: 42,
      message: { entityId: 99, status: "completed", step: "done" },
    });
    const state = applyActions(actions, initialGenerationState({ status: "streaming" }));
    expect(state.status).toBe("streaming");
  });

  it("triggers streamEnded when no entityId filter is set (non-activity workflows)", () => {
    const actions: GenerationAction[] = [];
    handleStepStreamMessage({
      completionStep: "done",
      dispatch: (a) => actions.push(a),
      message: { entityId: 99, status: "completed", step: "done" },
    });
    const state = applyActions(actions, initialGenerationState({ status: "streaming" }));
    expect(state.status).toBe("completed");
  });

  it("does not trigger streamEnded for non-completion steps", () => {
    const actions: GenerationAction[] = [];
    handleStepStreamMessage({
      completionStep: "done",
      dispatch: (a) => actions.push(a),
      message: { status: "completed", step: "stepA" },
    });
    const state = applyActions(actions, initialGenerationState({ status: "streaming" }));
    expect(state.status).toBe("streaming");
  });

  it("routes 'error' to setError with step name", () => {
    const state = applyMessage({ status: "error", step: "stepA" });
    expect(state.status).toBe("error");
    expect(state.error).toBe('Step "stepA" failed');
  });

  it("routes 'error' with reason to setError", () => {
    const state = applyMessage({ reason: "aiGenerationFailed", status: "error", step: "stepA" });
    expect(state.status).toBe("error");
    expect(state.error).toBe("stepA: aiGenerationFailed");
  });
});
