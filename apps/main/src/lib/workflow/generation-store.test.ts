import { describe, expect, it } from "vitest";
import { type StreamMessage, createGenerationStore, handleStreamMessage } from "./generation-store";

describe(createGenerationStore, () => {
  describe("stepCompleted", () => {
    it("adds step to completedSteps", () => {
      const store = createGenerationStore<"stepA" | "stepB">();
      store.send({ step: "stepA", type: "stepCompleted" });
      expect(store.getSnapshot().context.completedSteps).toEqual(["stepA"]);
    });

    it("does not add duplicate steps", () => {
      const store = createGenerationStore<"stepA" | "stepB">();
      store.send({ step: "stepA", type: "stepCompleted" });
      store.send({ step: "stepA", type: "stepCompleted" });
      expect(store.getSnapshot().context.completedSteps).toEqual(["stepA"]);
    });

    it("clears currentStep when it matches the completed step", () => {
      const store = createGenerationStore<"stepA" | "stepB">({
        currentStep: "stepA",
      });
      store.send({ step: "stepA", type: "stepCompleted" });
      expect(store.getSnapshot().context.currentStep).toBeNull();
    });

    it("does NOT clear currentStep when a different step completes", () => {
      const store = createGenerationStore<"stepA" | "stepB">({
        currentStep: "stepB",
      });
      store.send({ step: "stepA", type: "stepCompleted" });
      expect(store.getSnapshot().context.currentStep).toBe("stepB");
    });
  });

  describe("stepStarted", () => {
    it("sets currentStep", () => {
      const store = createGenerationStore<"stepA" | "stepB">();
      store.send({ step: "stepA", type: "stepStarted" });
      expect(store.getSnapshot().context.currentStep).toBe("stepA");
    });
  });

  describe("workflowCompleted", () => {
    it("does not transition from error state", () => {
      const store = createGenerationStore({
        error: "Some error",
        status: "error",
      });
      store.send({ type: "workflowCompleted" });
      expect(store.getSnapshot().context.status).toBe("error");
    });

    it("transitions to completed from streaming state", () => {
      const store = createGenerationStore({ status: "streaming" });
      store.send({ type: "workflowCompleted" });
      expect(store.getSnapshot().context.status).toBe("completed");
    });
  });
});

describe(handleStreamMessage, () => {
  it("routes 'started' to stepStarted", () => {
    const store = createGenerationStore<"stepA">();
    const message: StreamMessage<"stepA"> = { status: "started", step: "stepA" };
    handleStreamMessage(message, store);
    expect(store.getSnapshot().context.currentStep).toBe("stepA");
  });

  it("routes 'completed' to stepCompleted", () => {
    const store = createGenerationStore<"stepA">();
    const message: StreamMessage<"stepA"> = { status: "completed", step: "stepA" };
    handleStreamMessage(message, store);
    expect(store.getSnapshot().context.completedSteps).toEqual(["stepA"]);
  });

  it("triggers workflowCompleted on completionStep match", () => {
    const store = createGenerationStore<"stepA" | "done">({ status: "streaming" });
    const message: StreamMessage<"stepA" | "done"> = { status: "completed", step: "done" };
    handleStreamMessage(message, store, "done");
    expect(store.getSnapshot().context.status).toBe("completed");
  });

  it("does not trigger workflowCompleted for non-completion steps", () => {
    const store = createGenerationStore<"stepA" | "done">({ status: "streaming" });
    const message: StreamMessage<"stepA" | "done"> = { status: "completed", step: "stepA" };
    handleStreamMessage(message, store, "done");
    expect(store.getSnapshot().context.status).toBe("streaming");
  });

  it("routes 'error' to setError", () => {
    const store = createGenerationStore<"stepA">();
    const message: StreamMessage<"stepA"> = { status: "error", step: "stepA" };
    handleStreamMessage(message, store);
    expect(store.getSnapshot().context.status).toBe("error");
    expect(store.getSnapshot().context.error).toBe("Step failed");
  });
});
