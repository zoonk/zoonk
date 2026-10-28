import "server-only";

/** Read inside the same private cache as the page's data, so a prefetched copy keeps the time it was prefetched. */
export async function getReadAt(): Promise<number> {
  "use cache: private";

  return Date.now();
}
