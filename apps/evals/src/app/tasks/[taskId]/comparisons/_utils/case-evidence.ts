import { type Decision, type Direction } from "@/lib/comparisons/decision-schema";
import { acceptedReads, opposite, verifiedClaims } from "@/lib/comparisons/evidence";
import { ownerPackets } from "@/lib/comparisons/packets";
import {
  type Comparison,
  type PacketOutput,
  type Reader,
  type SealedPacket,
} from "@/lib/comparisons/schemas";
import { type Side } from "./labels";

type Read = ReturnType<typeof acceptedReads>[number];
type Claim = ReturnType<typeof verifiedClaims>[number];
type Verdict = Read["verdict"];
type Observation = Verdict["observations"][number];
type Choice = Side | "tie";

export type CheckResult = { family: string; finding: Claim["finding"]; reason: string };

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

function checkResults(comparison: Comparison, claimId: string): CheckResult[] {
  return comparison.verifications
    .filter((attempt) => attempt.passed)
    .flatMap((attempt) =>
      attempt.claims
        .filter((claim) => claim.observationId === claimId)
        .flatMap((claim) => {
          const result = attempt.response.results.find((entry) => entry.claimId === claim.claimId);

          return result
            ? [{ family: attempt.reader.family, finding: result.finding, reason: result.reason }]
            : [];
        }),
    );
}

function observationView({
  claims,
  comparison,
  first,
  observation,
}: {
  claims: Claim[];
  comparison: Comparison;
  first: Side;
  observation: Observation;
}): ObservationView {
  const claim = claims.find((entry) => entry.observation === observation);

  return {
    check: claim
      ? {
          checked: claim.checked,
          finding: claim.finding,
          results: checkResults(comparison, claim.id),
          source: claim.source,
        }
      : null,
    observation,
    side: sideOf(observation.output, first),
  };
}

function readView(comparison: Comparison, claims: Claim[], read: Read): ReadView {
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
      observationView({ claims, comparison, first, observation }),
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
      check.caseId === caseId &&
      check.run === run &&
      check.side === side &&
      check.passed < check.total,
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
        .map((read) => readView(comparison, claims, read)),
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
