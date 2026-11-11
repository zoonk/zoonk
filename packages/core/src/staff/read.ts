import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { logInfo } from "@zoonk/utils/logger";
import { unstable_rethrow } from "next/navigation";
import { type ZodType } from "zod";
import { getStaffActor } from "./get-staff-actor";
import { StaffInputError, parseStaffInput } from "./input";
import { readableFields, readableModels } from "./registry";

type ReadFailure =
  | { status: "unauthorized" | "forbidden" | "error" }
  | { status: "invalid" | "timeout" | "notFound"; message: string };
export type StaffResult<T> = ({ status: "ready" } & T) | ReadFailure;
type Call = { verb: string; model?: string; id?: unknown; where?: { field: string; op: string }[] };

type ReadData<T> =
  | { data: T; rows: number }
  | { status: "notFound"; message: string; rows: number };

type ReadOptions<T, Input extends object> = { call: Call } & (
  | { input: unknown; schema: ZodType<Input>; run: (input: Input) => Promise<ReadData<T>> }
  | { run: () => Promise<ReadData<T>> }
);

function queryErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") {
    return;
  }

  const meta = "meta" in error ? error.meta : undefined;

  if (meta && typeof meta === "object") {
    const adapter = "driverAdapterError" in meta ? meta.driverAdapterError : undefined;
    const cause = adapter instanceof Error ? adapter.cause : undefined;

    if (
      cause &&
      typeof cause === "object" &&
      "originalCode" in cause &&
      typeof cause.originalCode === "string"
    ) {
      return cause.originalCode;
    }
  }

  return "code" in error && typeof error.code === "string" ? error.code : undefined;
}

function failedRead(error: unknown): ReadFailure {
  if (error instanceof StaffInputError) {
    return { message: error.message, status: "invalid" };
  }

  const code = queryErrorCode(error);

  if (code === "57014") {
    return {
      message: "The query exceeded 5 seconds. Use narrower filters and try again.",
      status: "timeout",
    };
  }

  if (code === "P2029") {
    return { message: "Too many filter values in one request.", status: "invalid" };
  }

  if (code?.startsWith("22")) {
    return { message: "A value in this request doesn't fit its column.", status: "invalid" };
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
  actor?: { status: string; userId?: string; clientId?: string };
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

  logInfo(
    JSON.stringify({
      actorUserId: actor?.userId ?? null,
      clientId: actor?.clientId ?? null,
      durationMs: Math.round(performance.now() - started),
      event: "staff.read",
      filters: filters ?? [],
      model: model?.name ?? null,
      outcome: result.status,
      recordId:
        call.verb === "get" && ["ready", "notFound"].includes(result.status) ? call.id : undefined,
      rowCount: rows,
      verb: call.verb,
    }),
  );
}

export async function staffRead<T extends object, Input extends object = never>(
  options: ReadOptions<T, Input>,
): Promise<StaffResult<T>> {
  const { call } = options;
  const started = performance.now();
  const { data: actor, error: actorError } = await safeAsync(getStaffActor);

  if (actorError) {
    unstable_rethrow(actorError);
  }

  if (actorError || !actor || actor.status !== "ready") {
    const result = actorError || !actor ? { status: "error" as const } : { status: actor.status };
    logCall({ actor: actor ?? undefined, call, result, rows: 0, started });
    return result;
  }

  const { data, error } = await safeAsync(async () => {
    const prepared = await prepareRead(options);
    return { call: prepared.call, ...(await safeAsync(prepared.run)) };
  });

  const result: StaffResult<T> = error ? failedRead(error) : readResult(data);
  logCall({ actor, call: data?.call ?? call, result, rows: data?.data?.rows ?? 0, started });
  return result;
}

async function prepareRead<T, Input extends object>(options: ReadOptions<T, Input>) {
  if (!("schema" in options)) {
    return options;
  }

  const input = await parseStaffInput(options.schema, options.input);
  const call = { ...input, ...options.call };
  return { call, run: () => options.run(input) };
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

function readResult<T extends object>({ data, error }: SafeReturn<ReadData<T>>): StaffResult<T> {
  if (error) {
    return failedRead(error);
  }

  return "status" in data
    ? { message: data.message, status: data.status }
    : { ...data.data, status: "ready" };
}
