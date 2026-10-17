import "server-only";
import { getSession } from "../users/get-session";
import { loadMemoryExport } from "./_utils/memory-export";
import { type MemoryExport } from "./memory-contract";

/**
 * Everything Zoonk keeps in the learner's memory, for a download of its own. The account-wide
 * export includes the same data. Uncached, so a download always reflects what's stored at that
 * moment.
 */
export async function exportCurrentUserMemory(): Promise<MemoryExport | null> {
  const session = await getSession();

  if (!session) {
    return null;
  }

  return loadMemoryExport(session.user.id);
}
