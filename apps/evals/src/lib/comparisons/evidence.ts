import { type Decision, type Direction } from "./decision-schema";
import { type Comparison } from "./schemas";

export const sides = ["incumbent", "challenger"] as const;
type Side = (typeof sides)[number];
export const opposite = (value: Side) => (value === "incumbent" ? "challenger" : "incumbent");
function voteFor(preference: "A" | "B" | "tie" | undefined, first: Side) {
  if (!preference || preference === "tie") {
    return preference;
  }

  return preference === "A" ? first : opposite(first);
}
export function acceptedReads(comparison: Comparison) {
  return comparison.manifest.packets.flatMap((packet) => {
    const attempts = comparison.attempts
      .filter((prior) => prior.packetId === packet.id && prior.passed)
      .toSorted((prior, next) => prior.attempt.localeCompare(next.attempt));

    return packet.mapping
      .filter((mapping) => mapping.kind === "real")
      .flatMap((mapping) => {
        const ruling =
          packet.reader.channel === "owner"
            ? comparison.adjudications.find((entry) => entry.caseId === mapping.caseId)
            : undefined;

        const attempt = ruling
          ? attempts.find(
              (entry) =>
                entry.recordedAt && ruling.recordedAt && entry.recordedAt < ruling.recordedAt,
            )
          : attempts[0];

        if (!attempt) {
          return [];
        }

        const verdict = attempt.response.verdicts.find((vote) => vote.pairId === mapping.pairId);

        if (!verdict) {
          return [];
        }

        const preference = verdict.overall?.preference;

        return [{ attempt, mapping, packet, verdict, vote: voteFor(preference, mapping.first) }];
      });
  });
}
type Read = ReturnType<typeof acceptedReads>[number];

function isControlFreeOwnerRead({ attempt, packet }: Read) {
  return (
    packet.reader.channel === "owner" &&
    !packet.mapping.some(
      (entry) =>
        entry.kind !== "real" &&
        attempt.response.verdicts.some((verdict) => verdict.pairId === entry.pairId),
    )
  );
}

function majorClaimsIncludingMissingPairs(comparison: Comparison) {
  return acceptedReads(comparison).flatMap((read) =>
    read.verdict.observations.flatMap((observation, index) =>
      observation.severity === "major"
        ? [
            {
              caseId: read.mapping.caseId,
              id: [read.packet.id, read.attempt.attempt, read.mapping.pairId, index].join("."),
              observation,
              pair: read.packet.packet.pairs.find((pair) => pair.pairId === read.mapping.pairId),
              reader: read.packet.reader,
              run: read.mapping.run,
              side: observation.output === "A" ? read.mapping.first : opposite(read.mapping.first),
              source: isControlFreeOwnerRead(read) ? ("owner" as const) : ("verification" as const),
            },
          ]
        : [],
    ),
  );
}
export function majorClaims(comparison: Comparison) {
  return majorClaimsIncludingMissingPairs(comparison).flatMap((claim) =>
    claim.pair ? [{ ...claim, pair: claim.pair }] : [],
  );
}
function summarizeVotes(votes: Direction[]): Direction {
  const directions = sides.filter((subject) => votes.includes(subject));

  if (directions.length === 2) {
    return "split";
  }

  return directions[0] ?? "tie";
}

export function settle(votes: Direction[]): Direction {
  const expressed = votes.filter((vote) => vote !== "split");

  const winner = sides.find(
    (subject) =>
      votes.filter((vote) => vote === subject).length >= 2 && !votes.includes(opposite(subject)),
  );

  return (
    winner ??
    (expressed.length >= 2 && expressed.every((vote) => vote === "tie") ? "tie" : "unresolved")
  );
}

export function caseVotes(comparison: Comparison, reads: ReturnType<typeof acceptedReads>) {
  const { manifest } = comparison;

  return manifest.cases.map(({ id: caseId, language }) => {
    const matches = manifest.runsCompared.filter(
      (record) => record.caseId === caseId && record.incumbent && record.challenger,
    );

    const votes: Record<string, Direction> = {};

    for (const family of new Set(reads.map((record) => record.packet.reader.family))) {
      const ballots = reads.filter(
        (record) =>
          record.mapping.caseId === caseId && record.packet.reader.family === family && record.vote,
      );

      const complete =
        family === "owner" ? ballots.filter((record) => !isControlFreeOwnerRead(record)) : ballots;

      if (
        matches.length > 0 &&
        matches.every((run) => complete.some((next) => next.mapping.run === run.run))
      ) {
        votes[family] = summarizeVotes(
          complete.flatMap((record) => (record.vote ? [record.vote] : [])),
        );
      }
    }

    const { owner: legacyOwner, ...families } = votes;

    const blindOwner = reads.find(
      (record) =>
        record.mapping.caseId === caseId &&
        !record.packet.reverse &&
        isControlFreeOwnerRead(record),
    );

    const modelResult = settle(Object.values(families));

    const ruling = canAdjudicate(manifest, { votes: families })
      ? comparison.adjudications.find((entry) => entry.caseId === caseId)
      : undefined;

    const adjudication = latestRuling(ruling, blindOwner);

    const result = modelResult === "unresolved" ? (blindOwner?.vote ?? modelResult) : modelResult;

    return {
      ...(adjudication && { adjudication }),
      caseId,
      language,
      legacyOwner: legacyOwner ?? null,
      owner: blindOwner?.vote ?? legacyOwner ?? null,
      result: adjudication?.direction ?? result,
      votes: families,
    };
  });
}

function latestRuling(
  ruling: Comparison["adjudications"][number] | undefined,
  blindOwner: Read | undefined,
) {
  return ruling &&
    (!blindOwner?.vote || (ruling.recordedAt ?? "") >= (blindOwner.attempt.recordedAt ?? ""))
    ? ruling
    : undefined;
}

export function canAdjudicate(
  manifest: Comparison["manifest"],
  item: Pick<Decision["cases"][number], "votes">,
) {
  const readers = manifest.readers.filter(
    (reader) => reader.channel !== "owner" && !reader.reserve,
  );

  return (
    settle(Object.values(item.votes)) === "unresolved" &&
    readers.length >= 2 &&
    readers.every((reader) => Object.hasOwn(item.votes, reader.family))
  );
}
export function readerRecords(comparison: Comparison, reads: ReturnType<typeof acceptedReads>) {
  const { manifest } = comparison;

  return manifest.readers.map((reader) => {
    const ballots = reads.filter((record) => record.packet.reader.model === reader.model);

    const ownSide = sides.filter((subject) =>
      manifest.variants[subject]?.model.startsWith(`${reader.family}/`),
    );

    const opportunities = ownSide.length === 1 ? ballots.filter((record) => record.vote) : [];

    const withOwner = (reader.channel === "owner" ? [] : ballots).flatMap((record) => {
      const owner = reads.find(
        (ownerRead) =>
          ownerRead.packet.reader.channel === "owner" &&
          !ownerRead.packet.reverse &&
          ownerRead.mapping.caseId === record.mapping.caseId &&
          ownerRead.mapping.run === record.mapping.run,
      );

      return owner?.vote && record.vote ? [owner.vote === record.vote] : [];
    });

    return {
      ...reader,
      failedPackets: comparison.attempts.filter(
        (prior) => prior.reader.model === reader.model && !prior.passed,
      ).length,
      ownOpportunities: opportunities.length,
      ownWins: opportunities.filter((record) => record.vote === ownSide[0]).length,
      ownerAgrees: withOwner.filter(Boolean).length,
      ownerCompared: withOwner.length,
    };
  });
}
export function verifiedClaims(comparison: Comparison) {
  return majorClaims(comparison).map((claim) => {
    const checks = comparison.verifications
      .filter((vote) => vote.passed && vote.reader.family !== claim.reader.family)
      .flatMap((vote) =>
        vote.response.results.filter((record) =>
          vote.claims.some(
            (item) => item.claimId === record.claimId && item.observationId === claim.id,
          ),
        ),
      )
      .map((record) => record.finding);

    const findings = checks.filter((finding) => finding !== "unsure");
    const verified = new Set(findings);
    const finding = verified.size === 1 ? (findings[0] ?? "unsure") : "unsure";

    return {
      ...claim,
      checked: checks.length > 0,
      finding: claim.source === "owner" ? ("holds" as const) : finding,
    };
  });
}
