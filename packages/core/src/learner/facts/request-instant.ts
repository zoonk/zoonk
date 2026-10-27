import "server-only";

/** One reference instant for GET facts; each goal derives its local day in its own stored zone. */
export async function getRequestInstant(): Promise<Date> {
  "use cache: private";

  return new Date();
}
