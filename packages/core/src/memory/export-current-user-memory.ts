import "server-only";
import { getSession } from "../users/get-session";
import { loadMemoryExport } from "./_utils/memory-export";
import { type MemoryExport } from "./memory-contract";

/** Uncached, so a download reflects what's stored at that moment. */
export async function exportCurrentUserMemory(): Promise<MemoryExport | null> {
  const session = await getSession();

  if (!session) {
    return null;
  }

  return loadMemoryExport(session.user.id);
}
