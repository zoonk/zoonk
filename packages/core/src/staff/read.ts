import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { logInfo } from "@zoonk/utils/logger";
import { getStaffActor } from "./get-staff-actor";
import { StaffInputError } from "./input";
import { readableFields, readableModels } from "./registry";

type ReadFailure =
  | { status: "unauthorized" | "forbidden" | "notFound" | "error" }
  | { status: "invalid" | "timeout"; message: string };
export type StaffResult<T> = ({ status: "ready" } & T) | ReadFailure;
type Call = { verb: string; model?: string; id?: unknown; where?: { field: string; op: string }[] };

function queryTimedOut(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  if ("code" in error && error.code === "57014") {
    return true;
  }

  return (
    ("message" in error &&
      typeof error.message === "string" &&
      error.message.includes("statement timeout")) ||
    ["cause", "meta", "driverAdapterError"].some((key) => queryTimedOut(Reflect.get(error, key)))
  );
}

function failedRead(error: unknown): ReadFailure {
  if (error instanceof StaffInputError) {
    return { message: error.message, status: "invalid" };
  }

  if (queryTimedOut(error)) {
    return {
      message: "The query exceeded 5 seconds. Use narrower filters and try again.",
      status: "timeout",
    };
  }

  return { status: "error" };
}

function logCall({
  actor,
  call,
  result,
  rows,
  started,
}: {
  actor?: { userId: string; clientId: string };
  call: Call;
  result: { status: string };
  rows: number;
  started: number;
}) {
  const model = readableModels.find((entry) => entry.name === call.model);
  const fields = model ? readableFields(model) : [];

  const filters = call.where
    ?.filter((filter) => fields.some((field) => field.name === filter.field))
    .map((filter) => ({ field: filter.field, op: filter.op }));

  logInfo("[Staff read]", {
    actorUserId: actor?.userId ?? null,
    clientId: actor?.clientId ?? null,
    durationMs: Math.round(performance.now() - started),
    filters: filters ?? [],
    model: model?.name ?? null,
    outcome: result.status,
    recordId:
      call.verb === "get" && ["ready", "notFound"].includes(result.status) ? call.id : undefined,
    rowCount: rows,
    verb: call.verb,
  });
}

export async function staffRead<T extends object>({
  call,
  run,
}: {
  call: Call;
  run: () => Promise<{ data: T; rows: number } | { status: "notFound"; rows: number }>;
}): Promise<StaffResult<T>> {
  const started = performance.now();
  const { data: actor, error: actorError } = await safeAsync(getStaffActor);

  if (actorError || !actor || actor.status !== "ready") {
    const result = actorError || !actor ? { status: "error" as const } : actor;
    logCall({ call, result, rows: 0, started });
    return result;
  }

  const { data, error } = await safeAsync(run);
  const result: StaffResult<T> = readResult({ data, error });
  logCall({ actor, call, result, rows: data?.rows ?? 0, started });
  return result;
}

export function staffTransaction<T>(run: (client: TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(
    async (client) => {
      await client.$executeRaw`SET LOCAL statement_timeout = '5s'`;
      return run(client);
    },
    { timeout: 10_000 },
  );
}

function readResult<T extends object>({
  data,
  error,
}: {
  data: { data: T; rows: number } | { status: "notFound"; rows: number } | null;
  error: Error | null;
}): StaffResult<T> {
  if (error || !data) {
    return failedRead(error);
  }

  return "status" in data ? { status: data.status } : { ...data.data, status: "ready" };
}
