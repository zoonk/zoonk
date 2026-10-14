import { type getLiveCallAdmission } from "@zoonk/core/language/conversations/admission";
import { liveCallAdmissionResponseSchema } from "@zoonk/core/language/conversations/admission-contract";

type AdmissionView = Extract<Awaited<ReturnType<typeof getLiveCallAdmission>>, { status: "ready" }>;

/** API dates cross the HTTP boundary as ISO strings; Admin shares the pure core DTO schema. */
export function serializeLiveCallAdmission(result: AdmissionView) {
  return liveCallAdmissionResponseSchema.parse({
    ...result,
    connections: result.connections.map((connection) => ({
      ...connection,
      closedAt: connection.closedAt?.toISOString() ?? null,
      createdAt: connection.createdAt.toISOString(),
      deadlineAt: connection.deadlineAt.toISOString(),
      lastCloseAt: connection.lastCloseAt?.toISOString() ?? null,
      providerStartedAt: connection.providerStartedAt?.toISOString() ?? null,
      recoveryUnconfirmedAt: connection.recoveryUnconfirmedAt?.toISOString() ?? null,
      updatedAt: connection.updatedAt.toISOString(),
    })),
  });
}
