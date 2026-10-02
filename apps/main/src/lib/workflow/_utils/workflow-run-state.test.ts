import { type StepStreamMessage } from "@zoonk/core/workflows/steps";
import { type GenerationKind } from "@zoonk/learn/generation/kinds";
import { describe, expect, it } from "vitest";
import {
  INITIAL_WORKFLOW_RUN_STATE,
  type WorkflowRunAction,
  type WorkflowRunState,
  getFollowedRunId,
  getRunStatus,
  workflowRunReducer,
} from "./workflow-run-state";

/** How many lost connections in a row the follower rides out before telling the learner. */
const MAX_LOST_CONNECTIONS = 5;

function run(actions: WorkflowRunAction[], from: WorkflowRunState = INITIAL_WORKFLOW_RUN_STATE) {
  return actions.reduce((state, action) => workflowRunReducer(state, action), from);
}

function event(message: StepStreamMessage, kind: GenerationKind = "curriculum"): WorkflowRunAction {
  return { kind, message, type: "event" };
}

function lostConnections(count: number): WorkflowRunAction[] {
  return Array.from({ length: count }, () => ({ type: "connectionLost" }) as const);
}

describe(workflowRunReducer, () => {
  it("keeps each step's furthest state as the run reports it", () => {
    const state = run([
      event({ status: "started", step: "understandGoal" }),
      event({ status: "completed", step: "understandGoal" }),
      event({ status: "started", step: "understandGoal" }),
      event({ status: "started", step: "saveSkills" }),
    ]);

    expect(state.steps).toStrictEqual({ saveSkills: "started", understandGoal: "completed" });
    expect(state.ready).toBe(false);
  });

  it("is ready once the step that ends the kind's wait finished", () => {
    const started = run([event({ status: "started", step: "createPlan" })]);
    const finished = run([event({ status: "completed", step: "createPlan" })], started);

    expect(started.ready).toBe(false);
    expect(finished.ready).toBe(true);
  });

  it("is ready when the run reports a step past the wait", () => {
    expect(
      run([event({ status: "completed", step: "understandingReady" }, "understanding")]).ready,
    ).toBe(true);

    expect(run([event({ status: "started", step: "outlineCourses" })]).ready).toBe(true);
  });

  it("fails when the run reports an error", () => {
    expect(
      run([event({ reason: "aiGenerationFailed", status: "error", step: "workflowError" })])
        .failure,
    ).toBe("generation");
  });

  it("ignores what the run reports after the wait is over", () => {
    const state = run([
      event({ status: "completed", step: "createPlan" }),
      event({ status: "error", step: "workflowError" }),
    ]);

    expect(state.ready).toBe(true);
    expect(state.failure).toBeNull();
  });

  it("follows the run a joining run hands over to", () => {
    const state = run([
      event({ entityId: "run-doing-the-work", status: "started", step: "joinRunningGoal" }),
    ]);

    expect(getFollowedRunId({ generationId: "joining-run", state })).toBe("run-doing-the-work");
    expect(state.steps).toStrictEqual({});
  });

  it("reopens a stream the server closed while its run still works", () => {
    const closed = run([{ status: "running", type: "runStatus" }]);
    const reopened = run([{ type: "reconnect" }], closed);

    expect(closed.reconnectIn).not.toBeNull();
    expect(closed.failure).toBeNull();
    expect(reopened.reconnectIn).toBeNull();
    expect(reopened.connection).toBe(closed.connection + 1);
  });

  it("is ready when the stream closed on a finished run", () => {
    expect(run([{ status: "completed", type: "runStatus" }]).ready).toBe(true);
  });

  it("fails when the stream closed on a failed or cancelled run", () => {
    expect(run([{ status: "failed", type: "runStatus" }]).failure).toBe("generation");
    expect(run([{ status: "cancelled", type: "runStatus" }]).failure).toBe("generation");
  });

  it("waits longer after each lost connection in a row", () => {
    const delays = [1, 2, 3].map((count) => run(lostConnections(count)).reconnectIn ?? 0);

    expect(delays[1]).toBeGreaterThan(delays[0] ?? 0);
    expect(delays[2]).toBeGreaterThan(delays[1] ?? 0);
  });

  it("tells the learner once the connection kept dropping", () => {
    const almost = run(lostConnections(MAX_LOST_CONNECTIONS));
    const lost = run(lostConnections(1), almost);

    expect(almost.failure).toBeNull();
    expect(lost.failure).toBe("connection");
    expect(lost.reconnectIn).toBeNull();
  });

  it("starts the count over when an event arrives between lost connections", () => {
    const state = run([
      ...lostConnections(MAX_LOST_CONNECTIONS),
      event({ status: "started", step: "understandGoal" }),
      ...lostConnections(MAX_LOST_CONNECTIONS),
    ]);

    expect(state.failure).toBeNull();
  });

  it("follows the same run again when the learner reconnects", () => {
    const lost = run([
      event({ status: "started", step: "understandGoal" }),
      ...lostConnections(MAX_LOST_CONNECTIONS + 1),
    ]);

    const resumed = run([{ type: "resume" }], lost);

    expect(resumed.failure).toBeNull();
    expect(resumed.lostConnections).toBe(0);
    expect(resumed.connection).toBe(lost.connection + 1);
    expect(resumed.steps).toStrictEqual({ understandGoal: "started" });
  });

  it("forgets a failed run once it's started again", () => {
    const failed = run([
      event({ status: "started", step: "saveSkills" }),
      event({ status: "error", step: "workflowError" }),
    ]);

    const restarted = run(
      [
        { runIds: ["failed-run"], type: "restart" },
        { runId: "failed-run", type: "polled" },
      ],
      failed,
    );

    expect(restarted.failure).toBeNull();
    expect(restarted.steps).toStrictEqual({});
    expect(getFollowedRunId({ generationId: "failed-run", state: restarted })).toBeNull();
    expect(getRunStatus({ runId: null, state: restarted })).toBe("waiting");

    const next = run([{ runId: "new-run", type: "polled" }], restarted);
    expect(getFollowedRunId({ generationId: "failed-run", state: next })).toBe("new-run");
  });

  it("fails when no run started", () => {
    expect(run([{ type: "notStarted" }]).failure).toBe("notStarted");
  });

  it("stays ready when the wait for a run ends after it was ready", () => {
    const state = run([{ status: "completed", type: "runStatus" }, { type: "notStarted" }]);

    expect(getRunStatus({ runId: "run", state })).toBe("ready");
  });
});

describe(getRunStatus, () => {
  it("waits until the run is known, then follows it", () => {
    expect(getRunStatus({ runId: null, state: INITIAL_WORKFLOW_RUN_STATE })).toBe("waiting");
    expect(getRunStatus({ runId: "run", state: INITIAL_WORKFLOW_RUN_STATE })).toBe("following");
  });

  it("says the run failed whatever the reason", () => {
    expect(
      getRunStatus({ runId: "run", state: run(lostConnections(MAX_LOST_CONNECTIONS + 1)) }),
    ).toBe("failed");
  });
});
