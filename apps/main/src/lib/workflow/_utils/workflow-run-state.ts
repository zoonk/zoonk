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
  type GenerationStepTimes,
} from "@zoonk/learn/generation/run";

const MAX_LOST_CONNECTIONS = 5;

/** A stream can close while its run still works (a function timeout). */
const REOPEN_DELAY_MS = 1500;

const MAX_RECONNECT_DELAY_MS = 16_000;

export type RunStatus = "cancelled" | "completed" | "failed" | "pending" | "running";

export type WorkflowRunState = {
  /** From the stream's `Date` header as it opened: a replayed event arrives long after its time. */
  clockOffsetMs: number | null;
  /** A new number changes the events URL, so a fresh connection opens. */
  connection: number;
  failure: GenerationFailure | null;
  joined: string | null;
  lostConnections: number;
  polled: string | null;
  ready: boolean;
  reconnectIn: number | null;
  replaced: string[];
  steps: Partial<Record<string, GenerationStepState>>;
  stepTimes: Partial<Record<string, GenerationStepTimes>>;
};

export type WorkflowRunAction =
  | { kind: GenerationKind; message: StepStreamMessage; type: "event" }
  | { offsetMs: number; type: "serverClock" }
  | { runId: string | null; type: "polled" }
  | { status: RunStatus; type: "runStatus" }
  | { type: "connectionLost" }
  | { type: "notStarted" }
  | { type: "reconnect" }
  | { type: "resume" }
  | { runIds: string[]; type: "restart" };

export const INITIAL_WORKFLOW_RUN_STATE: WorkflowRunState = {
  clockOffsetMs: null,
  connection: 0,
  failure: null,
  joined: null,
  lostConnections: 0,
  polled: null,
  ready: false,
  reconnectIn: null,
  replaced: [],
  stepTimes: {},
  steps: {},
};

function isSettled(state: WorkflowRunState): boolean {
  return state.ready || state.failure !== null;
}

function getReconnectDelay(lostConnections: number): number {
  return Math.min(1000 * 2 ** lostConnections, MAX_RECONNECT_DELAY_MS);
}

/** A step keeps the first time it reported each state: a replayed event never moves it. */
function recordStepTime(
  state: WorkflowRunState,
  message: StepStreamMessage & { status: GenerationStepState },
): WorkflowRunState["stepTimes"] {
  const times = state.stepTimes[message.step] ?? {};

  if (message.at === undefined || times[message.status] !== undefined) {
    return state.stepTimes;
  }

  return { ...state.stepTimes, [message.step]: { ...times, [message.status]: message.at } };
}

/** A step keeps its furthest state: a replayed "started" never undoes a "completed". */
function recordStep(
  state: WorkflowRunState,
  message: StepStreamMessage & { status: GenerationStepState },
): WorkflowRunState {
  const status = state.steps[message.step] === "completed" ? "completed" : message.status;

  return {
    ...state,
    stepTimes: recordStepTime(state, message),
    steps: { ...state.steps, [message.step]: status },
  };
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

/** A run still running behind a closed stream had its connection cut (a function timeout). */
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

export function workflowRunReducer(
  state: WorkflowRunState,
  action: WorkflowRunAction,
): WorkflowRunState {
  switch (action.type) {
    case "event":
      return applyEvent({ kind: action.kind, message: action.message, state });
    case "serverClock":
      return { ...state, clockOffsetMs: action.offsetMs };
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
