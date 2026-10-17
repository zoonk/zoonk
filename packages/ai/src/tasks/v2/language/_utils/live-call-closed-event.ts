import { z } from "zod";

export type LiveCallSessionClosed = { status: "closed"; seconds: number; reason: string };

const eventTypeSchema = z.object({ type: z.string() });

const closedEventSchema = z.object({
  reason: z.string().min(1),
  session: z.object({ id: z.string().min(1) }),
  type: z.literal("session.closed"),
  usage: z.object({ seconds: z.number().nonnegative() }),
});

/** Only the terminal receipt, with this session's final usage, establishes finalization. */
export function readLiveCallClosedEvent({
  data,
  providerSessionId,
}: {
  data: unknown;
  providerSessionId: string;
}): LiveCallSessionClosed | null {
  if (typeof data !== "string") {
    throw new TypeError("Live call sideband returned a non-text event.");
  }

  const raw: unknown = JSON.parse(data);
  const { type } = eventTypeSchema.parse(raw);

  if (type !== "session.closed") {
    return null;
  }

  const closed = closedEventSchema.parse(raw);

  if (closed.session.id !== providerSessionId) {
    throw new Error("Live call terminal receipt belongs to a different session.");
  }

  return { reason: closed.reason, seconds: closed.usage.seconds, status: "closed" };
}
