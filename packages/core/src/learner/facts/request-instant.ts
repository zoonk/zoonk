import "server-only";

/** Shared GET reference instant; derive each local day using that goal's stored zone. */
export async function getRequestInstant(): Promise<Date> {
  "use cache: private";

  return new Date();
}
