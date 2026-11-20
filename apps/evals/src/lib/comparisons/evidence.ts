import { type Direction } from "./decision-schema";
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

    const attempt = attempts[0];

    if (!attempt) {
      return [];
    }

    return packet.mapping
      .filter((mapping) => mapping.kind === "real")
      .flatMap((mapping) => {
        const verdict = attempt.response.verdicts.find((vote) => vote.pairId === mapping.pairId);

        if (!verdict) {
          return [];
        }

        const preference = verdict.overall?.preference;

        return [{ attempt, mapping, packet, verdict, vote: voteFor(preference, mapping.first) }];
      });
  });
}
function majorClaimsIncludingMissingPairs(comparison: Comparison) {
  return acceptedReads(comparison).flatMap(({ packet, attempt, mapping, verdict }) =>
    verdict.observations.flatMap((observation, index) =>
      observation.severity === "major"
        ? [
            {
              caseId: mapping.caseId,
              id: [packet.id, attempt.attempt, mapping.pairId, index].join("."),
              observation,
              pair: packet.packet.pairs.find((pair) => pair.pairId === mapping.pairId),
              reader: packet.reader,
              run: mapping.run,
              side: observation.output === "A" ? mapping.first : opposite(mapping.first),
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

function settle(votes: Direction[]): Direction {
  if (votes.includes("split")) {
    return "unresolved";
  }

  const winner = sides.find(
    (subject) =>
      votes.filter((vote) => vote === subject).length >= 2 && !votes.includes(opposite(subject)),
  );

  return (
    winner ?? (votes.length >= 2 && votes.every((vote) => vote === "tie") ? "tie" : "unresolved")
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

      if (
        matches.length > 0 &&
        matches.every((run) => ballots.some((next) => next.mapping.run === run.run))
      ) {
        votes[family] = summarizeVotes(
          ballots.flatMap((record) => (record.vote ? [record.vote] : [])),
        );
      }
    }

    const { owner, ...families } = votes;

    return {
      caseId,
      language,
      owner: owner ?? null,
      result: settle(Object.values(families)),
      votes: families,
    };
  });
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
    const findings = comparison.verifications
      .filter((vote) => vote.passed && vote.reader.family !== claim.reader.family)
      .flatMap((vote) =>
        vote.response.results.filter((record) =>
          vote.claims.some(
            (item) => item.claimId === record.claimId && item.observationId === claim.id,
          ),
        ),
      )
      .map((record) => record.finding)
      .filter((finding) => finding !== "unsure");

    const verified = new Set(findings);

    return { ...claim, finding: verified.size === 1 ? (findings[0] ?? "unsure") : "unsure" };
  });
}
