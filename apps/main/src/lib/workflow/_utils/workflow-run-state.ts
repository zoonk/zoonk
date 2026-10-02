import { type StepStreamMessage } from "@zoonk/core/workflows/steps";
import {
  type GenerationKind,
  getGenerationKind,
  getStepMeaning,
  isGenerationDone,
} from "@zoonk/learn/generation/kinds";
import {
  type GenerationFailure,
  type GenerationRun,
  type GenerationStepState,
} from "@zoonk/learn/generation/run";

/** Lost connections in a row, without a single event between them, before the learner is told. */
const MAX_LOST_CONNECTIONS = 5;

/** A stream that closed while its run still works (a function timeout) reopens after this. */
const REOPEN_DELAY_MS = 1500;

const MAX_RECONNECT_DELAY_MS = 16_000;

/** The workflow's own status for a run, as `GET /v1/generations/{id}` reports it. */
export type RunStatus = "cancelled" | "completed" | "failed" | "pending" | "running";

export type WorkflowRunState = {
  /** Each new connection gets its own number, so the events URL changes and a fresh one opens. */
  connection: number;
  failure: GenerationFailure | null;
  /** The run the followed one handed over to: the one actually doing the work. */
  joined: string | null;
  lostConnections: number;
  /** The run's id, read from the server while the host didn't have it. */
  polled: string | null;
  ready: boolean;
  /** When the next connection opens, in milliseconds from now; null while one is open. */
  reconnectIn: number | null;
  /** Runs that failed and were started again: their ids are no longer followed. */
  replaced: string[];
  steps: Partial<Record<string, GenerationStepState>>;
};

export type WorkflowRunAction =
  | { kind: GenerationKind; message: StepStreamMessage; type: "event" }
  | { runId: string | null; type: "polled" }
  | { status: RunStatus; type: "runStatus" }
  | { type: "connectionLost" }
  | { type: "notStarted" }
  | { type: "reconnect" }
  | { type: "resume" }
  | { runIds: string[]; type: "restart" };

export const INITIAL_WORKFLOW_RUN_STATE: WorkflowRunState = {
  connection: 0,
  failure: null,
  joined: null,
  lostConnections: 0,
  polled: null,
  ready: false,
  reconnectIn: null,
  replaced: [],
  steps: {},
};

function isSettled(state: WorkflowRunState): boolean {
  return state.ready || state.failure !== null;
}

/** Waits longer after each lost connection in a row: 2, 4, 8 and 16 seconds. */
function getReconnectDelay(lostConnections: number): number {
  return Math.min(1000 * 2 ** lostConnections, MAX_RECONNECT_DELAY_MS);
}

/** A step keeps its furthest state: a replayed "started" never undoes a "completed". */
function recordStep(
  state: WorkflowRunState,
  message: StepStreamMessage & { status: GenerationStepState },
): WorkflowRunState {
  const status = state.steps[message.step] === "completed" ? "completed" : message.status;
  return { ...state, steps: { ...state.steps, [message.step]: status } };
}

function applyEvent({
  kind,
  message,
  state,
}: {
  kind: GenerationKind;
  message: StepStreamMessage;
  state: WorkflowRunState;
}): WorkflowRunState {
  // Any event proves the connection works.
  const connected = { ...state, lostConnections: 0 };
  const meaning = getStepMeaning({ kind, status: message.status, step: message.step });

  if (isSettled(state)) {
    return connected;
  }

  if (meaning === "join") {
    return message.entityId ? { ...connected, joined: message.entityId } : connected;
  }

  if (meaning === "error" || message.status === "error") {
    return { ...connected, failure: "generation" };
  }

  const recorded = recordStep(connected, { ...message, status: message.status });
  const ready = isGenerationDone({ definition: getGenerationKind(kind), steps: recorded.steps });

  return { ...recorded, ready };
}

/**
 * The stream closed before the wait's content was ready. The run's own status decides: still
 * running means the connection was cut (a function timeout) and a new one resumes it; finished
 * means the work is done; failed or cancelled means it stopped.
 */
function applyRunStatus(state: WorkflowRunState, status: RunStatus): WorkflowRunState {
  if (isSettled(state)) {
    return state;
  }

  if (status === "completed") {
    return { ...state, lostConnections: 0, ready: true };
  }

  if (status === "failed" || status === "cancelled") {
    return { ...state, failure: "generation", lostConnections: 0 };
  }

  return { ...state, lostConnections: 0, reconnectIn: REOPEN_DELAY_MS };
}

/** After a few lost connections in a row, the learner is told instead of waiting on nothing. */
function applyConnectionLost(state: WorkflowRunState): WorkflowRunState {
  if (isSettled(state)) {
    return state;
  }

  const lostConnections = state.lostConnections + 1;

  if (lostConnections > MAX_LOST_CONNECTIONS) {
    return { ...state, failure: "connection", lostConnections, reconnectIn: null };
  }

  return { ...state, lostConnections, reconnectIn: getReconnectDelay(lostConnections) };
}

/**
 * Following a generation run for a wait: its steps, when its content is ready, and why it stopped
 * (it never started, the connection kept dropping, or the run failed). Each reconnect opens a new
 * connection that resumes where the last one ended; the learner's own reconnect starts the count
 * of lost connections over.
 */
export function workflowRunReducer(
  state: WorkflowRunState,
  action: WorkflowRunAction,
): WorkflowRunState {
  switch (action.type) {
    case "event":
      return applyEvent({ kind: action.kind, message: action.message, state });
    case "polled":
      return {
        ...state,
        polled: action.runId && !state.replaced.includes(action.runId) ? action.runId : null,
      };
    case "runStatus":
      return applyRunStatus(state, action.status);
    case "connectionLost":
      return applyConnectionLost(state);
    case "notStarted":
      return isSettled(state) ? state : { ...state, failure: "notStarted" };
    case "reconnect":
      return { ...state, connection: state.connection + 1, reconnectIn: null };
    case "resume":
      return {
        ...state,
        connection: state.connection + 1,
        failure: null,
        lostConnections: 0,
        reconnectIn: null,
      };
    case "restart":
      return {
        ...INITIAL_WORKFLOW_RUN_STATE,
        connection: state.connection + 1,
        replaced: [...state.replaced, ...action.runIds],
      };
    default:
      return state;
  }
}

/** The run to follow: one the followed run handed over to, else the known one, unless replaced. */
export function getFollowedRunId({
  generationId,
  state,
}: {
  generationId: string | null;
  state: WorkflowRunState;
}): string | null {
  const known = state.joined ?? state.polled ?? generationId;
  return known && !state.replaced.includes(known) ? known : null;
}

export function getRunStatus({
  runId,
  state,
}: {
  runId: string | null;
  state: WorkflowRunState;
}): GenerationRun["status"] {
  if (state.ready) {
    return "ready";
  }

  if (state.failure) {
    return "failed";
  }

  return runId ? "following" : "waiting";
}
