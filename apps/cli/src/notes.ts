import { isRecord } from "./http.ts";

export type Note = (body: Record<string, unknown>) => string;

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((entry) => isRecord(entry)) : [];
}

function fixes(count: number): string {
  return count === 1 ? "1 fix" : `${String(count)} fixes`;
}

function proposed(body: Record<string, unknown>, undoing: boolean): string {
  const proposals = records(body.fixes);
  const [only] = proposals;
  const one = proposals.length === 1;
  const reviewUrl = one ? only?.reviewUrl : body.reviewUrl;
  const what = undoing ? `undoing ${fixes(proposals.length)}` : fixes(proposals.length);

  return (
    `Proposed ${what}${one ? "" : " to review together"}. Nothing changes until a staff person ` +
    `approves ${one ? "it" : "them"} in Admin: ${String(reviewUrl)}`
  );
}

export const proposalNote: Note = (body) => proposed(body, false);

export const revertNote: Note = (body) => proposed(body, true);

export const withdrawalNote: Note = (body) => {
  const withdrawn = typeof body.withdrawn === "number" ? body.withdrawn : 0;
  const decided = records(body.fixes).filter((fix) => fix.status !== "withdrawn").length;

  return [
    withdrawn > 0
      ? `Withdrew ${fixes(withdrawn)}, so nobody will review ${withdrawn === 1 ? "it" : "them"}. The content didn't change.`
      : "Already withdrawn. Nothing changed.",
    decided > 0 &&
      `${fixes(decided)} ${decided === 1 ? "was" : "were"} already decided and ${decided === 1 ? "stays as it is" : "stay as they are"}.`,
  ]
    .filter(Boolean)
    .join(" ");
};
