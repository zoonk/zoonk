import "server-only";
import { randomUUID } from "node:crypto";
import { type CodeRun, type TransactionClient, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { revalidateCacheTags } from "../../../cache/revalidate-cache-tags";
import { getAllowanceCacheTag } from "../../../cache/tags";
import { claimUsageInTransaction } from "../../../entitlements/_utils/claim-usage-in-transaction";
import {
  type EntitlementViewer,
  getEntitlementViewer,
} from "../../../entitlements/_utils/entitlement-viewer";
import { lockUsageForViewer } from "../../../entitlements/_utils/usage-lock";
import { type UsageDecision } from "../../../entitlements/contract";
import { executeSandboxProgram, sandboxRunError } from "./execute-sandbox-program";
import { SANDBOX_LANGUAGE_IDS } from "./program-languages";
import {
  type CodeRunInput,
  type CodeRunPhase,
  type CodeRunResult,
  sandboxLanguageSchema,
} from "./sandbox-contract";
import { type ProgramSandbox, sandboxDriver } from "./sandbox-driver";
import {
  SANDBOX_FORK_MS,
  SANDBOX_IDLE_MS,
  runBudgetMs,
  sandboxCostMicros,
} from "./sandbox-languages";

type RunAdmission =
  | { status: "alreadyRunning" }
  | Exclude<UsageDecision, { status: "allowed" }>
  | { status: "replay"; result: CodeRunResult }
  | { status: "start"; run: (onPhase: (phase: CodeRunPhase) => void) => Promise<CodeRunResult> };

type ClaimedRun = { status: "ready"; row: CodeRun; reuseName: string | null };

/** A sandbox whose last run timed out or never finished may still be busy, so the next run forks. */
const REUSABLE_STOPS = new Set<CodeRunResult["stop"]>(["done", "error", "tooMuchOutput"]);

const MAX_RUN_LIFE_MS =
  Math.max(...SANDBOX_LANGUAGE_IDS.map((language) => runBudgetMs(language))) + SANDBOX_FORK_MS;

function unavailable(runId: string): CodeRunResult {
  return { error: null, errorOutput: "", output: "", runId, stop: "unavailable" };
}

async function claimRun({
  input,
  transaction,
  viewer,
}: {
  input: CodeRunInput;
  transaction: TransactionClient;
  viewer: EntitlementViewer;
}): Promise<Exclude<RunAdmission, { status: "start" }> | ClaimedRun> {
  const { userId } = viewer;
  await lockUsageForViewer({ transaction, userId });
  const now = new Date();

  const existing = await transaction.codeRun.findUnique({
    where: { userId_requestId: { requestId: input.requestId, userId } },
  });

  if (existing?.finishedAt && existing.stop) {
    const errorOutput = existing.errorOutput ?? "";

    return {
      result: {
        error:
          existing.stop === "error"
            ? sandboxRunError(sandboxLanguageSchema.parse(existing.language), errorOutput)
            : null,
        errorOutput,
        output: existing.output ?? "",
        runId: existing.id,
        stop: existing.stop,
      },
      status: "replay",
    };
  }

  const activeSince = new Date(now.getTime() - MAX_RUN_LIFE_MS);

  if (existing) {
    return existing.startedAt > activeSince
      ? { status: "alreadyRunning" }
      : { result: unavailable(existing.id), status: "replay" };
  }

  const active = await transaction.codeRun.findFirst({
    where: { finishedAt: null, startedAt: { gt: activeSince }, userId },
  });

  if (active) {
    return { status: "alreadyRunning" };
  }

  const id = randomUUID();

  const { decision } = await claimUsageInTransaction({
    costMicros: sandboxCostMicros(input.language),
    generated: false,
    kind: "codeRun",
    now,
    targetId: id,
    transaction,
    viewer,
  });

  if (decision.status !== "allowed") {
    return decision;
  }

  const latest = await transaction.codeRun.findFirst({
    orderBy: { startedAt: "desc" },
    where: {
      language: input.language,
      startedAt: { gt: new Date(now.getTime() - SANDBOX_IDLE_MS - MAX_RUN_LIFE_MS) },
      userId,
    },
  });

  const reuseName =
    latest?.finishedAt &&
    latest.stop &&
    REUSABLE_STOPS.has(latest.stop) &&
    latest.finishedAt.getTime() > now.getTime() - SANDBOX_IDLE_MS
      ? latest.sandboxName
      : null;

  const row = await transaction.codeRun.create({
    data: {
      id,
      language: input.language,
      requestId: input.requestId,
      sandboxName: `run-${id}`,
      startedAt: now,
      userId,
    },
  });

  return { reuseName, row, status: "ready" };
}

type Attempt = { result: CodeRunResult; sandboxName: string } | { started: boolean };

/** `started` once the sandbox holds the program and begins compiling or running it. */
async function attemptRun({
  input,
  onPhase,
  open,
  runId,
  sandboxName,
}: {
  input: CodeRunInput;
  onPhase: (phase: CodeRunPhase) => void;
  open: () => Promise<ProgramSandbox>;
  runId: string;
  sandboxName: string;
}): Promise<Attempt> {
  const opened = await safeAsync(open);

  if (!opened.data) {
    return { started: false };
  }

  const sandbox = opened.data;
  let started = false;

  const executed = await safeAsync(() =>
    executeSandboxProgram({
      ...input,
      onPhase: (phase) => {
        started = true;
        onPhase(phase);
      },
      runId,
      sandbox,
    }),
  );

  if (executed.error) {
    await safeAsync(() => sandbox.stop());
    return { started };
  }

  return { result: executed.data, sandboxName };
}

async function runClaimedProgram({
  claim,
  input,
  onPhase,
}: {
  claim: ClaimedRun;
  input: CodeRunInput;
  onPhase: (phase: CodeRunPhase) => void;
}): Promise<CodeRunResult> {
  const { row, reuseName } = claim;
  const runId = row.id;
  const timeoutMs = runBudgetMs(input.language) + SANDBOX_IDLE_MS;

  const deadline = AbortSignal.timeout(
    Math.max(
      1,
      row.startedAt.getTime() + runBudgetMs(input.language) + SANDBOX_FORK_MS - Date.now(),
    ),
  );

  onPhase("starting");

  const reused: Attempt = reuseName
    ? await attemptRun({
        input,
        onPhase,
        open: () => sandboxDriver.reuse({ deadline, name: reuseName, timeoutMs }),
        runId,
        sandboxName: reuseName,
      })
    : { started: false };

  const attempt =
    "result" in reused || reused.started
      ? reused
      : await attemptRun({
          input,
          onPhase,
          open: () =>
            sandboxDriver.fork({
              deadline,
              language: input.language,
              name: row.sandboxName,
              timeoutMs,
            }),
          runId,
          sandboxName: row.sandboxName,
        });

  const result = "result" in attempt ? attempt.result : unavailable(runId);

  await prisma.codeRun.update({
    data: {
      errorOutput: result.errorOutput,
      finishedAt: new Date(),
      output: result.output,
      sandboxName: "result" in attempt ? attempt.sandboxName : row.sandboxName,
      stop: result.stop,
    },
    where: { id: row.id },
  });

  return result;
}

export async function runLearnerProgram(input: CodeRunInput): Promise<RunAdmission> {
  const viewer = await getEntitlementViewer();

  if (!viewer) {
    return { status: "unauthorized" };
  }

  const claim = await prisma.$transaction((transaction) =>
    claimRun({ input, transaction, viewer }),
  );

  if (claim.status !== "ready") {
    return claim;
  }

  revalidateCacheTags([getAllowanceCacheTag(viewer.userId)]);

  return { run: (onPhase) => runClaimedProgram({ claim, input, onPhase }), status: "start" };
}
