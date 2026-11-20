import path from "node:path";
import { acceptedReads, canAdjudicate, caseVotes } from "./evidence";
import { hash } from "./identity";
import { type Adjudication, adjudicationSchema } from "./schemas";
import { directory, loadComparison, writeRecord } from "./storage";

type ImportArgs = Omit<Adjudication, "blind" | "recordedAt"> & { taskId: string; id: string };

export async function importAdjudication({ taskId, id, ...ruling }: ImportArgs) {
  const adjudication = adjudicationSchema.parse({
    ...ruling,
    blind: false,
    recordedAt: new Date().toISOString(),
  });

  const comparison = await loadComparison(taskId, id);

  const item = caseVotes(comparison, acceptedReads(comparison)).find(
    (entry) => entry.caseId === adjudication.caseId,
  );

  if (!item || (!item.adjudication && !canAdjudicate(comparison.manifest, item))) {
    throw new Error("The case must remain unresolved after every available family reads it.");
  }

  if (
    item.adjudication?.direction === adjudication.direction &&
    item.adjudication.reason === adjudication.reason
  ) {
    return item.adjudication;
  }

  const file = path.join(
    directory(taskId, id),
    "adjudications",
    `${hash(adjudication.caseId)}.json`,
  );

  return writeRecord(file, adjudicationSchema, adjudication, true);
}
