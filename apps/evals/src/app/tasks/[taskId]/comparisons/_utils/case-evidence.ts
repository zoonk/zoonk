import { hasCheckFailure } from "@/lib/comparisons/check-policy";
import { type Decision, type Direction } from "@/lib/comparisons/decision-schema";
import {
  acceptedReads,
  missingReaderFamilies,
  opposite,
  verifiedClaims,
} from "@/lib/comparisons/evidence";
import { ownerPackets } from "@/lib/comparisons/packets";
import {
  type Comparison,
  type PacketOutput,
  type Reader,
  type SealedPacket,
} from "@/lib/comparisons/schemas";
import { type Side, familyLabel } from "./labels";

type Read = ReturnType<typeof acceptedReads>[number];
type Claim = ReturnType<typeof verifiedClaims>[number];
type Verdict = Read["verdict"];
type Observation = Verdict["observations"][number];
type Choice = Side | "tie";

export type CheckResult = Claim["results"][number];

export type ObservationView = {
  check: (Pick<Claim, "checked" | "finding" | "source"> & { results: CheckResult[] }) | null;
  observation: Observation;
  side: Side;
};

/** Which side the reader saw as A; its reasons name the outputs by these letters. */
export type ReadOrder = { first: Side; paired: boolean };

export type ReadView = {
  criteria: { choice: Choice; criterion: string; reason?: string }[];
  key: string;
  observations: ObservationView[];
  order: ReadOrder;
  overall: { choice: Choice; reason: string } | null;
  reader: Reader;
  reverse: boolean;
};

export type FailedCheck = Comparison["checks"][number];

export type RunView = {
  failedChecks: Record<Side, FailedCheck[]>;
  outputs: Record<Side, PacketOutput | null>;
  reads: ReadView[];
  run: number;
};

function sideOf(label: "A" | "B", first: Side): Side {
  return label === "A" ? first : opposite(first);
}

function choiceOf(preference: "A" | "B" | "tie", first: Side): Choice {
  return preference === "tie" ? "tie" : sideOf(preference, first);
}

function observationView({
  claims,
  first,
  observation,
}: {
  claims: Claim[];
  first: Side;
  observation: Observation;
}): ObservationView {
  const claim = claims.find((entry) => entry.observation === observation);

  return {
    check: claim
      ? {
          checked: claim.checked,
          finding: claim.finding,
          results: claim.results,
          source: claim.source,
        }
      : null,
    observation,
    side: sideOf(observation.output, first),
  };
}

function readView(claims: Claim[], read: Read): ReadView {
  const { first } = read.mapping;
  const { verdict } = read;

  return {
    criteria: verdict.criteria.map((entry) => ({
      choice: choiceOf(entry.preference, first),
      criterion: entry.criterion,
      reason: entry.reason,
    })),
    key: `${read.packet.id}-${read.attempt.attempt}`,
    observations: verdict.observations.map((observation) =>
      observationView({ claims, first, observation }),
    ),
    order: { first, paired: read.verdict.overall !== null },
    overall: verdict.overall && {
      choice: choiceOf(verdict.overall.preference, first),
      reason: verdict.overall.reason,
    },
    reader: read.packet.reader,
    reverse: read.packet.reverse,
  };
}

function failedChecks(
  comparison: Comparison,
  { caseId, run }: { caseId: string; run: number },
  side: Side,
): FailedCheck[] {
  return comparison.checks.filter(
    (check) =>
      check.caseId === caseId && check.run === run && check.side === side && hasCheckFailure(check),
  );
}

/** Each run of a case: both outputs, and every accepted read of them translated from A and B to sides. */
export function caseRuns(comparison: Comparison, caseId: string): RunView[] {
  const reads = acceptedReads(comparison);
  const claims = verifiedClaims(comparison);

  const output = (slot: { hash: string } | null): PacketOutput | null => {
    const stored = slot ? comparison.outputs[slot.hash] : undefined;

    if (!slot || stored === undefined) {
      return null;
    }

    return typeof stored === "string" ? stored : { image: slot.hash };
  };

  return comparison.manifest.runsCompared
    .filter((run) => run.caseId === caseId)
    .toSorted((left, right) => left.run - right.run)
    .map((run) => ({
      failedChecks: {
        challenger: failedChecks(comparison, run, "challenger"),
        incumbent: failedChecks(comparison, run, "incumbent"),
      },
      outputs: { challenger: output(run.challenger), incumbent: output(run.incumbent) },
      reads: reads
        .filter((read) => read.mapping.caseId === caseId && read.mapping.run === run.run)
        .map((read) => readView(claims, read)),
      run: run.run,
    }));
}

const RESULT_ORDER: Record<Direction, number> = {
  challenger: 1,
  incumbent: 1,
  split: 0,
  tie: 2,
  unresolved: 0,
};

export function awaitedReaderLabels(
  manifest: Comparison["manifest"],
  votes: Decision["cases"][number]["votes"],
) {
  return missingReaderFamilies(manifest, votes).map((family) => familyLabel(family));
}

/** Cases that still need a call first, then the ones that went one way, then ties. */
export function orderCases(cases: Decision["cases"]): Decision["cases"] {
  return cases.toSorted((left, right) => RESULT_ORDER[left.result] - RESULT_ORDER[right.result]);
}

export function packetCase(packet: SealedPacket): string {
  return packet.mapping[0]?.caseId ?? "";
}

/** The owner reads each case once, blind, in the order the comparison sealed. */
export function ownerReads(comparison: Comparison) {
  const reads = acceptedReads(comparison);

  return ownerPackets(comparison.manifest).flatMap((packet) => {
    const caseId = packetCase(packet);
    const attempt = reads.find((read) => read.packet.id === packet.id)?.attempt ?? null;
    const ruled = comparison.adjudications.some((entry) => entry.caseId === caseId);

    return ruled && !attempt ? [] : [{ attempt, caseId, packet, read: attempt !== null }];
  });
}

/** The next packet the owner hasn't read, preferring the given case. */
export function nextOwnerPacket(comparison: Comparison, caseId?: string) {
  const unread = ownerReads(comparison).filter((entry) => !entry.read);

  return (unread.find((entry) => entry.caseId === caseId) ?? unread[0])?.packet ?? null;
}
